# 한국 리전 마이그레이션 가이드

버지니아(us-east-1)에서 한국(ap-northeast-2)으로 백엔드를 마이그레이션하는 가이드입니다.

## 아키텍처 변경사항

### Before (버지니아)
```
CloudFront → NLB → EKS NodePort (31663) → Backend Pods
```

### After (한국)
```
Route53 → ALB (Ingress) → EKS ClusterIP → Backend Pods
```

## 사전 준비사항

### 1. 한국 리전 인프라 확인
- ✅ EKS 클러스터 생성됨
- ✅ AWS Load Balancer Controller 설치됨
- ⚠️ RDS (PostgreSQL) 생성 필요
- ⚠️ Cognito User Pool 생성 필요
- ⚠️ S3 버킷 생성 필요
- ⚠️ ACM 인증서 생성 필요 (HTTPS용)
- ⚠️ ECR 리포지토리 생성 필요

### 2. 필요한 AWS 리소스 ARN/ID 수집

다음 정보를 수집하여 설정 파일에 입력해야 합니다:

```bash
# EKS 클러스터 이름
YOUR-KOREA-EKS-CLUSTER-NAME

# RDS 엔드포인트
YOUR-KOREA-RDS-ENDPOINT.ap-northeast-2.rds.amazonaws.com

# Cognito
YOUR-KOREA-USER-POOL-ID
YOUR-KOREA-CLIENT-ID

# S3 버킷
YOUR-KOREA-S3-BUCKET

# ACM 인증서 ARN (HTTPS용)
arn:aws:acm:ap-northeast-2:324547056370:certificate/YOUR-CERT-ID

# IAM Role ARN (IRSA용)
arn:aws:iam::324547056370:role/YOUR-BACKEND-ROLE
```

## 마이그레이션 단계

### Step 1: ECR 리포지토리 생성

```bash
aws ecr create-repository \
  --repository-name fproject-dev-api \
  --region ap-northeast-2
```

### Step 2: ConfigMap 수정

`k8s/configmap.yaml` 파일에서 다음 값들을 한국 리전 리소스로 변경:

```yaml
data:
  DB_HOST: "YOUR-KOREA-RDS-ENDPOINT.ap-northeast-2.rds.amazonaws.com"
  AWS_REGION: "ap-northeast-2"
  AWS_USER_POOL_ID: "YOUR-KOREA-USER-POOL-ID"
  AWS_CLIENT_ID: "YOUR-KOREA-CLIENT-ID"
  S3_BUCKET: "YOUR-KOREA-S3-BUCKET"
  FRONTEND_URL: "https://YOUR-KOREA-DOMAIN.com"  # 한국 프론트엔드 도메인
```

### Step 3: Ingress 수정

`k8s/ingress.yaml` 파일에서 ACM 인증서 ARN 추가:

```yaml
metadata:
  annotations:
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:324547056370:certificate/YOUR-CERT-ID
```

### Step 4: ServiceAccount 수정

`k8s/serviceaccount.yaml` 파일에서 IAM Role ARN 변경:

```yaml
metadata:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::324547056370:role/YOUR-BACKEND-ROLE
```

### Step 5: SecretProviderClass 수정

`k8s/secret-provider-class.yaml` 파일에서 Secrets Manager 이름과 리전 변경:

```yaml
spec:
  parameters:
    region: ap-northeast-2
    objects: |
      - objectName: "fproject-backend-secrets-korea"  # 한국 리전 Secret 이름
```

### Step 6: 배포 스크립트 수정

`k8s/deploy-korea.ps1` 또는 `k8s/deploy-korea.sh` 파일에서:

```powershell
$EKS_CLUSTER_NAME = "YOUR-KOREA-EKS-CLUSTER-NAME"
```

### Step 7: AWS Secrets Manager에 Secret 생성

```bash
aws secretsmanager create-secret \
  --name fproject-backend-secrets-korea \
  --region ap-northeast-2 \
  --secret-string '{
    "DB_PASSWORD": "your-db-password",
    "AWS_ACCESS_KEY_ID": "your-access-key",
    "AWS_SECRET_ACCESS_KEY": "your-secret-key"
  }'
```

### Step 8: CI/CD 설정

#### Option A: ArgoCD 사용 (권장)

1. GitHub Actions CI 설정:
```bash
# .github/workflows/deploy-korea.yml에서 클러스터 이름 변경
EKS_CLUSTER_NAME: YOUR-KOREA-EKS-CLUSTER-NAME
```

2. GitHub Secrets 설정:
```bash
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
```

3. 팀원이 ArgoCD Application 생성 (자세한 내용은 ARGOCD-KOREA-SETUP.md 참고)

4. 코드 푸시하면 자동 배포:
```bash
git push origin main
```

#### Option B: 수동 배포

```powershell
# PowerShell
cd auth/k8s
.\deploy-korea.ps1
```

또는

```bash
# Bash
cd auth/k8s
chmod +x deploy-korea.sh
./deploy-korea.sh
```

### Step 9: ALB URL 확인

```bash
kubectl get ingress fproject-backend-ingress
```

출력 예시:
```
NAME                        CLASS   HOSTS   ADDRESS                                                                  PORTS   AGE
fproject-backend-ingress    alb     *       k8s-default-fproject-xxxxxxxxxx-yyyyyyyyyy.ap-northeast-2.elb.amazonaws.com   80, 443   5m
```

### Step 10: Route53에 도메인 연결

ALB URL을 Route53 A 레코드(Alias)로 연결:

```bash
# AWS 콘솔에서 수동으로 설정하거나 CLI 사용
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR-HOSTED-ZONE-ID \
  --change-batch file://route53-change.json
```

## 주요 변경사항 요약

| 항목 | 버지니아 (Before) | 한국 (After) |
|------|------------------|--------------|
| 로드밸런서 | NLB (수동 생성) | ALB (Ingress 자동 생성) |
| Service Type | NodePort (31663) | ClusterIP |
| 라우팅 | CloudFront → NLB → NodePort | Route53 → ALB → ClusterIP |
| 리전 | us-east-1 | ap-northeast-2 |
| ECR | us-east-1 | ap-northeast-2 |
| SSL/TLS | CloudFront | ALB (ACM) |

## 트러블슈팅

### ALB가 생성되지 않는 경우

```bash
# ALB Controller 로그 확인
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Ingress 이벤트 확인
kubectl describe ingress fproject-backend-ingress
```

### Pod가 시작되지 않는 경우

```bash
# Pod 상태 확인
kubectl get pods -l app=fproject-backend

# Pod 로그 확인
kubectl logs -l app=fproject-backend

# Pod 이벤트 확인
kubectl describe pod -l app=fproject-backend
```

### Health Check 실패

```bash
# Pod 내부에서 health check 테스트
kubectl exec -it <pod-name> -- curl http://localhost:3000/auth/health
```

## 롤백 계획

문제 발생 시 버지니아 리전으로 롤백:

1. Route53에서 도메인을 다시 CloudFront로 변경
2. 한국 리전 리소스는 유지 (비용 발생 주의)
3. 문제 해결 후 재시도

## 비용 최적화

- ALB는 시간당 비용 발생 ($0.0225/hour in ap-northeast-2)
- NodePort 대신 ClusterIP 사용으로 노드 포트 절약
- Target Type을 'ip'로 설정하여 직접 Pod 라우팅 (성능 향상)
