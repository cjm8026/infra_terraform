# =============================================================================
# DB Init Module Outputs
# =============================================================================

output "lambda_function_name" {
  description = "Name of the DB table creator Lambda function"
  value       = aws_lambda_function.db_init.function_name
}

output "lambda_function_arn" {
  description = "ARN of the DB table creator Lambda function"
  value       = aws_lambda_function.db_init.arn
}

output "security_group_id" {
  description = "Security group ID for the Lambda function"
  value       = aws_security_group.db_init_lambda.id
}

output "invocation_result" {
  description = "Result of the Lambda invocation"
  value       = aws_lambda_invocation.db_init.result
}