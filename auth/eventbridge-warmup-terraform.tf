# Terraform configuration for Lambda warm-up using EventBridge

variable "lambda_function_name" {
  description = "Name of the Lambda function to warm up"
  type        = string
  default     = "lambda-cognito-delete"
}

variable "warmup_schedule" {
  description = "Schedule expression for warm-up"
  type        = string
  default     = "rate(5 minutes)"
  # Options:
  # - "rate(5 minutes)" - Every 5 minutes
  # - "rate(10 minutes)" - Every 10 minutes
  # - "cron(0/5 * * * ? *)" - Every 5 minutes using cron
  # - "cron(0 8-18 ? * MON-FRI *)" - Every hour from 8 AM to 6 PM on weekdays
}

# EventBridge Rule for Lambda warm-up
resource "aws_cloudwatch_event_rule" "lambda_warmup" {
  name                = "${var.lambda_function_name}-warmup-rule"
  description         = "Periodically invoke Lambda to keep it warm"
  schedule_expression = var.warmup_schedule
  is_enabled          = true
}

# EventBridge Target
resource "aws_cloudwatch_event_target" "lambda_warmup_target" {
  rule      = aws_cloudwatch_event_rule.lambda_warmup.name
  target_id = "LambdaWarmUpTarget"
  arn       = data.aws_lambda_function.target.arn

  input = jsonencode({
    source       = "aws.events"
    detail-type  = "Scheduled Event"
    detail = {
      warmup = true
    }
  })
}

# Data source to get Lambda function ARN
data "aws_lambda_function" "target" {
  function_name = var.lambda_function_name
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.lambda_warmup.arn
}

# Outputs
output "eventbridge_rule_arn" {
  description = "ARN of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.lambda_warmup.arn
}

output "rule_name" {
  description = "Name of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.lambda_warmup.name
}
