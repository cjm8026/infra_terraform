# 🔒 Git Push 전 보안 체크리스트

## ✅ 현재 상태: 안전함

모든 민감한 정보가 제거되었고 placeholder로 교체되었습니다.

### 확인 완료 항목:

#### 1. Lambda 함수 (`lambda_cognito_delete.py`)
- ✅ 하드코딩된 비밀번호 제거됨
- ✅ RDS 엔드포인트 제거됨
- ✅ Cognito Pool ID 제거됨
- ✅ 모든 값이 환경 변수로 처리됨

#### 2. Kubernetes Secret (`k8s/secret.yaml`)
- ✅ 실제 비밀번호 제거됨
- ✅ Placeholder로 교체됨
- ✅ `.gitignore`에 추가됨 (실수로 커밋 방지)

#### 3. Kubernetes ConfigMap (`k8s/configmap.yaml`)
- ✅ RDS 엔드포인트 → `REPLACE_WITH_YOUR_RDS_ENDPOINT`
- ✅ Cognito Pool ID → `REPLACE_WITH_YOUR_USER_POOL_ID`
- ✅ Client ID → `REPLACE_WITH_YOUR_CLIENT_ID`
- ✅ S3 Bucket → `REPLACE_WITH_YOUR_S3_BUCKET`
- ✅ Domain → `https://your-domain.com`

#### 4. Kubernetes Deployment (`k8s/deployment.yaml`)
- ✅ AWS Account ID 제거됨
- ✅ ECR 이미지 URL placeholder로 교체됨

#### 5. `.gitignore`
- ✅ `k8s/secret.yaml` 추가됨
- ✅ `lambda_function.zip` 추가됨
- ✅ `.env` 파일들 포함됨

## 📋 Git Push 전 최종 확인

```bash
# 1. 민감한 정보 검색
git grep -i "password\|secret\|key" | grep -v "REPLACE\|placeholder\|example"

# 2. AWS 계정 ID 검색
git grep -E "[0-9]{12}"

# 3. RDS 엔드포인트 검색
git grep -E "\.rds\.amazonaws\.com"

# 4. Cognito Pool ID 검색
git grep -E "us-east-1_[a-zA-Z0-9]+"

# 5. Base64 인코딩된 값 검색
git grep -E "^[A-Za-z0-9+/]{20,}={0,2}$"

# 6. 커밋할 파일 확인
git status

# 7. 변경 내용 확인
git diff
```

## 🚀 안전한 배포 방법

### GitHub Actions 사용 시:

1. **GitHub Secrets 설정** (Settings → Secrets and variables → Actions)
   ```
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   DB_HOST
   DB_PASSWORD
   AWS_USER_POOL_ID
   AWS_CLIENT_ID
   S3_BUCKET
   FRONTEND_URL
   GOOGLE_CLIENT_SECRET
   ```

2. **워크플로우 파일 사용**
   - `.github/workflows/deploy-example.yml` 참고
   - 실제 사용 시 `deploy.yml`로 복사

### AWS에서 직접 설정 시:

```bash
# Lambda 환경 변수 설정
aws lambda update-function-configuration \
  --function-name lambda-cognito-delete \
  --environment "Variables={
    USER_POOL_ID=실제값,
    DB_HOST=실제값,
    DB_NAME=실제값,
    DB_USER=실제값,
    DB_PASSWORD=실제값,
    DB_PORT=5432
  }"

# Kubernetes Secret 생성
kubectl create secret generic fproject-backend-secret \
  --from-literal=DB_PASSWORD=실제값 \
  --from-literal=GOOGLE_CLIENT_SECRET=실제값

# ConfigMap 수정 후 적용
# k8s/configmap.yaml의 placeholder를 실제 값으로 교체
kubectl apply -f k8s/configmap.yaml
```

## ⚠️ 절대 커밋하면 안 되는 것들

- ❌ 실제 비밀번호
- ❌ AWS Access Key / Secret Key
- ❌ API 키
- ❌ OAuth Client Secret
- ❌ Private 토큰
- ❌ 인증서 파일 (.pem, .key)
- ❌ 데이터베이스 연결 문자열 (비밀번호 포함)
- ❌ AWS Account ID (가능하면)
- ❌ RDS 엔드포인트 (가능하면)

## 🔍 만약 실수로 커밋했다면?

### 1. 아직 Push 안 했을 때:
```bash
# 마지막 커밋 취소
git reset --soft HEAD~1

# 파일 수정 후 다시 커밋
git add .
git commit -m "Fix: Remove sensitive information"
```

### 2. 이미 Push 했을 때:
```bash
# ⚠️ 주의: 이미 노출된 정보는 무효화해야 함!

# 1. 즉시 비밀번호/키 변경
# 2. Git history에서 제거
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch k8s/secret.yaml" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (팀원과 조율 필요)
git push origin --force --all

# 4. BFG Repo-Cleaner 사용 (더 쉬운 방법)
# https://rtyley.github.io/bfg-repo-cleaner/
```

### 3. Public Repository에 노출되었을 때:
1. **즉시 모든 비밀번호/키 변경**
2. **AWS IAM 키 무효화**
3. **데이터베이스 비밀번호 변경**
4. **OAuth Client Secret 재생성**
5. **Git history 완전 삭제 또는 Repository 삭제 후 재생성**

## 📚 추가 보안 도구

### 1. git-secrets (AWS)
```bash
# 설치
brew install git-secrets  # macOS
# or
git clone https://github.com/awslabs/git-secrets.git

# 설정
git secrets --install
git secrets --register-aws

# 스캔
git secrets --scan
```

### 2. gitleaks
```bash
# 설치
brew install gitleaks  # macOS

# 스캔
gitleaks detect --source . --verbose
```

### 3. truffleHog
```bash
# 설치
pip install truffleHog

# 스캔
trufflehog --regex --entropy=True .
```

### 4. Pre-commit Hook
```bash
# .git/hooks/pre-commit 파일 생성
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# 민감한 정보 검색
if git diff --cached | grep -iE "password.*=.*['\"].*['\"]|secret.*=.*['\"].*['\"]"; then
    echo "❌ Error: Potential password or secret found in commit!"
    echo "Please remove sensitive information before committing."
    exit 1
fi

echo "✅ Security check passed"
exit 0
EOF

chmod +x .git/hooks/pre-commit
```

## ✅ 최종 확인

현재 상태로 **안전하게 Git Push 가능**합니다!

```bash
git add .
git commit -m "feat: Add EventBridge Lambda warm-up and secure configuration"
git push origin main
```

## 📞 문제 발생 시

1. 민감한 정보가 노출되었다면 즉시 변경
2. AWS CloudTrail에서 의심스러운 활동 확인
3. 필요시 AWS Support 연락
