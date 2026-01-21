# 🚀 빠른 시작 가이드

## 현재 상태

✅ **환경변수가 실제 값으로 설정됨**
✅ **CI/CD 파이프라인 구성 완료**
✅ **보안 설정 완료**

## 1️⃣ 로컬 개발/테스트

### Kubernetes 배포
```bash
# Secret 생성 (로컬용)
kubectl apply -f k8s/secret.local.yaml

# 전체 배포
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 확인
kubectl get pods -l app=fproject-backend
kubectl logs -f deployment/fproject-backend
```

### Lambda 배포
```bash
# 패키지 생성
pip install psycopg2-binary boto3 -t .
zip -r lambda_function.zip lambda_cognito_delete.py psycopg2* boto3*

# 업로드
aws lambda update-function-code \
  --function-name lambda-cognito-delete \
  --zip-file fileb://lambda_function.zip

# 환경 변수 설정
aws lambda update-function-configuration \
  --function-name lambda-cognito-delete \
  --environment "Variables={USER_POOL_ID=us-east-1_oesTGe9D5,DB_HOST=fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com,DB_NAME=fproject_db,DB_USER=fproject_user,DB_PASSWORD=test1234,DB_PORT=5432}"
```

## 2️⃣ CI/CD 자동 배포

### GitHub Secrets 설정 (한 번만)

```bash
# GitHub CLI 사용
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
gh secret set EKS_CLUSTER_NAME
gh secret set DB_PASSWORD
gh secret set GOOGLE_CLIENT_SECRET
```

또는 GitHub 웹에서:
1. Repository → Settings
2. Secrets and variables → Actions
3. New repository secret

**필요한 Secrets:**
- `AWS_ACCESS_KEY_ID`: AWS IAM Access Key
- `AWS_SECRET_ACCESS_KEY`: AWS IAM Secret Key
- `EKS_CLUSTER_NAME`: EKS 클러스터 이름
- `DB_PASSWORD`: `test1234`
- `GOOGLE_CLIENT_SECRET`: `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`

### 자동 배포 실행

```bash
# main 브랜치에 push하면 자동 배포
git add .
git commit -m "feat: Add EventBridge warm-up"
git push origin main
```

**배포 과정:**
1. ✅ Docker 이미지 빌드 & ECR 푸시
2. ✅ Kubernetes Secret 생성 (GitHub Secrets에서)
3. ✅ ConfigMap, Deployment, Service 배포
4. ✅ Lambda 함수 업데이트
5. ✅ EventBridge warm-up 설정

### 배포 확인

GitHub → Actions 탭에서 진행 상황 확인

## 3️⃣ 배포 후 확인

```bash
# Kubernetes
kubectl get pods -l app=fproject-backend
kubectl logs -f deployment/fproject-backend

# Lambda
aws lambda get-function --function-name lambda-cognito-delete
aws logs tail /aws/lambda/lambda-cognito-delete --follow

# EventBridge
aws events describe-rule --name lambda-cognito-delete-warmup-rule
```

## 📋 파일 구조

```
프로젝트/
├── k8s/
│   ├── configmap.yaml          ✅ 실제 값 (Git에 커밋됨)
│   ├── secret.yaml             ⚠️  Placeholder (CI/CD에서 교체)
│   ├── secret.local.yaml       🔒 실제 값 (Git 제외, 로컬용)
│   ├── deployment.yaml         ✅ 실제 값 (Git에 커밋됨)
│   └── service.yaml            ✅ 변경 없음
├── .github/workflows/
│   └── deploy.yml              ✅ CI/CD 파이프라인
├── lambda_cognito_delete.py    ✅ 환경 변수 사용
└── eventbridge-warmup.yaml     ✅ CloudFormation 템플릿
```

## 🔐 보안 전략

### Git에 커밋되는 것:
- ✅ ConfigMap (RDS 엔드포인트, Cognito ID 등)
- ✅ Deployment (ECR 이미지 URL)
- ⚠️  Secret (Placeholder만, 실제 값 없음)

### Git에 커밋 안 되는 것:
- 🔒 `secret.local.yaml` (로컬 개발용)
- 🔒 `*.local.yaml` (로컬 오버라이드)
- 🔒 `secret-generated.yaml` (CI/CD 생성)

### CI/CD에서 주입되는 것:
- 🔑 DB_PASSWORD (GitHub Secret)
- 🔑 GOOGLE_CLIENT_SECRET (GitHub Secret)

## ⚡ 주요 차이점

### 이전 (Placeholder 방식):
```yaml
# k8s/configmap.yaml
DB_HOST: "REPLACE_WITH_YOUR_RDS_ENDPOINT"  ❌
```
→ Git에는 안전하지만, 배포 시 수동 교체 필요

### 현재 (실제 값 + CI/CD):
```yaml
# k8s/configmap.yaml
DB_HOST: "fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com"  ✅
```
→ Git에 커밋되지만, 민감한 비밀번호는 GitHub Secrets로 관리

## 🎯 장점

1. **로컬 개발 편리**: 실제 값이 있어서 바로 사용 가능
2. **CI/CD 자동화**: Push만 하면 자동 배포
3. **보안 유지**: 비밀번호는 GitHub Secrets로 안전하게 관리
4. **팀 협업**: ConfigMap은 공유, Secret은 각자 설정

## 📞 문제 해결

### CI/CD 실패 시:
1. GitHub Actions 로그 확인
2. AWS 권한 확인
3. EKS 접근 권한 확인

### 로컬 배포 실패 시:
1. `kubectl get pods` 확인
2. `kubectl logs` 확인
3. Secret이 생성되었는지 확인

## 📚 상세 가이드

- **CI/CD 설정**: `CICD_SETUP_GUIDE.md` 참고
- **보안 체크리스트**: `SECURITY_CHECKLIST.md` 참고
- **Lambda Warm-up**: `LAMBDA_WARMUP_GUIDE.md` 참고
- **배포 가이드**: `DEPLOYMENT_GUIDE.md` 참고
