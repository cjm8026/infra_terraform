# =============================================================================
# Lambda Update Module Variables
# =============================================================================

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC configuration"
  type        = list(string)
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_user" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "pre_signup_function_name" {
  description = "Existing PreSignUp Lambda function name"
  type        = string
  default     = "CognitoPreSignUp"
}

variable "post_confirmation_function_name" {
  description = "Existing PostConfirmation Lambda function name"
  type        = string
  default     = "CognitoPostConfirmation"
}

variable "post_authentication_function_name" {
  description = "Existing PostAuthentication Lambda function name"
  type        = string
  default     = "CognitoPostAuthentication"
}
