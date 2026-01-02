# =============================================================================
# App Infrastructure Outputs
# =============================================================================

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
# Lambda Outputs
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
# VPC Info (from base)
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC ID (from base)"
  value       = local.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (from base)"
  value       = local.private_subnet_ids
}