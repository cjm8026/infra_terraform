# GitHub Secrets 설정 가이드

GitHub Secrets는 **한 번만 설정**하면 됩니다. 이후 CI/CD에서 자동으로 사용됩니다.

## 🚀 빠른 설정 (자동 스크립트)

### Windows (PowerShell):
```powershell
# 1. GitHub CLI 설치 (아직 없다면)
winget install --id GitHub.cli

# 2. 스크립트 실행
.\setup-github-secrets.ps1
```

### Linux/Mac (Bash):
```bash
# 1. GitHub CLI 설치 (아직 없다면)
# Mac: brew install gh
# Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

# 2. 스크립트 실행 권한 부여
chmod +x setup-github-secrets.sh

# 3. 스크립트 실행
./setup-github-secrets.sh
```

스크립트가 대화형으로 값을 물어보면 입력하면 됩니다!

---

## 📝 수동 설정 (GitHub 웹사이트)

### 1단계: GitHub Repository 접속

1. 브라우저에서 GitHub Repository 열기
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions** 클릭

### 2단계: Secrets 추가

**New repository secret** 버튼을 클릭하고 아래 값들을 하나씩 추가:

#### Secret 1: AWS_ACCESS_KEY_ID
```
Name: AWS_ACCESS_KEY_ID
Secret: AKIA로 시작하는 AWS Access Key
```
→ **Add secret** 클릭

#### Secret 2: AWS_SECRET_ACCESS_KEY
```
Name: AWS_SECRET_ACCESS_KEY
Secret: AWS Secret Access Key (40자 정도)
```
→ **Add secret** 클릭

#### Secret 3: EKS_CLUSTER_NAME
```
Name: EKS_CLUSTER_NAME
Secret: 실제 EKS 클러스터 이름 (예: my-eks-cluster)
```
→ **Add secret** 클릭

#### Secret 4: DB_PASSWORD
```
Name: DB_PASSWORD
Secret: test1234
```
→ **Add secret** 클릭

#### Secret 5: GOOGLE_CLIENT_SECRET
```
Name: GOOGLE_CLIENT_SECRET
Secret: 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
```
→ **Add secret** 클릭

### 3단계: 확인

설정 완료 후 **Actions secrets** 페이지에서 5개의 secret이 보여야 합니다:
- ✅ AWS_ACCESS_KEY_ID
- ✅ AWS_SECRET_ACCESS_KEY
- ✅ EKS_CLUSTER_NAME
- ✅ DB_PASSWORD
- ✅ GOOGLE_CLIENT_SECRET

---

## 🔑 필요한 값 찾기

### AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY

**새로 생성하는 경우:**

1. AWS Console → IAM → Users
2. CI/CD용 User 생성 (예: `github-actions`)
3. **Permissions** 탭에서 필요한 권한 추가:
   - `AmazonEC2ContainerRegistryPowerUser`
   - `AmazonEKSClusterPolicy`
   - `AWSLambda_FullAccess`
   - `CloudWatchEventsFullAccess`
4. **Security credentials** 탭 → **Create access key**
5. **Use case**: CLI 선택
6. Access Key ID와 Secret Access Key 복사 (한 번만 보임!)

**기존 키 사용하는 경우:**
- 이미 가지고 있는 AWS Access Key 사용
- Secret Key는 재확인 불가능하므로 새로 생성 필요

### EKS_CLUSTER_NAME

```bash
# 터미널에서 확인
aws eks list-clusters --region us-east-1

# 출력 예시:
# {
#     "clusters": [
#         "my-eks-cluster"
#     ]
# }
```

또는 AWS Console → EKS → Clusters에서 확인

### DB_PASSWORD

현재 프로젝트에서 사용 중인 값: `test1234`

### GOOGLE_CLIENT_SECRET

현재 프로젝트에서 사용 중인 값: `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`

---

## 🔍 설정 확인

### GitHub CLI로 확인:
```bash
gh secret list
```

출력 예시:
```
AWS_ACCESS_KEY_ID        Updated 2024-01-06
AWS_SECRET_ACCESS_KEY    Updated 2024-01-06
DB_PASSWORD              Updated 2024-01-06
EKS_CLUSTER_NAME         Updated 2024-01-06
GOOGLE_CLIENT_SECRET     Updated 2024-01-06
```

### 웹에서 확인:
Repository → Settings → Secrets and variables → Actions

**주의:** Secret 값은 설정 후 다시 볼 수 없습니다. 이름과 업데이트 날짜만 표시됩니다.

---

## 🔄 Secret 업데이트

값을 변경하고 싶을 때:

### GitHub CLI:
```bash
# 새 값으로 덮어쓰기
echo "new_value" | gh secret set SECRET_NAME
```

### 웹:
1. Repository → Settings → Secrets and variables → Actions
2. 변경할 Secret 클릭
3. **Update secret** 버튼 클릭
4. 새 값 입력 후 저장

---

## ❌ Secret 삭제

### GitHub CLI:
```bash
gh secret delete SECRET_NAME
```

### 웹:
1. Repository → Settings → Secrets and variables → Actions
2. 삭제할 Secret 옆의 **Delete** 버튼 클릭

---

## 🚨 보안 주의사항

1. ✅ **절대 코드에 포함하지 마세요**
   - Secret 값을 코드, 커밋 메시지, PR에 포함하지 않기

2. ✅ **최소 권한 원칙**
   - CI/CD IAM User에 필요한 권한만 부여

3. ✅ **정기적 로테이션**
   - AWS Access Key는 90일마다 교체 권장

4. ✅ **팀원과 공유 시**
   - 안전한 채널 사용 (Slack DM, 1Password 등)
   - 이메일이나 공개 채팅에 절대 공유 금지

5. ✅ **노출 시 즉시 조치**
   - AWS Access Key 즉시 비활성화
   - 새 키 생성 후 GitHub Secret 업데이트

---

## 🎯 설정 후 테스트

Secrets 설정 완료 후:

```bash
# 1. 코드 커밋
git add .
git commit -m "feat: Setup CI/CD pipeline"

# 2. Push (자동 배포 트리거)
git push origin main

# 3. GitHub Actions 확인
# 브라우저에서: Repository → Actions 탭
# 또는 CLI: gh run list
```

첫 배포가 성공하면 설정 완료! 🎉

---

## 💡 FAQ

### Q: Secret을 잘못 입력했어요
**A:** 같은 이름으로 다시 설정하면 덮어씌워집니다.

### Q: Secret 값을 확인하고 싶어요
**A:** 보안상 확인 불가능합니다. 새로 설정해야 합니다.

### Q: 팀원도 Secret을 설정해야 하나요?
**A:** 아니요! Repository에 한 번만 설정하면 모든 팀원이 사용합니다.

### Q: Fork한 Repository에서도 작동하나요?
**A:** 아니요. Fork한 Repository는 별도로 Secret을 설정해야 합니다.

### Q: Private Repository에서만 사용 가능한가요?
**A:** Public/Private 모두 사용 가능합니다.

---

## 📚 참고 자료

- [GitHub Secrets 공식 문서](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub CLI 설치](https://cli.github.com/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
