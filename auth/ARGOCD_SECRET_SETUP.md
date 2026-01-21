# ArgoCD Secret 관리 가이드

## 🚨 문제 상황

ArgoCD에서 다음 에러 발생:
```
illegal base64 data at input byte 11
```

**원인:** Secret의 `data` 필드에 base64가 아닌 일반 문자열이 들어있음

---

## ✅ 해결 방법

### 방법 1: stringData 사용 (임시 해결)

`k8s/secret.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: fproject-backend-secret
  namespace: default
type: Opaque
stringData:  # data 대신 stringData 사용
  DB_PASSWORD: "your_password"
  GOOGLE_CLIENT_SECRET: "your_secret"
```

→ Kubernetes가 자동으로 base64 인코딩

**단점:** 실제 비밀번호가 Git에 노출됨 (권장하지 않음)

---

### 방법 2: Sealed Secrets (권장) 🔐

**1. Sealed Secrets Controller 설치:**
```bash
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml
```

**2. kubeseal CLI 설치:**
```bash
# Windows (Chocolatey)
choco install kubeseal

# 또는 직접 다운로드
# https://github.com/bitnami-labs/sealed-secrets/releases
```

**3. Secret을 SealedSecret으로 변환:**
```bash
# 일반 Secret 생성 (Git에 커밋하지 않음)
kubectl create secret generic fproject-backend-secret \
  --from-literal=DB_PASSWORD=test1234 \
  --from-literal=GOOGLE_CLIENT_SECRET=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 \
  --dry-run=client -o yaml > secret-temp.yaml

# SealedSecret으로 암호화
kubeseal -f secret-temp.yaml -w k8s/sealed-secret.yaml

# 임시 파일 삭제
rm secret-temp.yaml
```

**4. Git에 커밋:**
```bash
git add k8s/sealed-secret.yaml
git commit -m "feat: Add sealed secret"
git push
```

**5. ArgoCD가 자동으로 배포:**
- SealedSecret → Secret으로 자동 변환
- 실제 값은 클러스터에만 존재

---

### 방법 3: External Secrets Operator (권장) 🔐

AWS Secrets Manager와 연동하여 Secret 관리

**1. External Secrets Operator 설치:**
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system --create-namespace
```

**2. AWS Secrets Manager에 Secret 저장:**
```bash
# DB Password 저장
aws secretsmanager create-secret \
  --name fproject/db-password \
  --secret-string "test1234"

# Google Client Secret 저장
aws secretsmanager create-secret \
  --name fproject/google-client-secret \
  --secret-string "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"
```

**3. SecretStore 생성:**
```yaml
# k8s/secret-store.yaml
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
```

**4. ExternalSecret 생성:**
```yaml
# k8s/external-secret.yaml
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
```

**5. Git에 커밋:**
```bash
git add k8s/secret-store.yaml k8s/external-secret.yaml
git commit -m "feat: Add external secrets"
git push
```

---

### 방법 4: ArgoCD에서 Secret 제외

Secret은 수동으로 관리하고 ArgoCD 동기화에서 제외

**ArgoCD Application 설정:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fproject-backend
spec:
  # ...
  syncPolicy:
    syncOptions:
    - CreateNamespace=true
  ignoreDifferences:
  - group: ""
    kind: Secret
    name: fproject-backend-secret
    jsonPointers:
    - /data
```

**수동으로 Secret 생성:**
```bash
kubectl create secret generic fproject-backend-secret \
  --from-literal=DB_PASSWORD=test1234 \
  --from-literal=GOOGLE_CLIENT_SECRET=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 \
  -n default
```

---

## 🔧 현재 에러 즉시 해결

**1. Git에서 secret.yaml 수정 (이미 완료):**
```yaml
stringData:  # data → stringData로 변경
  DB_PASSWORD: "PLACEHOLDER"
  GOOGLE_CLIENT_SECRET: "PLACEHOLDER"
```

**2. 실제 Secret은 클러스터에 직접 생성:**
```bash
kubectl create secret generic fproject-backend-secret \
  --from-literal=DB_PASSWORD=test1234 \
  --from-literal=GOOGLE_CLIENT_SECRET=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 \
  -n default \
  --dry-run=client -o yaml | kubectl apply -f -
```

**3. ArgoCD 재동기화:**
```bash
argocd app sync fproject-backend
```

---

## 📊 방법 비교

| 방법 | 보안 | 편의성 | 비용 | 권장도 |
|------|------|--------|------|--------|
| stringData | ❌ 낮음 | ✅ 높음 | 무료 | ❌ |
| Sealed Secrets | ✅ 높음 | ⭐ 중간 | 무료 | ✅✅ |
| External Secrets | ✅✅ 매우 높음 | ⭐⭐ 높음 | 유료 | ✅✅✅ |
| ArgoCD 제외 | ⭐ 중간 | ❌ 낮음 | 무료 | ⭐ |

---

## 🎯 권장 사항

### 개발 환경:
- **Sealed Secrets** 사용
- 간단하고 무료
- Git에 안전하게 커밋 가능

### 프로덕션:
- **External Secrets Operator** + AWS Secrets Manager
- 중앙 집중식 Secret 관리
- 자동 로테이션 가능
- 감사 로그 제공

---

## 🚨 절대 하지 말아야 할 것

❌ **Git에 평문 Secret 커밋**
```yaml
stringData:
  DB_PASSWORD: "test1234"  # 절대 안 됨!
```

❌ **잘못된 base64 값**
```yaml
data:
  DB_PASSWORD: PLACEHOLDER  # base64가 아님!
```

✅ **올바른 방법**
```yaml
# Sealed Secrets 사용
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
# ...

# 또는 External Secrets 사용
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
# ...
```

---

## 📚 참고 자료

- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [External Secrets Operator](https://external-secrets.io/)
- [ArgoCD Secret Management](https://argo-cd.readthedocs.io/en/stable/operator-manual/secret-management/)
