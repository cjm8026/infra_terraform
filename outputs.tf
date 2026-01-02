# =============================================================================
# Terraform Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Outputs
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

# -----------------------------------------------------------------------------
# RDS Outputs
# -----------------------------------------------------------------------------
output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.db_port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.db_name
}

# -----------------------------------------------------------------------------
# Cognito Outputs (기존 리소스 참조)
# -----------------------------------------------------------------------------
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = var.existing_cognito_user_pool_id
}

output "cognito_user_pool_ids" {
  description = "Cognito User Pool IDs from data source"
  value       = data.aws_cognito_user_pools.existing.ids
}

# -----------------------------------------------------------------------------
# Lambda Outputs (기존 리소스 참조)
# -----------------------------------------------------------------------------
output "lambda_pre_signup_arn" {
  description = "PreSignUp Lambda ARN"
  value       = module.lambda_update.pre_signup_arn
}

output "lambda_post_confirmation_arn" {
  description = "PostConfirmation Lambda ARN"
  value       = module.lambda_update.post_confirmation_arn
}

output "lambda_post_authentication_arn" {
  description = "PostAuthentication Lambda ARN"
  value       = module.lambda_update.post_authentication_arn
}

output "lambda_security_group_id" {
  description = "Lambda Security Group ID (for RDS access)"
  value       = module.lambda_update.security_group_id
}

# -----------------------------------------------------------------------------
# EKS Outputs
# -----------------------------------------------------------------------------
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority" {
  description = "EKS cluster CA certificate (base64)"
  value       = module.eks.cluster_certificate_authority
  sensitive   = true
}

output "eks_update_kubeconfig_command" {
  description = "Command to update kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# -----------------------------------------------------------------------------
# ECR Outputs
# -----------------------------------------------------------------------------
output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.ecr.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = module.ecr.repository_name
}

# -----------------------------------------------------------------------------
# S3 Website Outputs
# -----------------------------------------------------------------------------
output "s3_bucket_name" {
  description = "S3 bucket name for static website"
  value       = module.s3_website.bucket_name
}

output "s3_website_endpoint" {
  description = "S3 website endpoint URL"
  value       = module.s3_website.website_endpoint
}

# -----------------------------------------------------------------------------
# DB Table Creation Outputs
# -----------------------------------------------------------------------------
output "db_table_creator_lambda_name" {
  description = "Name of the DB table creator Lambda function"
  value       = module.db_init.lambda_function_name
}

output "db_table_creation_result" {
  description = "Result of the DB table creation"
  value       = module.db_init.invocation_result
}

# -----------------------------------------------------------------------------
# Environment Variables for Application
# -----------------------------------------------------------------------------
output "env_variables" {
  description = "Environment variables for application configuration"
  value = {
    # Frontend (.env)
    VITE_AWS_REGION           = var.aws_region
    VITE_COGNITO_USER_POOL_ID = var.existing_cognito_user_pool_id
    VITE_API_URL              = "http://<EKS_LOAD_BALANCER_URL>"
    
    # Backend (.env.server)
    DB_HOST    = module.rds.db_endpoint
    DB_PORT    = module.rds.db_port
    DB_NAME    = module.rds.db_name
    DB_USER    = var.db_username
    AWS_REGION = var.aws_region
  }
  sensitive = false
}
