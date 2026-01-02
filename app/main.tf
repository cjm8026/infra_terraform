# =============================================================================
# App Infrastructure (EKS, ECR, RDS, Lambda)
# 매일 올렸다 내렸다 하는 리소스들
# =============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Layer       = "app"
    }
  }
}

# -----------------------------------------------------------------------------
# Remote State - base/ 에서 VPC 정보 가져오기
# -----------------------------------------------------------------------------
data "terraform_remote_state" "base" {
  backend = "local"

  config = {
    path = "../base/terraform.tfstate"
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------
locals {
  name_prefix        = "${var.project_name}-${var.environment}"
  vpc_id             = data.terraform_remote_state.base.outputs.vpc_id
  vpc_cidr           = data.terraform_remote_state.base.outputs.vpc_cidr
  public_subnet_ids  = data.terraform_remote_state.base.outputs.public_subnet_ids
  private_subnet_ids = data.terraform_remote_state.base.outputs.private_subnet_ids
}

# -----------------------------------------------------------------------------
# EKS Module
# -----------------------------------------------------------------------------
module "eks" {
  source = "../modules/eks"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = local.vpc_id
  private_subnet_ids  = local.private_subnet_ids
  public_subnet_ids   = local.public_subnet_ids
  
  node_instance_types = var.eks_node_instance_types
  node_desired_size   = var.eks_node_desired_size
  node_min_size       = var.eks_node_min_size
  node_max_size       = var.eks_node_max_size
}

# -----------------------------------------------------------------------------
# ECR Module
# -----------------------------------------------------------------------------
module "ecr" {
  source = "../modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

# -----------------------------------------------------------------------------
# RDS Module
# -----------------------------------------------------------------------------
module "rds" {
  source = "../modules/rds"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = local.vpc_id
  vpc_cidr             = local.vpc_cidr
  private_subnet_ids   = local.private_subnet_ids
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  
  # Security group sources (VPC CIDR로 Lambda 접근 허용하므로 별도 SG 불필요)
  eks_security_group_id = module.eks.cluster_security_group_id
}

# -----------------------------------------------------------------------------
# DB Table Creation Lambda
# -----------------------------------------------------------------------------
module "db_init" {
  source = "../modules/db-init"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = local.vpc_id
  private_subnet_ids = local.private_subnet_ids
  
  db_host     = module.rds.db_endpoint
  db_port     = module.rds.db_port
  db_name     = var.db_name
  db_user     = var.db_username
  db_password = var.db_password
  
  schema_version = var.db_schema_version

  depends_on = [module.rds]
}