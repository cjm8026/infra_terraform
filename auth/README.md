# FProject Backend (마이페이지 API)

Node.js + Express 기반 마이페이지 백엔드 API 서버입니다.

## 📁 폴더 구조

```
fproject-backend/
├── .github/
│   └── workflows/
│       └── deploy.yml      ← GitHub Actions CI/CD
├── k8s/
│   ├── deployment.yaml     ← Pod 배포 설정
│   ├── service.yaml        ← LoadBalancer 서비스
│   ├── configmap.yaml      ← 환경변수
│   └── secret.yaml         ← DB 비밀번호 등
├── server/
│   ├── index.ts            ← 메인 서버
│   ├── controllers/
│   │   └── userController.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   └── routes/
│       └── userRoutes.ts
├── src/
│   ├── services/
│   │   ├── authService.ts
│   │   ├── database.ts
│   │   ├── databaseUtils.ts
│   │   ├── inquiryService.ts
│   │   ├── reportService.ts
│   │   └── userService.ts
│   └── types/
│       └── database.ts
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 시작하기

### 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일 수정

# 개발 서버 실행
npm run dev
```

### Docker 빌드

```bash
docker build -t fproject-backend .
docker run -p 3001:3001 --env-file .env fproject-backend
```

## 🔧 GitHub Secrets 설정

GitHub 레포지토리 Settings > Secrets and variables > Actions에서 추가:

| Secret | 설명 |
|--------|------|
| `AWS_ACCESS_KEY_ID` | AWS Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key |

## 🔄 CI/CD 흐름

```
Git Push (main) → GitHub Actions → Docker Build → ECR Push → EKS Deploy
                                                                  ↓
                                                          kubectl set image
                                                                  ↓
                                                          Pod Rolling Update
```

## 📡 API 엔드포인트

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/health` | 헬스체크 | ❌ |
| GET | `/api/user/profile` | 프로필 조회 | ✅ |
| PUT | `/api/user/profile` | 프로필 수정 | ✅ |
| POST | `/api/user/password-reset` | 비밀번호 재설정 요청 | ❌ |
| POST | `/api/user/password-reset/confirm` | 비밀번호 재설정 확인 | ❌ |
| DELETE | `/api/user/account` | 계정 삭제 | ✅ |
| POST | `/api/user/report` | 사용자 신고 | ✅ |
| POST | `/api/user/inquiry` | 문의 등록 | ✅ |
| GET | `/api/user/inquiries` | 문의 내역 조회 | ✅ |

## 📊 현재 EKS 배포 상태

- **이미지**: `324547056370.dkr.ecr.us-east-1.amazonaws.com/fproject-dev-api:v9`
- **Pod**: 2개 Running
- **도메인**: api.aws11.shop (CloudFront 경유)
- **포트**: 3001

## 🔍 모니터링

```bash
# Pod 상태 확인
kubectl get pods -l app=fproject-backend

# 로그 확인
kubectl logs -l app=fproject-backend -f

# 서비스 확인
kubectl get svc fproject-backend-service
```

---

*마지막 업데이트: 2026-01-05*
