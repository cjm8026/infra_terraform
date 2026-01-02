# =============================================================================
# App Infrastructure Variables
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