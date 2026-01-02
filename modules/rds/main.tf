# =============================================================================
# RDS Module
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------------
# DB Subnet Group
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

# -----------------------------------------------------------------------------
# Security Group for RDS
# -----------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  # Allow PostgreSQL from Lambda
  ingress {
    description     = "PostgreSQL from Lambda"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.lambda_security_group_id]
  }

  # Allow PostgreSQL from VPC (for DB Init Lambda and other internal services)
  ingress {
    description = "PostgreSQL from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # Allow PostgreSQL from EKS
  dynamic "ingress" {
    for_each = var.eks_security_group_id != "" ? [1] : []
    content {
      description     = "PostgreSQL from EKS"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [var.eks_security_group_id]
    }
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL Instance (Free Tier)
# -----------------------------------------------------------------------------
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  # Engine - Free Tier 설정
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = "db.t3.micro"  # Free Tier eligible
  allocated_storage    = 20              # Free Tier: 20GB
  max_allocated_storage = 20             # Free Tier 제한

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false  # Free Tier: Single-AZ only

  # Storage - Free Tier
  storage_type      = "gp2"   # Free Tier: gp2
  storage_encrypted = false   # Free Tier: 암호화 비활성화 (비용 절감)

  # Backup - Free Tier 최소 설정
  backup_retention_period = 0  # Free Tier: 백업 비활성화 (비용 절감)
  
  # Performance Insights 비활성화 (Free Tier 외)
  performance_insights_enabled = false

  # Other settings
  skip_final_snapshot       = true
  deletion_protection       = false
  
  # Parameter group
  parameter_group_name = aws_db_parameter_group.main.name

  depends_on = [
    aws_db_subnet_group.main,
    aws_db_parameter_group.main,
    aws_security_group.rds
  ]

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}

# -----------------------------------------------------------------------------
# DB Parameter Group
# -----------------------------------------------------------------------------
resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-postgres-params"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "${local.name_prefix}-postgres-params"
  }
}
