# CI/CD 설정 가이드

## 🎯 개요

이 프로젝트는 GitHub Actions를 사용하여 자동 배포됩니다.
- **Kubernetes (EKS)**: 백엔드 API 서버
- **Lambda**: Cognito 사용자 삭제 함수
- **EventBridge**: Lambda warm-up 스케줄러

## 📋 사전 준비

### 1. GitHub Secrets 설정

Repository → Settings → Secrets and variables → Actions → New repository secret

#### 필수 Secrets:

| Secret 이름 | 설명 | 예시 값 |
|------------|------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Key | `wJalrXUtn...` |
| `EKS_CLUSTER_NAME` | EKS 클러스터 이름 | `my-eks-cluster` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | `test1234` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | `GOCSPX-...` |

#### Secrets 추가 방법:

```bash
# GitHub CLI 사용 (권장)
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
gh secret set EKS_CLUSTER_NAME
gh secret set DB_PASSWORD
gh secret set GOOGLE_CLIENT_SECRET

# 또는 GitHub 웹 UI에서 수동 추가
```

### 2. AWS IAM 권한 설정

CI/CD에서 사용할 IAM User에 다음 권한 필요:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:lambda-cognito-delete"
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:PutTargets",
        "events:DescribeRule",
        "events:ListTargetsByRule"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents"
      ],
      "Resource": "arn:aws:cloudformation:*:*:stack/lambda-warmup-stack/*"
    }
  ]
}
```

### 3. EKS 클러스터 접근 권한

CI/CD IAM User가 EKS 클러스터에 접근할 수 있도록 설정:

```bash
# EKS ConfigMap 수정
kubectl edit configmap aws-auth -n kube-system
```

다음 내용 추가:

```yaml
mapUsers: |
  - userarn: arn:aws:iam::324547056370:user/github-actions
    username: github-actions
    groups:
      - system:masters
```

## 🚀 배포 워크플로우

### 자동 배포 트리거

1. **main 브랜치에 push**
   ```bash
   git push origin main
   ```

2. **develop 브랜치에 push**
   ```bash
   git push origin develop
   ```

3. **수동 실행**
   - GitHub → Actions → Deploy to AWS → Run workflow

### 배포 단계

#### 1단계: Kubernetes 배포 (deploy-kubernetes)
- ✅ 코드 체크아웃
- ✅ AWS 인증
- ✅ Docker 이미지 빌드 & ECR 푸시
- ✅ EKS kubeconfig 업데이트
- ✅ Deployment 이미지 태그 업데이트
- ✅ Secret 생성 (GitHub Secrets에서)
- ✅ ConfigMap, Deployment, Service 배포
- ✅ Rollout 상태 확인

#### 2단계: Lambda 배포 (deploy-lambda)
- ✅ Python 의존성 설치
- ✅ Lambda 패키지 생성
- ✅ 함수 코드 업데이트
- ✅ 환경 변수 설정
- ✅ Warm-up 테스트

#### 3단계: EventBridge 설정 (setup-lambda-warmup)
- ✅ CloudFormation 스택 배포
- ✅ EventBridge Rule 생성/업데이트
- ✅ Lambda 권한 설정
- ✅ 5분 간격 warm-up 스케줄 설정

#### 4단계: 알림 (notify)
- ✅ 배포 결과 요약

## 📊 배포 모니터링

### GitHub Actions에서 확인

1. Repository → Actions 탭
2. 최근 워크플로우 실행 확인
3. 각 Job의 로그 확인

### 배포 상태 확인

```bash
# Kubernetes Pod 상태
kubectl get pods -l app=fproject-backend

# Deployment 상태
kubectl rollout status deployment/fproject-backend

# Service 확인
kubectl get svc fproject-backend

# 로그 확인
kubectl logs -f deployment/fproject-backend

# Lambda 함수 상태
aws lambda get-function --function-name lambda-cognito-delete

# Lambda 로그
aws logs tail /aws/lambda/lambda-cognito-delete --follow

# EventBridge Rule 상태
aws events describe-rule --name lambda-cognito-delete-warmup-rule
```

## 🔧 환경별 설정

### Development 환경

```yaml
# .github/workflows/deploy-dev.yml
on:
  push:
    branches: [develop]

env:
  EKS_CLUSTER_NAME: ${{ secrets.EKS_CLUSTER_NAME_DEV }}
  # ... 다른 dev 환경 변수
```

### Production 환경

```yaml
# .github/workflows/deploy-prod.yml
on:
  push:
    branches: [main]

env:
  EKS_CLUSTER_NAME: ${{ secrets.EKS_CLUSTER_NAME_PROD }}
  # ... 다른 prod 환경 변수
```

## 🚨 트러블슈팅

### 1. ECR 푸시 실패

**증상:** `denied: Your authorization token has expired`

**해결:**
```bash
# AWS credentials 확인
aws sts get-caller-identity

# ECR 로그인 재시도
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 324547056370.dkr.ecr.us-east-1.amazonaws.com
```

### 2. EKS 접근 권한 오류

**증상:** `error: You must be logged in to the server (Unauthorized)`

**해결:**
```bash
# aws-auth ConfigMap 확인
kubectl get configmap aws-auth -n kube-system -o yaml

# IAM User ARN 확인
aws sts get-caller-identity

# ConfigMap에 User 추가
kubectl edit configmap aws-auth -n kube-system
```

### 3. Secret 생성 실패

**증상:** `error: secret already exists`

**해결:**
```bash
# 기존 Secret 삭제
kubectl delete secret fproject-backend-secret

# 또는 워크플로우에서 apply 대신 create or replace 사용
kubectl create secret generic fproject-backend-secret --from-literal=... --dry-run=client -o yaml | kubectl apply -f -
```

### 4. Lambda 업데이트 실패

**증상:** `ResourceConflictException: The operation cannot be performed at this time`

**해결:**
- Lambda 함수가 업데이트 중일 수 있음
- 워크플로우에 `aws lambda wait function-updated` 추가됨

### 5. EventBridge Rule 생성 실패

**증상:** `Stack already exists`

**해결:**
- 워크플로우가 자동으로 update/create 판단
- 수동으로 스택 삭제 후 재시도:
  ```bash
  aws cloudformation delete-stack --stack-name lambda-warmup-stack
  ```

## 📈 배포 최적화

### 1. 캐싱 활용

```yaml
- name: Cache Docker layers
  uses: actions/cache@v3
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-buildx-
```

### 2. 병렬 실행

현재 워크플로우는 순차 실행:
- deploy-kubernetes → deploy-lambda → setup-lambda-warmup

병렬 실행으로 변경 가능:
```yaml
jobs:
  deploy-kubernetes:
    # ...
  
  deploy-lambda:
    # needs 제거하면 병렬 실행
    # ...
```

### 3. 조건부 배포

특정 파일 변경 시에만 배포:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'k8s/**'
      - 'lambda_cognito_delete.py'
      - 'Dockerfile'
```

## 🔐 보안 Best Practices

1. ✅ **GitHub Secrets 사용** - 민감한 정보는 절대 코드에 포함하지 않음
2. ✅ **최소 권한 원칙** - IAM User에 필요한 권한만 부여
3. ✅ **Short-lived credentials** - OIDC 사용 고려
4. ✅ **환경 분리** - Dev/Staging/Prod 환경 분리
5. ✅ **Audit logging** - CloudTrail로 모든 작업 기록

### OIDC 사용 (권장)

Access Key 대신 OIDC 사용:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: arn:aws:iam::324547056370:role/GitHubActionsRole
    aws-region: us-east-1
```

## 📝 체크리스트

배포 전 확인사항:

- [ ] GitHub Secrets 모두 설정됨
- [ ] AWS IAM 권한 설정됨
- [ ] EKS aws-auth ConfigMap 업데이트됨
- [ ] ECR Repository 존재함
- [ ] Lambda 함수 생성됨
- [ ] 로컬에서 테스트 완료
- [ ] Dockerfile 빌드 성공
- [ ] K8s manifests 유효성 검증

## 🎉 배포 완료 후

```bash
# 1. 애플리케이션 접속 확인
curl https://www.aws11.shop/health

# 2. Lambda 테스트
aws lambda invoke \
  --function-name lambda-cognito-delete \
  --payload '{"source":"aws.events","detail-type":"Scheduled Event","detail":{"warmup":true}}' \
  response.json

# 3. 로그 모니터링
kubectl logs -f deployment/fproject-backend
aws logs tail /aws/lambda/lambda-cognito-delete --follow

# 4. 메트릭 확인
kubectl top pods -l app=fproject-backend
```

## 📚 추가 자료

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [AWS EKS 문서](https://docs.aws.amazon.com/eks/)
- [AWS Lambda 문서](https://docs.aws.amazon.com/lambda/)
- [EventBridge 문서](https://docs.aws.amazon.com/eventbridge/)
