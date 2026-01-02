# =============================================================================
# Terraform Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------
variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "fproject"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# -----------------------------------------------------------------------------
# RDS
# -----------------------------------------------------------------------------
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "fproject_db"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "fproject_user"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_schema_version" {
  description = "Database schema version for triggering table recreation"
  type        = string
  default     = "1.0.0"
}

# -----------------------------------------------------------------------------
# Cognito
# -----------------------------------------------------------------------------
# Cognito는 기존 리소스 사용 (cognito_callback_urls, cognito_logout_urls 제거)

# -----------------------------------------------------------------------------
# EKS
# -----------------------------------------------------------------------------
variable "eks_node_instance_types" {
  description = "EKS node instance types"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_node_desired_size" {
  description = "EKS node group desired size"
  type        = number
  default     = 2
}

variable "eks_node_min_size" {
  description = "EKS node group minimum size"
  type        = number
  default     = 1
}

variable "eks_node_max_size" {
  description = "EKS node group maximum size"
  type        = number
  default     = 3
}

# -----------------------------------------------------------------------------
# Existing Resources (기존 리소스)
# -----------------------------------------------------------------------------
variable "existing_cognito_user_pool_name" {
  description = "Existing Cognito User Pool name"
  type        = string
  default     = "User pool - rngxan"
}

variable "existing_cognito_user_pool_id" {
  description = "Existing Cognito User Pool ID"
  type        = string
  default     = "us-east-1_oesTGe9D5"
}

variable "existing_cognito_client_id" {
  description = "Existing Cognito User Pool Client ID"
  type        = string
  default     = ""
}

variable "existing_lambda_pre_signup" {
  description = "Existing PreSignUp Lambda function name"
  type        = string
  default     = "CognitoPreSignUp"
}

variable "existing_lambda_post_confirmation" {
  description = "Existing PostConfirmation Lambda function name"
  type        = string
  default     = "CognitoPostConfirmation"
}

variable "existing_lambda_post_authentication" {
  description = "Existing PostAuthentication Lambda function name"
  type        = string
  default     = "CognitoPostAuthentication"
}
