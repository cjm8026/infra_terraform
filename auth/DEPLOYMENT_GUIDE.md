# 배포 가이드

## 🎯 현재 상황

Git에는 **보안을 위해 placeholder 버전**이 커밋되어 있습니다.
실제 배포를 위해서는 아래 방법 중 하나를 선택하세요.

## 📋 배포 방법

### 방법 1: 로컬 파일 사용 (개발/테스트용)

실제 값이 들어있는 `*.local.yaml` 파일들이 생성되었습니다:
- `k8s/configmap.local.yaml` ✅
- `k8s/secret.local.yaml` ✅
- `k8s/deployment.local.yaml` ✅

**배포 명령:**
```bash
# 로컬 파일로 배포
kubectl apply -f k8s/configmap.local.yaml
kubectl apply -f k8s/secret.local.yaml
kubectl apply -f k8s/deployment.local.yaml
kubectl apply -f k8s/service.yaml

# 확인
kubectl get pods -l app=fproject-backend
kubectl logs -f deployment/fproject-backend
```

**주의:** `*.local.yaml` 파일은 `.gitignore`에 포함되어 Git에 올라가지 않습니다.

---

### 방법 2: GitHub Actions CI/CD (프로덕션 권장)

#### Step 1: GitHub Secrets 설정

Repository → Settings → Secrets and variables → Actions → New repository secret

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
DB_HOST=fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com
DB_PASSWORD=test1234
AWS_USER_POOL_ID=us-east-1_oesTGe9D5
AWS_CLIENT_ID=6ugujl077j6fmcqgptjmn91b7e
S3_BUCKET=knowledge-base-test-6575574
FRONTEND_URL=https://www.aws11.shop
GOOGLE_CLIENT_SECRET=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
```

#### Step 2: 워크플로우 파일 활성화

```bash
# 예시 파일을 실제 워크플로우로 복사
cp .github/workflows/deploy-example.yml .github/workflows/deploy.yml

# EKS 클러스터 이름 수정
# deploy.yml 파일에서 'your-cluster-name'을 실제 클러스터 이름으로 변경
```

#### Step 3: Push하면 자동 배포

```bash
git add .
git commit -m "feat: Setup CI/CD pipeline"
git push origin main
```

GitHub Actions가 자동으로:
1. Docker 이미지 빌드 & ECR 푸시
2. Placeholder를 실제 값으로 교체
3. Kubernetes에 배포
4. Lambda 함수 업데이트
5. EventBridge warm-up 설정

---

### 방법 3: 수동 배포 (빠른 테스트)

#### K8s 배포:

```bash
# 1. ConfigMap 수정 (실제 값으로 교체)
# k8s/configmap.yaml 파일을 직접 편집하거나 sed 사용

# 2. Secret 생성
kubectl create secret generic fproject-backend-secret \
  --from-literal=DB_PASSWORD=test1234 \
  --from-literal=GOOGLE_CLIENT_SECRET=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

# 3. Deployment 수정 (이미지 URL 교체)
# k8s/deployment.yaml에서 YOUR_AWS_ACCOUNT_ID를 324547056370으로 교체

# 4. 배포
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

#### Lambda 배포:

```bash
# 1. 환경 변수 설정
aws lambda update-function-configuration \
  --function-name lambda-cognito-delete \
  --environment "Variables={
    USER_POOL_ID=us-east-1_oesTGe9D5,
    DB_HOST=fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com,
    DB_NAME=fproject_db,
    DB_USER=fproject_user,
    DB_PASSWORD=test1234,
    DB_PORT=5432
  }"

# 2. 코드 업데이트
pip install psycopg2-binary boto3 -t .
zip -r lambda_function.zip lambda_cognito_delete.py psycopg2* boto3*
aws lambda update-function-code \
  --function-name lambda-cognito-delete \
  --zip-file fileb://lambda_function.zip

# 3. EventBridge warm-up 설정
aws cloudformation deploy \
  --template-file eventbridge-warmup.yaml \
  --stack-name lambda-warmup-stack \
  --parameter-overrides \
    LambdaFunctionName=lambda-cognito-delete \
    WarmUpSchedule="rate(5 minutes)"
```

---

## 🔍 배포 확인

### Kubernetes:
```bash
# Pod 상태
kubectl get pods -l app=fproject-backend

# 로그 확인
kubectl logs -f deployment/fproject-backend

# Service 확인
kubectl get svc fproject-backend

# ConfigMap 확인
kubectl describe configmap fproject-backend-config

# Secret 확인 (값은 안 보임)
kubectl get secret fproject-backend-secret
```

### Lambda:
```bash
# 함수 정보
aws lambda get-function --function-name lambda-cognito-delete

# 환경 변수 확인
aws lambda get-function-configuration \
  --function-name lambda-cognito-delete \
  --query 'Environment'

# 로그 확인
aws logs tail /aws/lambda/lambda-cognito-delete --follow

# EventBridge Rule 확인
aws events describe-rule --name lambda-cognito-delete-warmup-rule
```

### 테스트:
```bash
# Lambda warm-up 테스트
aws lambda invoke \
  --function-name lambda-cognito-delete \
  --payload '{"source":"aws.events","detail-type":"Scheduled Event","detail":{"warmup":true}}' \
  response.json

cat response.json
```

---

## 📊 권장 배포 전략

### 개발 환경:
- **방법 1** (로컬 파일) 사용
- 빠른 테스트와 반복 개발에 적합

### 스테이징/프로덕션:
- **방법 2** (CI/CD) 사용
- 자동화되고 안전한 배포
- 롤백 가능
- 배포 이력 추적

---

## 🚨 트러블슈팅

### Pod이 시작되지 않는 경우:
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>

# ConfigMap 값 확인
kubectl get configmap fproject-backend-config -o yaml

# Secret 존재 확인
kubectl get secret fproject-backend-secret
```

### Lambda가 동작하지 않는 경우:
```bash
# 환경 변수 확인
aws lambda get-function-configuration \
  --function-name lambda-cognito-delete

# 최근 로그 확인
aws logs tail /aws/lambda/lambda-cognito-delete --since 10m
```

### EventBridge warm-up이 동작하지 않는 경우:
```bash
# Rule 상태 확인
aws events describe-rule --name lambda-cognito-delete-warmup-rule

# Target 확인
aws events list-targets-by-rule --rule lambda-cognito-delete-warmup-rule

# Lambda 권한 확인
aws lambda get-policy --function-name lambda-cognito-delete
```

---

## 📝 요약

**현재 상태:**
- ✅ Git에는 안전한 placeholder 버전
- ✅ 로컬에는 실제 값이 있는 `*.local.yaml` 파일들
- ✅ CI/CD 예시 파일 준비됨

**다음 단계:**
1. 개발/테스트: `kubectl apply -f k8s/*.local.yaml` 사용
2. 프로덕션: GitHub Actions 설정 후 자동 배포
3. Lambda: 환경 변수 설정 후 코드 업데이트

**Git Push:**
```bash
# 안전하게 push 가능 (*.local.yaml은 제외됨)
git add .
git commit -m "feat: Add EventBridge warm-up and secure deployment"
git push origin main
```
