# Kubernetes Configuration

## ⚠️ Security Notice

**DO NOT commit actual secrets to Git!**

This directory contains Kubernetes manifests with placeholder values. Replace them in your CI/CD pipeline or use proper secret management solutions.

## Recommended Secret Management Solutions

### Option 1: AWS Secrets Manager + External Secrets Operator (권장)

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace

# Create SecretStore
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: default
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
EOF

# Create ExternalSecret
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: fproject-backend-secret
  namespace: default
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: fproject-backend-secret
    creationPolicy: Owner
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: fproject/db-password
  - secretKey: GOOGLE_CLIENT_SECRET
    remoteRef:
      key: fproject/google-client-secret
EOF
```

### Option 2: Sealed Secrets

```bash
# Install Sealed Secrets Controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Install kubeseal CLI
brew install kubeseal  # macOS
# or download from: https://github.com/bitnami-labs/sealed-secrets/releases

# Create sealed secret
kubectl create secret generic fproject-backend-secret \
  --from-literal=DB_PASSWORD=your_password \
  --from-literal=GOOGLE_CLIENT_SECRET=your_secret \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Commit sealed-secret.yaml to Git (safe!)
git add sealed-secret.yaml
```

### Option 3: CI/CD Pipeline Injection (간단한 방법)

**GitHub Actions 예시:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to EKS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name your-cluster-name
      
      - name: Replace placeholders in ConfigMap
        run: |
          sed -i "s|REPLACE_WITH_YOUR_RDS_ENDPOINT|${{ secrets.DB_HOST }}|g" k8s/configmap.yaml
          sed -i "s|REPLACE_WITH_YOUR_USER_POOL_ID|${{ secrets.AWS_USER_POOL_ID }}|g" k8s/configmap.yaml
          sed -i "s|REPLACE_WITH_YOUR_CLIENT_ID|${{ secrets.AWS_CLIENT_ID }}|g" k8s/configmap.yaml
          sed -i "s|REPLACE_WITH_YOUR_S3_BUCKET|${{ secrets.S3_BUCKET }}|g" k8s/configmap.yaml
          sed -i "s|https://your-domain.com|${{ secrets.FRONTEND_URL }}|g" k8s/configmap.yaml
      
      - name: Create Secret
        run: |
          kubectl create secret generic fproject-backend-secret \
            --from-literal=DB_PASSWORD=${{ secrets.DB_PASSWORD }} \
            --from-literal=GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }} \
            --dry-run=client -o yaml | kubectl apply -f -
      
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/configmap.yaml
          kubectl apply -f k8s/deployment.yaml
          kubectl apply -f k8s/service.yaml
```

**GitLab CI 예시:**

```yaml
# .gitlab-ci.yml
deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config set-cluster k8s --server="${KUBE_URL}" --insecure-skip-tls-verify=true
    - kubectl config set-credentials admin --token="${KUBE_TOKEN}"
    - kubectl config set-context default --cluster=k8s --user=admin
    - kubectl config use-context default
    
    # Replace placeholders
    - sed -i "s|REPLACE_WITH_YOUR_RDS_ENDPOINT|${DB_HOST}|g" k8s/configmap.yaml
    - sed -i "s|REPLACE_WITH_YOUR_USER_POOL_ID|${AWS_USER_POOL_ID}|g" k8s/configmap.yaml
    - sed -i "s|REPLACE_WITH_YOUR_CLIENT_ID|${AWS_CLIENT_ID}|g" k8s/configmap.yaml
    
    # Create secret
    - kubectl create secret generic fproject-backend-secret
        --from-literal=DB_PASSWORD=${DB_PASSWORD}
        --from-literal=GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy
    - kubectl apply -f k8s/
  only:
    - main
```

## Environment-Specific Configurations

### Using Kustomize (권장)

```bash
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   └── configmap.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   └── configmap.yaml
│   └── prod/
│       ├── kustomization.yaml
│       └── configmap.yaml
```

**Deploy:**
```bash
# Development
kubectl apply -k k8s/overlays/dev

# Production
kubectl apply -k k8s/overlays/prod
```

## Lambda Environment Variables

Lambda 함수의 환경 변수는 AWS Console, Terraform, 또는 CloudFormation에서 설정하세요:

```bash
# AWS CLI로 Lambda 환경 변수 설정
aws lambda update-function-configuration \
  --function-name lambda-cognito-delete \
  --environment "Variables={
    USER_POOL_ID=us-east-1_xxxxxxxx,
    DB_HOST=your-rds-endpoint.rds.amazonaws.com,
    DB_NAME=fproject_db,
    DB_USER=fproject_user,
    DB_PASSWORD=your_secure_password,
    DB_PORT=5432
  }"
```

## Security Best Practices

1. ✅ **절대 Git에 커밋하지 말 것:**
   - 실제 비밀번호
   - API 키
   - AWS Access Key
   - Private 토큰

2. ✅ **사용할 것:**
   - AWS Secrets Manager
   - External Secrets Operator
   - Sealed Secrets
   - CI/CD 환경 변수

3. ✅ **정기적으로 로테이션:**
   - DB 비밀번호
   - API 키
   - OAuth 시크릿

4. ✅ **최소 권한 원칙:**
   - IAM Role 사용
   - Service Account 권한 제한
   - Network Policy 적용

## Deployment

```bash
# ConfigMap 적용
kubectl apply -f k8s/configmap.yaml

# Secret 적용 (실제 값으로 교체 후)
kubectl apply -f k8s/secret.yaml

# Deployment 적용
kubectl apply -f k8s/deployment.yaml

# Service 적용
kubectl apply -f k8s/service.yaml

# 전체 적용
kubectl apply -f k8s/
```

## Verification

```bash
# Pod 상태 확인
kubectl get pods -l app=fproject-backend

# 로그 확인
kubectl logs -f deployment/fproject-backend

# Secret 확인 (값은 보이지 않음)
kubectl get secret fproject-backend-secret

# ConfigMap 확인
kubectl get configmap fproject-backend-config -o yaml
```
