#!/bin/bash

# GitHub Secrets 자동 설정 스크립트
# 사용법: ./setup-github-secrets.sh

echo "🔐 GitHub Secrets 설정 시작..."
echo ""

# GitHub CLI 설치 확인
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh)가 설치되어 있지 않습니다."
    echo ""
    echo "설치 방법:"
    echo "  Windows: winget install --id GitHub.cli"
    echo "  또는: https://cli.github.com/ 에서 다운로드"
    echo ""
    exit 1
fi

# GitHub 로그인 확인
if ! gh auth status &> /dev/null; then
    echo "GitHub에 로그인이 필요합니다."
    gh auth login
fi

echo "현재 Repository 정보:"
gh repo view --json nameWithOwner -q .nameWithOwner
echo ""

# Secrets 설정
echo "📝 Secret 값을 입력하세요 (Enter를 누르면 기본값 사용):"
echo ""

# AWS_ACCESS_KEY_ID
read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    echo "$AWS_ACCESS_KEY_ID" | gh secret set AWS_ACCESS_KEY_ID
    echo "✅ AWS_ACCESS_KEY_ID 설정 완료"
fi

# AWS_SECRET_ACCESS_KEY
read -sp "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY
echo ""
if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "$AWS_SECRET_ACCESS_KEY" | gh secret set AWS_SECRET_ACCESS_KEY
    echo "✅ AWS_SECRET_ACCESS_KEY 설정 완료"
fi

# EKS_CLUSTER_NAME
read -p "EKS_CLUSTER_NAME (예: my-eks-cluster): " EKS_CLUSTER_NAME
if [ -n "$EKS_CLUSTER_NAME" ]; then
    echo "$EKS_CLUSTER_NAME" | gh secret set EKS_CLUSTER_NAME
    echo "✅ EKS_CLUSTER_NAME 설정 완료"
fi

# DB_PASSWORD
read -p "DB_PASSWORD [기본값: test1234]: " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-test1234}
echo "$DB_PASSWORD" | gh secret set DB_PASSWORD
echo "✅ DB_PASSWORD 설정 완료"

# GOOGLE_CLIENT_SECRET
read -p "GOOGLE_CLIENT_SECRET [기본값: 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]: " GOOGLE_CLIENT_SECRET
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-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}
echo "$GOOGLE_CLIENT_SECRET" | gh secret set GOOGLE_CLIENT_SECRET
echo "✅ GOOGLE_CLIENT_SECRET 설정 완료"

echo ""
echo "🎉 모든 Secrets 설정 완료!"
echo ""
echo "설정된 Secrets 확인:"
gh secret list

echo ""
echo "다음 단계:"
echo "  git add ."
echo "  git commit -m 'feat: Setup CI/CD pipeline'"
echo "  git push origin main"
