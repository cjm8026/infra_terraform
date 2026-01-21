# GitHub Secrets 자동 설정 스크립트 (PowerShell)
# 사용법: .\setup-github-secrets.ps1

Write-Host "🔐 GitHub Secrets 설정 시작..." -ForegroundColor Green
Write-Host ""

# GitHub CLI 설치 확인
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh)가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "설치 방법:"
    Write-Host "  winget install --id GitHub.cli"
    Write-Host "  또는: https://cli.github.com/ 에서 다운로드"
    Write-Host ""
    exit 1
}

# GitHub 로그인 확인
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub에 로그인이 필요합니다." -ForegroundColor Yellow
    gh auth login
}

Write-Host "현재 Repository 정보:"
gh repo view --json nameWithOwner -q .nameWithOwner
Write-Host ""

Write-Host "📝 Secret 값을 입력하세요 (Enter를 누르면 기본값 사용):" -ForegroundColor Cyan
Write-Host ""

# AWS_ACCESS_KEY_ID
$AWS_ACCESS_KEY_ID = Read-Host "AWS_ACCESS_KEY_ID"
if ($AWS_ACCESS_KEY_ID) {
    $AWS_ACCESS_KEY_ID | gh secret set AWS_ACCESS_KEY_ID
    Write-Host "✅ AWS_ACCESS_KEY_ID 설정 완료" -ForegroundColor Green
}

# AWS_SECRET_ACCESS_KEY
$AWS_SECRET_ACCESS_KEY = Read-Host "AWS_SECRET_ACCESS_KEY" -AsSecureString
if ($AWS_SECRET_ACCESS_KEY.Length -gt 0) {
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($AWS_SECRET_ACCESS_KEY)
    $PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    $PlainPassword | gh secret set AWS_SECRET_ACCESS_KEY
    Write-Host "✅ AWS_SECRET_ACCESS_KEY 설정 완료" -ForegroundColor Green
}

# EKS_CLUSTER_NAME
$EKS_CLUSTER_NAME = Read-Host "EKS_CLUSTER_NAME (예: my-eks-cluster)"
if ($EKS_CLUSTER_NAME) {
    $EKS_CLUSTER_NAME | gh secret set EKS_CLUSTER_NAME
    Write-Host "✅ EKS_CLUSTER_NAME 설정 완료" -ForegroundColor Green
}

# DB_PASSWORD
$DB_PASSWORD = Read-Host "DB_PASSWORD [기본값: test1234]"
if (-not $DB_PASSWORD) { $DB_PASSWORD = "test1234" }
$DB_PASSWORD | gh secret set DB_PASSWORD
Write-Host "✅ DB_PASSWORD 설정 완료" -ForegroundColor Green

# GOOGLE_CLIENT_SECRET
$GOOGLE_CLIENT_SECRET = Read-Host "GOOGLE_CLIENT_SECRET [기본값: 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]"
if (-not $GOOGLE_CLIENT_SECRET) { $GOOGLE_CLIENT_SECRET = "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" }
$GOOGLE_CLIENT_SECRET | gh secret set GOOGLE_CLIENT_SECRET
Write-Host "✅ GOOGLE_CLIENT_SECRET 설정 완료" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 모든 Secrets 설정 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "설정된 Secrets 확인:"
gh secret list

Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  git add ."
Write-Host "  git commit -m 'feat: Setup CI/CD pipeline'"
Write-Host "  git push origin main"
