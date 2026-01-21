# 새 레포지토리 설정 가이드 (한국 리전용)

## 개요

한국 리전 전용 새 레포지토리를 만들어 배포하는 가이드입니다.
- 버지니아 레포: 백업용으로 유지
- 한국 레포: 새로 생성하여 한국 리전 배포

## 1. 새 레포지토리 생성

### GitHub에서 레포지토리 생성

```bash
# 예시 이름
fproject-backend-korea
```

## 2. 로컬에서 새 레포지토리로 푸시

### Option A: auth 폴더만 새 레포로 이동

```bash
# 현재 auth 폴더로 이동
cd auth

# 기존 git 연결 제거
rm -rf .git

# 새 git 초기화
git init
git add .
git commit -m "Initial commit for Korea region"

# 새 레포지토리 연결
git remote add origin https://github.com/YOUR-USERNAME/fproject-backend-korea.git
git branch -M main
git push -u origin main
```

### Option B: 전체 프로젝트를 복사하여 새 레포 생성

```bash
# 현재 위치에서 auth 폴더를 다른 곳으로 복사
cp -r auth ../fproject-backend-korea
cd ../fproject-backend-korea

# git 초기화
git init
git add .
git commit -m "Initial commit for Korea region"

# 새 레포지토리 연결
git remote add origin https://github.com/YOUR-USERNAME/fproject-backend-korea.git
git branch -M main
git push -u origin main
```

## 3. 새 레포지토리 파일 구조

새 레포에는 다음 파일들만 포함:

```
fproject-backend-korea/
├── .github/
│   └── workflows/
│       └── deploy.yml  (deploy-korea.yml을 deploy.yml로 이름 변경)
├── k8s/
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── ingress.yaml
│   ├── service.yaml
│   ├── serviceaccount.yaml
│   └── secret-provider-class.yaml
├── src/
├── server/
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## 4. 워크플로우 파일 정리

새 레포에서는 `deploy-korea.yml`을 `deploy.yml`로 이름 변경:

```bash
cd .github/workflows
mv deploy-korea.yml deploy.yml
```

또는 새 레포 생성 시 처음부터 `deploy.yml`로 생성

## 5. GitHub Secrets 설정

새 레포지토리에 Secrets 추가:

```bash
# 새 레포지토리로 이동 후
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
```

필요한 Secrets:
- `AWS_ACCESS_KEY_ID` - 한국 리전 ECR 푸시 권한
- `AWS_SECRET_ACCESS_KEY` - 한국 리전 ECR 푸시 권한

## 6. 워크플로우 설정 확인

`.github/workflows/deploy.yml` 파일에서 확인:

```yaml
env:
  AWS_REGION: ap-northeast-2  # 한국 리전
  ECR_REPOSITORY: fproject-dev-api
  EKS_CLUSTER_NAME: YOUR-KOREA-EKS-CLUSTER-NAME  # 실제 클러스터 이름으로 변경
```

## 7. ConfigMap 설정

`k8s/configmap.yaml`에서 한국 리전 리소스 정보 입력:

```yaml
data:
  DB_HOST: "YOUR-KOREA-RDS-ENDPOINT.ap-northeast-2.rds.amazonaws.com"
  AWS_REGION: "ap-northeast-2"
  AWS_USER_POOL_ID: "YOUR-KOREA-USER-POOL-ID"
  AWS_CLIENT_ID: "YOUR-KOREA-CLIENT-ID"
  S3_BUCKET: "YOUR-KOREA-S3-BUCKET"
  FRONTEND_URL: "https://YOUR-KOREA-DOMAIN.com"
```

## 8. Ingress 설정

`k8s/ingress.yaml`에서 ACM 인증서 ARN 추가:

```yaml
metadata:
  annotations:
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:324547056370:certificate/YOUR-CERT-ID
```

## 9. ArgoCD 연결

팀원에게 새 레포지토리 정보 전달:

```yaml
source:
  repoURL: https://github.com/YOUR-USERNAME/fproject-backend-korea.git
  targetRevision: main
  path: k8s  # auth/k8s가 아니라 k8s (루트에서 바로 k8s 폴더)
```

## 10. 첫 배포 테스트

```bash
# 코드 수정
git add .
git commit -m "test: First deployment to Korea"
git push origin main
```

GitHub Actions에서 자동으로:
1. Docker 이미지 빌드
2. 한국 리전 ECR에 푸시
3. k8s/deployment.yaml 이미지 태그 업데이트
4. Git 커밋 & 푸시

ArgoCD가 자동으로:
1. Git 변경 감지
2. EKS에 배포

## 11. 배포 확인

```bash
# kubectl 설정
aws eks update-kubeconfig --region ap-northeast-2 --name YOUR-KOREA-EKS-CLUSTER-NAME

# Pod 확인
kubectl get pods -l app=fproject-backend

# Ingress 확인
kubectl get ingress fproject-backend-ingress

# ALB URL 확인
kubectl get ingress fproject-backend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## 레포지토리 비교

| 항목 | 버지니아 레포 (백업) | 한국 레포 (신규) |
|------|---------------------|-----------------|
| 용도 | 백업 | 프로덕션 |
| 리전 | us-east-1 | ap-northeast-2 |
| 워크플로우 | deploy.yml (버지니아) | deploy.yml (한국) |
| 로드밸런서 | NLB | ALB (Ingress) |
| CD | 수동 또는 ArgoCD | ArgoCD |
| 활성 배포 | ❌ | ✅ |

## 주의사항

1. **두 레포지토리 동기화 안 함**
   - 각각 독립적으로 관리
   - 버지니아는 백업용으로만 유지

2. **ECR 리포지토리 분리**
   - 버지니아: `324547056370.dkr.ecr.us-east-1.amazonaws.com/fproject-dev-api`
   - 한국: `324547056370.dkr.ecr.ap-northeast-2.amazonaws.com/fproject-dev-api`

3. **Secrets Manager 분리**
   - 버지니아: `fproject-backend-secrets`
   - 한국: `fproject-backend-secrets-korea` (권장)

## 롤백 계획

문제 발생 시:
1. Route53에서 도메인을 버지니아 NLB로 변경
2. 한국 레포는 유지하고 문제 해결
3. 해결 후 다시 한국으로 전환

## 체크리스트

새 레포 설정 전:
- [ ] 새 GitHub 레포지토리 생성
- [ ] 한국 리전 ECR 리포지토리 생성
- [ ] 한국 리전 RDS 준비
- [ ] 한국 리전 Cognito 준비
- [ ] 한국 리전 S3 버킷 준비
- [ ] 한국 리전 ACM 인증서 준비
- [ ] 한국 리전 EKS 클러스터 준비
- [ ] AWS Load Balancer Controller 설치

새 레포 설정:
- [ ] auth 폴더를 새 레포로 푸시
- [ ] GitHub Secrets 설정
- [ ] ConfigMap 리전 정보 업데이트
- [ ] Ingress ACM 인증서 설정
- [ ] 워크플로우 EKS 클러스터 이름 설정
- [ ] 팀원에게 ArgoCD 설정 요청
- [ ] 첫 배포 테스트
