# Lambda 함수 생성 가이드

현재 CI/CD에서 Lambda 배포가 스킵되고 있습니다. Lambda 함수를 먼저 생성해야 합니다.

## 🚀 Lambda 함수 생성 방법

### 방법 1: AWS Console에서 생성 (가장 쉬움)

1. **AWS Console → Lambda → Functions → Create function**

2. **기본 정보 입력:**
   ```
   Function name: lambda-cognito-delete
   Runtime: Python 3.9
   Architecture: x86_64
   ```

3. **실행 역할 생성:**
   - "Create a new role with basic Lambda permissions" 선택
   - 또는 기존 역할 사용

4. **함수 생성 후 코드 업로드:**
   - 로컬에서 패키지 생성:
   ```bash
   pip install psycopg2-binary boto3 -t ./lambda-package
   cp lambda_cognito_delete.py ./lambda-package/
   cd lambda-package
   zip -r ../lambda_function.zip .
   cd ..
   ```
   
   - AWS Console에서 Upload from → .zip file → lambda_function.zip 선택

5. **환경 변수 설정:**
   ```
   USER_POOL_ID: us-east-1_oesTGe9D5
   DB_HOST: fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com
   DB_NAME: fproject_db
   DB_USER: fproject_user
   DB_PASSWORD: test1234
   DB_PORT: 5432
   ```

6. **IAM 권한 추가:**
   - Configuration → Permissions → Execution role 클릭
   - 다음 권한 추가:
     - `AmazonCognitoPowerUser` (Cognito 사용자 삭제용)
     - `AWSLambdaVPCAccessExecutionRole` (VPC 접근용, RDS 연결 시)

7. **VPC 설정 (RDS 연결 시 필요):**
   - Configuration → VPC
   - RDS와 같은 VPC, Subnet, Security Group 선택

---

### 방법 2: AWS CLI로 생성 (빠름)

```bash
# 1. 패키지 생성
pip install psycopg2-binary boto3 -t ./lambda-package
cp lambda_cognito_delete.py ./lambda-package/
cd lambda-package
zip -r ../lambda_function.zip .
cd ..

# 2. IAM Role 생성
aws iam create-role \
  --role-name lambda-cognito-delete-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# 3. 권한 연결
aws iam attach-role-policy \
  --role-name lambda-cognito-delete-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name lambda-cognito-delete-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser

# 4. Lambda 함수 생성
aws lambda create-function \
  --function-name lambda-cognito-delete \
  --runtime python3.9 \
  --role arn:aws:iam::324547056370:role/lambda-cognito-delete-role \
  --handler lambda_cognito_delete.lambda_handler \
  --zip-file fileb://lambda_function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={
    USER_POOL_ID=us-east-1_oesTGe9D5,
    DB_HOST=fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com,
    DB_NAME=fproject_db,
    DB_USER=fproject_user,
    DB_PASSWORD=test1234,
    DB_PORT=5432
  }"

# 5. VPC 설정 (RDS 연결 시)
aws lambda update-function-configuration \
  --function-name lambda-cognito-delete \
  --vpc-config SubnetIds=subnet-xxx,subnet-yyy,SecurityGroupIds=sg-xxx
```

---

### 방법 3: Terraform으로 생성

```bash
# terraform/lambda.tf 파일 생성 후
terraform init
terraform plan
terraform apply
```

---

## ✅ Lambda 함수 생성 후

### 1. 함수 테스트
```bash
# Warm-up 테스트
aws lambda invoke \
  --function-name lambda-cognito-delete \
  --payload '{"source":"aws.events","detail-type":"Scheduled Event","detail":{"warmup":true}}' \
  response.json

cat response.json
```

### 2. CI/CD 활성화

`.github/workflows/deploy.yml` 파일 수정:

```yaml
# 이 부분을 찾아서
if: false  # Lambda 함수 생성 후 true로 변경하세요

# 이렇게 변경
if: true  # Lambda 배포 활성화
```

또는 완전히 제거:
```yaml
  deploy-lambda:
    name: Deploy Lambda Function
    runs-on: ubuntu-latest
    needs: deploy-kubernetes
    # if: false 줄 삭제
```

### 3. Git Push
```bash
git add .github/workflows/deploy.yml
git commit -m "feat: Enable Lambda deployment in CI/CD"
git push origin main
```

---

## 🔍 Lambda 함수 확인

```bash
# 함수 존재 확인
aws lambda get-function --function-name lambda-cognito-delete

# 환경 변수 확인
aws lambda get-function-configuration \
  --function-name lambda-cognito-delete \
  --query 'Environment'

# 로그 확인
aws logs tail /aws/lambda/lambda-cognito-delete --follow
```

---

## 🚨 트러블슈팅

### psycopg2 에러
```bash
# Amazon Linux 2 환경용 psycopg2 사용
pip install psycopg2-binary --platform manylinux2014_x86_64 --only-binary=:all: -t ./lambda-package
```

### VPC 타임아웃
- Lambda가 RDS와 같은 VPC에 있는지 확인
- Security Group에서 Lambda → RDS 연결 허용 확인
- NAT Gateway 설정 확인 (외부 API 호출 시)

### 권한 에러
- IAM Role에 필요한 권한 추가
- Cognito: `cognito-idp:AdminDeleteUser`
- RDS: VPC 접근 권한
- CloudWatch Logs: 로그 작성 권한

---

## 📚 참고

Lambda 함수를 생성하지 않고 Kubernetes만 배포하려면:
- 현재 상태 그대로 사용 (Lambda 배포 스킵됨)
- Kubernetes 배포는 정상 작동함
