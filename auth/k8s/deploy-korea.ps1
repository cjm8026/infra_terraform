# FProject Backend Deployment Script for Korea Region
# 
# Prerequisites:
# 1. Docker Desktop running
# 2. kubectl configured for Korea EKS cluster
# 3. AWS CLI configured for ap-northeast-2

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting FProject Backend Deployment to Korea Region..." -ForegroundColor Green

# Variables
$AWS_REGION = "ap-northeast-2"
$ECR_REGISTRY = "324547056370.dkr.ecr.$AWS_REGION.amazonaws.com"
$ECR_REPOSITORY = "fproject-dev-api"
$IMAGE_TAG = "backend-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$FULL_IMAGE_NAME = "$ECR_REGISTRY/${ECR_REPOSITORY}:$IMAGE_TAG"
$EKS_CLUSTER_NAME = "YOUR-KOREA-EKS-CLUSTER-NAME"  # 한국 리전 EKS 클러스터 이름으로 변경

# Step 1: Build Docker image
Write-Host "📦 Building Docker image..." -ForegroundColor Cyan
Set-Location ..
docker build -t $FULL_IMAGE_NAME .
docker tag $FULL_IMAGE_NAME "$ECR_REGISTRY/${ECR_REPOSITORY}:latest"

# Step 2: Login to ECR
Write-Host "🔐 Logging in to ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Step 3: Push to ECR
Write-Host "⬆️  Pushing image to ECR..." -ForegroundColor Cyan
docker push $FULL_IMAGE_NAME
docker push "$ECR_REGISTRY/${ECR_REPOSITORY}:latest"

# Step 4: Update kubeconfig
Write-Host "⚙️  Updating kubeconfig..." -ForegroundColor Cyan
aws eks update-kubeconfig --region $AWS_REGION --name $EKS_CLUSTER_NAME

# Step 5: Apply Kubernetes manifests
Write-Host "🎯 Deploying to Kubernetes..." -ForegroundColor Cyan
Set-Location k8s

# ConfigMap과 Secret 먼저 적용
kubectl apply -f configmap.yaml
kubectl apply -f serviceaccount.yaml
kubectl apply -f secret-provider-class.yaml

# Deployment와 Service 적용
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Ingress 적용 (ALB 생성)
kubectl apply -f ingress.yaml

# Step 6: Wait for deployment
Write-Host "⏳ Waiting for deployment to be ready..." -ForegroundColor Cyan
kubectl rollout status deployment/fproject-backend --timeout=300s

# Step 7: Get service information
Write-Host "📋 Getting service information..." -ForegroundColor Cyan
kubectl get ingress fproject-backend-ingress
kubectl get services fproject-backend-service
kubectl get pods -l app=fproject-backend

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 To get the ALB URL:" -ForegroundColor Yellow
Write-Host "kubectl get ingress fproject-backend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
Write-Host ""
Write-Host "📊 To check logs:" -ForegroundColor Yellow
Write-Host "kubectl logs -l app=fproject-backend -f"
