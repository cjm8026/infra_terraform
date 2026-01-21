# ArgoCD 한국 리전 설정 가이드

## 개요

한국 리전에서 GitOps 방식으로 배포하기 위한 가이드입니다.
- **CI (GitHub Actions)**: 이미지 빌드 & ECR 푸시 & 매니페스트 업데이트
- **CD (ArgoCD)**: Git 변경 감지 & EKS 자동 배포

## 아키텍처

```
GitHub Push
    ↓
GitHub Actions (CI)
    ├─ Docker Build
    ├─ ECR Push (ap-northeast-2)
    └─ Update k8s/deployment.yaml (image tag)
    ↓
Git Commit & Push
    ↓
ArgoCD (CD) - 팀원이 설정
    ├─ Git 변경 감지
    ├─ Sync 트리거
    └─ EKS 배포 (ap-northeast-2)
```

## 당신이 준비한 것 (완료)

### 1. Kubernetes 매니페스트
- ✅ `k8s/deployment.yaml` - 한국 리전 ECR 이미지 경로
- ✅ `k8s/service.yaml` - ClusterIP 타입
- ✅ `k8s/ingress.yaml` - ALB 자동 생성
- ✅ `k8s/configmap.yaml` - 한국 리전 설정
- ✅ `k8s/serviceaccount.yaml` - IRSA 설정
- ✅ `k8s/secret-provider-class.yaml` - Secrets Manager 연동

### 2. CI 파이프라인
- ✅ `.github/workflows/deploy-korea.yml` - 한국 리전 ECR 푸시

## 팀원이 해야 할 것 (ArgoCD 설정)

### 1. ArgoCD Application 생성

팀원에게 전달할 정보:

```yaml
# ArgoCD Application 설정 정보
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fproject-backend-korea
  namespace: argocd
spec:
  project: default
  
  source:
    repoURL: https://github.com/YOUR-ORG/YOUR-REPO.git  # Git 리포지토리
    targetRevision: main  # 또는 develop
    path: auth/k8s  # 매니페스트 경로
  
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### 2. 필요한 정보

팀원에게 다음 정보를 전달하세요:

| 항목 | 값 |
|------|-----|
| Git Repository | `https://github.com/YOUR-ORG/YOUR-REPO.git` |
| Branch | `main` 또는 `develop` |
| Manifest Path | `auth/k8s` |
| Target Namespace | `default` |
| Sync Policy | Automated (prune: true, selfHeal: true) |

### 3. Secret 관리

ArgoCD는 Secret을 동기화하지 않도록 설정해야 합니다 (CSI Driver 사용):

```yaml
ignoreDifferences:
- group: ""
  kind: Secret
  name: fproject-backend-secret
  jsonPointers:
  - /data
```

## 배포 프로세스

### 1. 코드 변경 & Push

```bash
# 코드 수정
git add .
git commit -m "feat: Add new feature"
git push origin main
```

### 2. GitHub Actions 자동 실행

- Docker 이미지 빌드
- ECR에 푸시 (ap-northeast-2)
- `k8s/deployment.yaml`의 이미지 태그 업데이트
- Git에 커밋 & 푸시

### 3. ArgoCD 자동 배포

- Git 변경 감지 (약 3분 간격)
- 또는 수동 Sync
- EKS에 배포

### 4. 배포 확인

```bash
# ArgoCD UI에서 확인
# 또는 kubectl로 확인
kubectl get pods -l app=fproject-backend
kubectl get ingress fproject-backend-ingress
```

## GitHub Secrets 설정

팀원이 ArgoCD를 설정하기 전에 GitHub Secrets를 먼저 설정하세요:

```bash
# GitHub CLI 사용
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
```

필요한 Secrets:
- `AWS_ACCESS_KEY_ID` - ECR 푸시 권한
- `AWS_SECRET_ACCESS_KEY` - ECR 푸시 권한

## 워크플로우 수정 필요 사항

`.github/workflows/deploy-korea.yml` 파일에서:

```yaml
env:
  EKS_CLUSTER_NAME: YOUR-KOREA-EKS-CLUSTER-NAME  # 실제 클러스터 이름으로 변경
```

## 트러블슈팅

### ArgoCD가 변경을 감지하지 못하는 경우

```bash
# ArgoCD에서 수동 Refresh
argocd app get fproject-backend-korea
argocd app sync fproject-backend-korea
```

### 이미지 태그가 업데이트되지 않는 경우

GitHub Actions 로그 확인:
1. Repository → Actions
2. 최근 워크플로우 실행 확인
3. "Update deployment manifest" 단계 확인

### Pod가 시작되지 않는 경우

```bash
# Pod 상태 확인
kubectl get pods -l app=fproject-backend

# Pod 로그 확인
kubectl logs -l app=fproject-backend

# 이벤트 확인
kubectl describe pod -l app=fproject-backend
```

## 팀원과 협업 체크리스트

당신이 완료한 것:
- [x] k8s 매니페스트 준비 (auth/k8s/)
- [x] GitHub Actions CI 설정
- [x] 한국 리전 설정 업데이트
- [x] Ingress (ALB) 설정
- [x] GitHub Secrets 설정

팀원이 해야 할 것:
- [ ] ArgoCD Application 생성
- [ ] Git Repository 연결
- [ ] Sync Policy 설정
- [ ] Secret 동기화 제외 설정
- [ ] 첫 배포 테스트

## 참고 자료

- [ArgoCD 공식 문서](https://argo-cd.readthedocs.io/)
- [GitOps 패턴](https://www.gitops.tech/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
