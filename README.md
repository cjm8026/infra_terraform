# FProject 인프라 (Terraform)

AWS 기반 풀스택 웹 애플리케이션 인프라를 Terraform으로 관리합니다.

## 📋 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS (us-east-1)                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         VPC (10.0.0.0/16)                             │  │
│  │                                                                       │  │
│  │   ┌──────────────────────┐       ┌──────────────────────┐             │  │
│  │   │  Public Subnet (1a)  │       │  Public Subnet (1b)  │             │  │
│  │   │    10.0.0.0/20       │       │    10.0.16.0/20      │             │  │
│  │   │  ┌──────────────┐    │       │                      │             │  │
│  │   │  │ NAT Gateway  │    │       │                      │             │  │
│  │   │  └──────────────┘    │       │                      │             │  │
│  │   └──────────────────────┘       └──────────────────────┘             │  │
│  │              │                              │                         │  │
│  │   ┌──────────────────────┐       ┌──────────────────────┐             │  │
│  │   │  Private Subnet (1a) │       │  Private Subnet (1b) │             │  │
│  │   │    10.0.32.0/20      │       │    10.0.48.0/20      │             │  │
│  │   │                      │       │                      │             │  │
│  │   │  ┌──────┐  ┌─────┐   │       │  ┌──────┐            │             │  │
│  │   │  │ EKS  │  │ RDS │   │       │  │ EKS  │            │             │  │
│  │   │  │ Node │  │(PG) │   │       │  │ Node │            │             │  │
│  │   │  └──────┘  └─────┘   │       │  └──────┘            │             │  │
│  │   └──────────────────────┘       └──────────────────────┘             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │   Cognito   │  │    ECR      │  │     S3      │  │      Lambda       │   │
│  │  User Pool  │  │ (Container) │  │ (Frontend)  │  │ (DB Table Creator)│   │
│  │  (기존사용)  │  │             │  │  (기존사용)  │  │                   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 🗂️ 프로젝트 구조

```
terraform/
├── base/                    # 🔒 VPC 인프라 (한번 배포 후 유지)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
│
├── app/                     # 🔄 앱 인프라 (매일 올렸다 내렸다)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
│
├── modules/                 # 공유 모듈
│   ├── eks/                 # Kubernetes 클러스터
│   ├── ecr/                 # 컨테이너 이미지 저장소
│   ├── rds/                 # PostgreSQL 데이터베이스
│   └── db-init/             # DB 테이블 생성 Lambda
│
└── database/                # DB 스키마 정의 (참고용)
    └── migrations/
```

## 📦 리소스 구성

| 레이어 | 리소스 | 설명 | 비용 |
|--------|--------|------|------|
| **base** | VPC, Subnets, NAT GW, IGW | 네트워크 인프라 | NAT GW 시간당 과금 |
| **app** | EKS | Kubernetes 1.34 클러스터 | 시간당 과금 |
| **app** | ECR | 컨테이너 이미지 저장소 | 저장 용량 과금 |
| **app** | RDS | PostgreSQL 15 (db.t3.micro) | 프리티어 가능 |
| **app** | Lambda | DB 테이블 자동 생성 | 거의 무료 |
| **기존** | S3 | 프론트엔드 정적 호스팅 | - |
| **기존** | Cognito | 사용자 인증 | - |

## 🚀 배포 가이드

### 사전 준비

```bash
# 1. AWS CLI 설치 확인
aws --version

# 2. Terraform 설치 확인
terraform --version

# 3. AWS 자격 증명 설정
aws configure
# Access Key ID: [입력]
# Secret Access Key: [입력]
# Default region: us-east-1
# Default output format: [Enter]

# 4. 설정 확인
aws sts get-caller-identity
```

### 1단계: Base 인프라 배포 (최초 1회만)

VPC는 한번 배포하면 계속 유지합니다. **삭제하지 마세요!**

```bash
cd base

# 초기화
terraform init

# 배포 (약 3분 소요)
terraform apply
```

배포 완료 후 출력되는 값들:
```
vpc_id = "vpc-xxxxx"
private_subnet_ids = ["subnet-xxxxx", "subnet-xxxxx"]
public_subnet_ids = ["subnet-xxxxx", "subnet-xxxxx"]
```

### 2단계: App 인프라 배포 (매일 사용)

```bash
cd app

# 변수 파일 생성 (최초 1회)
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars 수정
# db_password = "안전한비밀번호입력"  ← 반드시 변경!

# 초기화 (최초 1회)
terraform init

# 배포 (약 15-20분 소요)
terraform apply
```

### 3단계: 퇴근 시 리소스 삭제

비용 절감을 위해 퇴근 시 app 리소스를 삭제합니다.

```bash
cd app

# 삭제 (약 10-15분 소요)
terraform destroy
```

⚠️ **주의**: `base/`는 삭제하지 마세요!

## 🗄️ 자동 생성되는 DB 테이블

app 배포 시 Lambda가 자동으로 아래 테이블들을 생성합니다:

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 정보 (Cognito sub 연동) |
| `user_profiles` | 사용자 프로필 (bio, 프로필 이미지 등) |
| `user_reports` | 사용자 신고 |
| `user_inquiries` | 문의/지원 티켓 |

## 🔧 자주 사용하는 명령어

### EKS 클러스터 연결
```bash
aws eks update-kubeconfig --region us-east-1 --name fproject-dev-eks
kubectl get nodes
```

### 배포 결과 확인
```bash
cd app
terraform output
```

### DB 테이블 수동 생성 (필요시)
```bash
aws lambda invoke \
  --function-name fproject-dev-db-table-creator \
  --payload '{}' \
  response.json

cat response.json
```

### ECR 로그인
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com
```

## 📊 일일 워크플로우

### 출근 시
```bash
cd terraform/app
terraform apply -auto-approve
# 약 15-20분 대기
```

### 퇴근 시
```bash
cd terraform/app
terraform destroy -auto-approve
# 약 10-15분 대기
```

## ⚠️ 주의사항

1. **base/ 삭제 금지**: VPC 삭제 시 모든 네트워크 설정이 사라집니다
2. **db_password 보안**: `terraform.tfvars`는 절대 Git에 커밋하지 마세요
3. **destroy 전 정리**: EKS에 배포된 서비스(LoadBalancer 등)가 있으면 먼저 삭제하세요
4. **비용 주의**: NAT Gateway는 시간당 과금됩니다 (base에 포함)

## 🔍 문제 해결

### "Error: Cycle" 오류
순환 참조 문제입니다. 모듈 간 의존성을 확인하세요.

### Lambda 테이블 생성 실패
```bash
# CloudWatch 로그 확인
aws logs tail /aws/lambda/fproject-dev-db-table-creator --follow

# 수동으로 Lambda 재실행
aws lambda invoke --function-name fproject-dev-db-table-creator --payload "{}" response.json
type response.json
```

> 💡 **SSL 연결 오류 발생 시**: Lambda 코드에 `ssl: { rejectUnauthorized: false }` 설정이 이미 적용되어 있습니다. 
> Terraform apply 직후 실패해도 수동 호출하면 대부분 성공합니다.

### EKS 노드 연결 안됨
```bash
# 노드 상태 확인
kubectl get nodes
kubectl describe nodes
```

### terraform.tfstate 충돌
```bash
# state 새로고침
terraform refresh
```

## 📁 기존 리소스 정보

| 리소스 | 이름/ID |
|--------|---------|
| S3 버킷 (프론트엔드) | `fproject-export-bucket-123123` |
| Cognito User Pool | 기존 설정 사용 |

## 🌐 현재 배포된 인프라 (2026-01-02 기준)

| 리소스 | 값 |
|--------|-----|
| VPC ID | `vpc-0cfa1a080002bc9c2` |
| EKS 클러스터 | `fproject-dev-eks` (v1.34) |
| ECR 리포지토리 | `fproject-dev-api` |
| RDS 엔드포인트 | `fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com` |
| AWS 계정 | `324547056370` |
| 리전 | `us-east-1` |

> ⚠️ app/ destroy 후 재배포하면 RDS 엔드포인트 등 일부 값이 변경될 수 있습니다.

## 👥 담당자

인프라 관련 문의: [담당자 이름]
