# GitHub CLI 빠른 설치 스크립트
Write-Host "🚀 GitHub CLI 설치 중..." -ForegroundColor Green

# MSI 다운로드
$url = "https://github.com/cli/cli/releases/latest/download/gh_windows_amd64.msi"
$output = "$env:TEMP\gh.msi"

Write-Host "다운로드 중..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $url -OutFile $output

Write-Host "설치 중..." -ForegroundColor Yellow
Start-Process msiexec.exe -Wait -ArgumentList "/i $output /quiet /norestart"

Write-Host "✅ 설치 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "PowerShell을 재시작한 후 다음 명령어를 실행하세요:" -ForegroundColor Cyan
Write-Host "  gh auth login" -ForegroundColor White
Write-Host "  .\setup-github-secrets.ps1" -ForegroundColor White
