# =============================================================================
# Lambda Update Module Outputs
# =============================================================================

output "security_group_id" {
  description = "Lambda security group ID"
  value       = aws_security_group.lambda.id
}

output "pre_signup_arn" {
  description = "PreSignUp Lambda ARN"
  value       = data.aws_lambda_function.pre_signup.arn
}

output "post_confirmation_arn" {
  description = "PostConfirmation Lambda ARN"
  value       = data.aws_lambda_function.post_confirmation.arn
}

output "post_authentication_arn" {
  description = "PostAuthentication Lambda ARN"
  value       = data.aws_lambda_function.post_authentication.arn
}
