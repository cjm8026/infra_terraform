# =============================================================================
# Lambda Update Module
# 기존 Lambda 함수들의 VPC 설정 및 환경변수 업데이트
# =============================================================================

# -----------------------------------------------------------------------------
# Security Group for Lambda (VPC 접근용)
# -----------------------------------------------------------------------------
resource "aws_security_group" "lambda" {
  name        = "lambda-rds-access-sg"
  description = "Security group for Lambda functions to access RDS"
  vpc_id      = var.vpc_id

  # Allow all outbound (for RDS, NAT Gateway)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "lambda-rds-access-sg"
    ManagedBy = "Terraform"
  }
}

# -----------------------------------------------------------------------------
# Data Sources - 기존 Lambda 함수 정보 조회
# -----------------------------------------------------------------------------
data "aws_lambda_function" "pre_signup" {
  function_name = var.pre_signup_function_name
}

data "aws_lambda_function" "post_confirmation" {
  function_name = var.post_confirmation_function_name
}

data "aws_lambda_function" "post_authentication" {
  function_name = var.post_authentication_function_name
}

# -----------------------------------------------------------------------------
# Data Source - 기존 IAM Role 조회
# -----------------------------------------------------------------------------
data "aws_iam_role" "cognito_lambda_role" {
  name = "CognitoLambdaTriggerRole"
}

# -----------------------------------------------------------------------------
# IAM Policy - VPC 접근 권한 추가 (기존 Role에)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = data.aws_iam_role.cognito_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# -----------------------------------------------------------------------------
# Note: Lambda 함수 업데이트는 AWS CLI로 수행
# Terraform으로 기존 Lambda를 직접 수정하면 충돌 발생 가능
# 아래 null_resource로 AWS CLI 명령어 실행
# -----------------------------------------------------------------------------

# PostConfirmation Lambda VPC 설정 및 환경변수 업데이트
resource "null_resource" "update_post_confirmation" {
  triggers = {
    db_host    = var.db_host
    db_port    = var.db_port
    db_name    = var.db_name
    vpc_config = join(",", var.private_subnet_ids)
  }

  provisioner "local-exec" {
    interpreter = ["PowerShell", "-Command"]
    command = "aws lambda update-function-configuration --function-name ${var.post_confirmation_function_name} --vpc-config SubnetIds=${join(",", var.private_subnet_ids)},SecurityGroupIds=${aws_security_group.lambda.id} --environment 'Variables={DB_HOST=${var.db_host},DB_PORT=${var.db_port},DB_NAME=${var.db_name},DB_USER=${var.db_user},DB_PASSWORD=${var.db_password}}'"
  }

  depends_on = [
    aws_security_group.lambda,
    aws_iam_role_policy_attachment.lambda_vpc_access
  ]
}

# PostAuthentication Lambda VPC 설정 및 환경변수 업데이트
resource "null_resource" "update_post_authentication" {
  triggers = {
    db_host    = var.db_host
    db_port    = var.db_port
    db_name    = var.db_name
    vpc_config = join(",", var.private_subnet_ids)
  }

  provisioner "local-exec" {
    interpreter = ["PowerShell", "-Command"]
    command = "aws lambda update-function-configuration --function-name ${var.post_authentication_function_name} --vpc-config SubnetIds=${join(",", var.private_subnet_ids)},SecurityGroupIds=${aws_security_group.lambda.id} --environment 'Variables={DB_HOST=${var.db_host},DB_PORT=${var.db_port},DB_NAME=${var.db_name},DB_USER=${var.db_user},DB_PASSWORD=${var.db_password}}'"
  }

  depends_on = [
    aws_security_group.lambda,
    aws_iam_role_policy_attachment.lambda_vpc_access
  ]
}

# PreSignUp Lambda는 DB 접근 불필요하므로 VPC 설정 안함
