# =============================================================================
# Main Terraform Configuration
# Cognito + RDS + EKS + S3 Integration
# =============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# -----------------------------------------------------------------------------
# Provider Configuration
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 2)
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# VPC Module
# -----------------------------------------------------------------------------
module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.azs
}

# -----------------------------------------------------------------------------
# RDS Module
# -----------------------------------------------------------------------------
module "rds" {
  source = "./modules/rds"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  vpc_cidr             = var.vpc_cidr
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  
  # Security group sources
  lambda_security_group_id  = module.lambda_update.security_group_id
  eks_security_group_id     = module.eks.cluster_security_group_id
}

# -----------------------------------------------------------------------------
# Existing Lambda Functions (Data Sources)
# 기존 Lambda 함수들을 참조하고 VPC 설정 및 환경변수 업데이트
# -----------------------------------------------------------------------------
module "lambda_update" {
  source = "./modules/lambda-update"

  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  
  db_host     = module.rds.db_endpoint
  db_port     = module.rds.db_port
  db_name     = var.db_name
  db_user     = var.db_username
  db_password = var.db_password
  
  # 기존 Lambda 함수 이름
  pre_signup_function_name          = var.existing_lambda_pre_signup
  post_confirmation_function_name   = var.existing_lambda_post_confirmation
  post_authentication_function_name = var.existing_lambda_post_authentication
}

# -----------------------------------------------------------------------------
# Existing Cognito User Pool (Data Source)
# 기존 Cognito User Pool 참조
# -----------------------------------------------------------------------------
data "aws_cognito_user_pools" "existing" {
  name = var.existing_cognito_user_pool_name
}

# Cognito Client는 client_id가 설정된 경우에만 조회
data "aws_cognito_user_pool_client" "existing" {
  count        = var.existing_cognito_client_id != "" ? 1 : 0
  user_pool_id = data.aws_cognito_user_pools.existing.ids[0]
  client_id    = var.existing_cognito_client_id
}

# -----------------------------------------------------------------------------
# EKS Module
# -----------------------------------------------------------------------------
module "eks" {
  source = "./modules/eks"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  
  node_instance_types = var.eks_node_instance_types
  node_desired_size   = var.eks_node_desired_size
  node_min_size       = var.eks_node_min_size
  node_max_size       = var.eks_node_max_size
}

# -----------------------------------------------------------------------------
# ECR Module
# -----------------------------------------------------------------------------
module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

# -----------------------------------------------------------------------------
# S3 Static Website Module (No CloudFront)
# -----------------------------------------------------------------------------
module "s3_website" {
  source = "./modules/s3-website"

  project_name = var.project_name
  environment  = var.environment
}

# -----------------------------------------------------------------------------
# DB Table Creation Module
# -----------------------------------------------------------------------------
module "db_init" {
  source = "./modules/db-init"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  
  db_host     = module.rds.db_endpoint
  db_port     = module.rds.db_port
  db_name     = var.db_name
  db_user     = var.db_username
  db_password = var.db_password
  
  schema_version = var.db_schema_version

  depends_on = [module.rds]
}
