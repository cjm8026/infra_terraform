# =============================================================================
# DB Table Creation Lambda Module (Node.js)
# RDS PostgreSQL 데이터베이스에 테이블 생성용 Lambda 함수
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  lambda_src  = "${path.module}/lambda"
}

# -----------------------------------------------------------------------------
# Lambda 실행 역할
# -----------------------------------------------------------------------------
resource "aws_iam_role" "db_init_lambda" {
  name = "${local.name_prefix}-db-table-creator-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-db-table-creator-role"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.db_init_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.db_init_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -----------------------------------------------------------------------------
# Security Group for Lambda
# -----------------------------------------------------------------------------
resource "aws_security_group" "db_init_lambda" {
  name        = "${local.name_prefix}-db-table-creator-sg"
  description = "Security group for DB table creation Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-db-table-creator-sg"
  }
}

# -----------------------------------------------------------------------------
# npm install 실행
# -----------------------------------------------------------------------------
resource "null_resource" "npm_install" {
  triggers = {
    package_json = filemd5("${local.lambda_src}/package.json")
  }

  provisioner "local-exec" {
    command     = "npm install --production"
    working_dir = local.lambda_src
  }
}

# -----------------------------------------------------------------------------
# Lambda 함수 코드 압축
# -----------------------------------------------------------------------------
data "archive_file" "db_init_lambda" {
  type        = "zip"
  source_dir  = local.lambda_src
  output_path = "${path.module}/db_init_lambda.zip"

  depends_on = [null_resource.npm_install]
}

# -----------------------------------------------------------------------------
# Lambda 함수
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "db_init" {
  filename         = data.archive_file.db_init_lambda.output_path
  function_name    = "${local.name_prefix}-db-table-creator"
  role             = aws_iam_role.db_init_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 256
  source_code_hash = data.archive_file.db_init_lambda.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.db_init_lambda.id]
  }

  environment {
    variables = {
      DB_HOST     = var.db_host
      DB_PORT     = var.db_port
      DB_NAME     = var.db_name
      DB_USER     = var.db_user
      DB_PASSWORD = var.db_password
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_security_group.db_init_lambda,
    null_resource.npm_install
  ]

  tags = {
    Name = "${local.name_prefix}-db-table-creator"
  }
}

# -----------------------------------------------------------------------------
# Lambda 함수 실행 (테이블 생성)
# -----------------------------------------------------------------------------
resource "aws_lambda_invocation" "db_init" {
  function_name = aws_lambda_function.db_init.function_name

  input = jsonencode({
    action = "create_tables"
  })

  depends_on = [aws_lambda_function.db_init]

  triggers = {
    schema_version = var.schema_version
  }
}