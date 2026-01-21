# 회원탈퇴 기능 트러블슈팅 가이드

## 문제 상황

사용자가 마이페이지에서 회원탈퇴 버튼을 클릭했을 때:
- ❌ DB에서 유저 정보가 삭제되지 않음
- ❌ Cognito Console에서 유저가 삭제되지 않음
- ❌ 500 Internal Server Error 발생

## 발견된 문제들

### 1. Google 로그인 시 DB에 유저 미생성
**증상:**
```
UserNotFoundError: User not found: a4789468-e011-7073-381d-b19319c842c7
```

**원인:**
- Google 로그인 시 Cognito에는 유저가 생성되지만, DB에는 생성되지 않음
- `authMiddleware`에서 토큰 검증만 하고 DB 유저 생성 로직이 없음

**해결:**
`server/middleware/auth.ts`에 DB 유저 자동 생성 로직 추가

```typescript
// DB에 유저가 없으면 자동 생성 (Google 로그인 등 소셜 로그인 대응)
const userService = getUserService();
try {
  // 먼저 DB에 유저가 있는지 확인
  await userService.getUserProfile(decodedToken.sub);
} catch (error) {
  if (error instanceof UserNotFoundError) {
    console.log(`[authMiddleware] Creating new user in DB: ${decodedToken.sub}`);
    try {
      // DB에 유저 생성
      await userService.createUser(
        decodedToken.sub,
        decodedToken.email,
        decodedToken.preferred_username || decodedToken.email
      );
    } catch (createError: any) {
      // 이메일 중복 에러는 무시 (이미 같은 이메일로 가입된 경우)
      if (createError.code === '23505') {
        console.log(`[authMiddleware] User with email ${decodedToken.email} already exists, skipping creation`);
      } else {
        throw createError;
      }
    }
  } else {
    throw error;
  }
}
```

### 2. Cognito 삭제 실패 - Lambda 미구현
**증상:**
```
Lambda response: {"message":"Query executed successfully","result":{"table":"users",...}}
```

**원인:**
- 기존 Lambda 함수가 `cognito_delete` 쿼리 타입을 처리하지 않음
- DB 조회만 하고 Cognito 삭제 기능이 없음

**해결:**
Lambda 함수에 Cognito 삭제 기능 추가

`index.js` (Lambda 함수):
```javascript
const { CognitoIdentityProviderClient, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_oesTGe9D5';

exports.handler = async (event) => {
    try {
        // 요청 body 파싱
        let body;
        if (typeof event.body === 'string') {
            body = JSON.parse(event.body);
        } else {
            body = event.body || event;
        }
        
        const queryType = body.queryType || 'default';
        
        // Cognito 유저 삭제 처리
        if (queryType === 'cognito_delete') {
            const userId = body.userId;
            if (!userId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ success: false, message: 'userId is required' })
                };
            }
            
            try {
                // Cognito에서 유저 삭제
                const command = new AdminDeleteUserCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: userId
                });
                
                await cognitoClient.send(command);
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        success: true, 
                        message: `User ${userId} deleted from Cognito` 
                    })
                };
            } catch (error) {
                // 유저가 이미 삭제된 경우는 성공으로 처리
                if (error.name === 'UserNotFoundException') {
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ 
                            success: true, 
                            message: 'User not found in Cognito (already deleted)' 
                        })
                    };
                }
                
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        success: false, 
                        message: `Failed to delete from Cognito: ${error.message}` 
                    })
                };
            }
        }
        
        // 지원하지 않는 queryType
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Unsupported queryType. Use "cognito_delete"',
                queryType: queryType
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error processing request',
                error: error.message
            })
        };
    }
};
```

### 3. Lambda IAM 권한 부족
**증상:**
```
AccessDeniedException: User is not authorized to perform: cognito-idp:AdminDeleteUser
```

**원인:**
- Lambda 실행 Role에 Cognito 권한이 없음

**해결:**
```bash
# Lambda Role에 Cognito 권한 추가
aws iam attach-role-policy \
  --role-name fproject-dev-db-query-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser
```

### 4. Lambda 환경변수 누락
**원인:**
- `USER_POOL_ID` 환경변수가 설정되지 않음

**해결:**
```bash
# Lambda 환경변수 추가
aws lambda update-function-configuration \
  --function-name fproject-dev-db-query \
  --environment "Variables={
    DB_HOST=fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com,
    DB_NAME=fproject_db,
    DB_USER=fproject_user,
    DB_PASSWORD=test1234,
    DB_PORT=5432,
    USER_POOL_ID=us-east-1_oesTGe9D5
  }"
```

### 5. 백엔드에서 Lambda 호출 방식 변경
**기존 코드 (실패):**
```typescript
// AdminDeleteUserCommand를 직접 사용 (자격증명 문제)
const command = new AdminDeleteUserCommand({
  UserPoolId: this.userPoolId,
  Username: userId,
});
await this.cognitoClient.send(command);
```

**수정된 코드 (성공):**
```typescript
// Lambda를 통해 Cognito 삭제
async deleteUser(userId: string, email?: string): Promise<void> {
  const LAMBDA_URL = 'https://wyhaig5um6pijs6sjajgsymw4m0rbzso.lambda-url.us-east-1.on.aws/';
  
  try {
    console.log(`[AuthService.deleteUser] Deleting user from Cognito via Lambda: ${userId}`);
    
    // Lambda 함수 호출
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryType: 'cognito_delete', userId }),
    });
    
    const result = await response.json();
    console.log('[AuthService.deleteUser] Lambda response:', result);
    
    // 성공 여부 확인
    if (response.ok && result.success) {
      console.log(`[AuthService.deleteUser] Successfully deleted user from Cognito: ${userId}`);
      return;
    }
    
    throw new Error(result.message || 'Lambda invocation failed');
    
  } catch (error: any) {
    console.error(`[AuthService.deleteUser] Failed to delete user from Cognito:`, error);
    throw new CognitoError(`Failed to delete user from Cognito: ${error.message}`, error.name);
  }
}
```

### 6. 이메일 중복 에러 처리
**증상:**
```
duplicate key value violates unique constraint "users_email_key"
```

**원인:**
- 같은 이메일로 직접 가입 + Google 가입이 중복됨
- Cognito는 다른 sub를 생성하지만 DB는 email이 unique

**해결:**
이메일 중복 시 에러를 무시하고 계속 진행

```typescript
try {
  await userService.createUser(
    decodedToken.sub,
    decodedToken.email,
    decodedToken.preferred_username || decodedToken.email
  );
} catch (createError: any) {
  // PostgreSQL 중복 키 에러 코드: 23505
  if (createError.code === '23505') {
    console.log(`[authMiddleware] User with email ${decodedToken.email} already exists, skipping creation`);
  } else {
    throw createError;
  }
}
```

## 최종 아키텍처

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ DELETE /api/user/account
       ↓
┌─────────────────────────────────┐
│  Backend (EKS)                  │
│  ┌──────────────────────────┐   │
│  │ userController.ts        │   │
│  │ - deleteAccount()        │   │
│  └────────┬─────────────────┘   │
│           │                     │
│           ↓                     │
│  ┌──────────────────────────┐   │
│  │ userService.ts           │   │
│  │ - deleteUser()           │   │
│  │   (DB에서 삭제)           │   │
│  └────────┬─────────────────┘   │
│           │                     │
│           ↓                     │
│  ┌──────────────────────────┐   │
│  │ authService.ts           │   │
│  │ - deleteUser()           │───┼──┐
│  │   (Lambda 호출)           │   │  │
│  └──────────────────────────┘   │  │
└─────────────────────────────────┘  │
                                     │ HTTPS POST
                                     │ {queryType: "cognito_delete", userId}
                                     ↓
                            ┌────────────────────┐
                            │  Lambda Function   │
                            │  (Node.js 20.x)    │
                            │                    │
                            │  - Cognito SDK     │
                            │  - AdminDeleteUser │
                            └─────────┬──────────┘
                                      │
                                      ↓
                            ┌────────────────────┐
                            │  Cognito User Pool │
                            │  (유저 삭제)        │
                            └────────────────────┘
```

## 배포 과정

### 1. Lambda 함수 업데이트
```bash
# Lambda 코드 압축
Compress-Archive -Path index.js -DestinationPath lambda_function.zip -Force

# Lambda 함수 업데이트
aws lambda update-function-code \
  --function-name fproject-dev-db-query \
  --zip-file fileb://lambda_function.zip
```

### 2. 백엔드 코드 배포
```bash
# 코드 커밋 및 푸시
git add src/services/authService.ts server/middleware/auth.ts
git commit -m "fix: Google login DB sync and Cognito deletion via Lambda"
git push

# GitHub Actions가 자동으로 이미지 빌드 및 ECR 푸시
# 약 3분 소요

# deployment 이미지 태그 업데이트
# k8s/deployment.yaml의 image 태그를 새 버전으로 변경
git add k8s/deployment.yaml
git commit -m "chore: update image tag to v11"
git push

# ArgoCD가 자동으로 EKS에 배포
# 약 30초 소요
```

### 3. 배포 확인
```bash
# 파드 상태 확인
kubectl get pods -n default | grep fproject

# 로그 확인
kubectl logs deployment/fproject-backend -n default --tail=50
```

## 테스트 방법

### 1. Google 로그인 테스트
```bash
# 로그 확인
kubectl logs deployment/fproject-backend -n default --tail=100 | grep "authMiddleware"

# 예상 로그:
# [authMiddleware] Creating new user in DB: <user_id>
```

### 2. 회원탈퇴 테스트
```bash
# 로그 확인
kubectl logs deployment/fproject-backend -n default --tail=100 | grep "deleteAccount"

# 예상 로그:
# [deleteAccount] Starting account deletion process
# [UserService.deleteUser] Deletion completed successfully
# [AuthService.deleteUser] Successfully deleted user from Cognito
```

### 3. DB 확인
```bash
# DB 유저 목록 조회
kubectl run psql-temp --rm -i --tty --image postgres:15 \
  --env="PGPASSWORD=test1234" \
  --command -- psql \
  -h fproject-dev-postgres.c9eksq6cmh3c.us-east-1.rds.amazonaws.com \
  -U fproject_user \
  -d fproject_db \
  -c "SELECT user_id, email, nickname FROM users;"
```

### 4. Cognito 확인
```bash
# Cognito 유저 목록 조회
aws cognito-idp list-users \
  --user-pool-id us-east-1_oesTGe9D5 \
  --query "Users[*].{Username:Username, Email:Attributes[?Name=='email'].Value | [0]}" \
  --output table
```

## 주요 학습 포인트

1. **소셜 로그인 처리**: 인증 미들웨어에서 DB 동기화 필요
2. **Lambda 활용**: 백엔드에서 직접 AWS SDK 사용 대신 Lambda로 권한 분리
3. **에러 처리**: 중복 키, UserNotFound 등 예외 상황 처리
4. **트랜잭션 관리**: DB 삭제 후 Cognito 삭제 실패 시에도 성공 응답
5. **로깅**: 각 단계별 상세 로그로 디버깅 용이

## 참고 자료

- [AWS Cognito AdminDeleteUser API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminDeleteUser.html)
- [AWS Lambda Node.js Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
