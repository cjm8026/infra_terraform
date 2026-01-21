# Lambda Cold Start 최적화 가이드

## EventBridge를 이용한 Lambda Warm-up 구현

### 개요
Lambda cold start를 줄이기 위해 EventBridge를 사용하여 주기적으로 Lambda 함수를 호출하는 방법입니다.

### 구현 방법

#### 1. Lambda 함수 수정 완료 ✅
`lambda_cognito_delete.py`에 warm-up 로직이 추가되었습니다. EventBridge에서 오는 요청을 감지하고 빠르게 응답합니다.

#### 2. EventBridge 설정 (3가지 방법)

##### 방법 A: AWS Console에서 직접 설정

1. **EventBridge 콘솔 접속**
   - AWS Console → EventBridge → Rules → Create rule

2. **Rule 생성**
   - Name: `lambda-cognito-delete-warmup-rule`
   - Description: `Lambda warm-up to reduce cold starts`
   - Event bus: `default`
   - Rule type: `Schedule`

3. **Schedule 설정**
   ```
   rate(5 minutes)  # 5분마다 실행
   ```
   
   또는 특정 시간대만 실행 (업무 시간):
   ```
   cron(0 8-18 ? * MON-FRI *)  # 평일 오전 8시~오후 6시
   ```

4. **Target 설정**
   - Target type: `AWS service`
   - Select a target: `Lambda function`
   - Function: `lambda-cognito-delete`
   - Configure input:
     ```json
     {
       "source": "aws.events",
       "detail-type": "Scheduled Event",
       "detail": {
         "warmup": true
       }
     }
     ```

5. **권한 확인**
   - EventBridge가 Lambda를 호출할 수 있는 권한이 자동으로 추가됩니다

##### 방법 B: CloudFormation 사용

```bash
# CloudFormation 스택 배포
aws cloudformation create-stack \
  --stack-name lambda-warmup-stack \
  --template-body file://eventbridge-warmup.yaml \
  --parameters \
    ParameterKey=LambdaFunctionName,ParameterValue=lambda-cognito-delete \
    ParameterKey=WarmUpSchedule,ParameterValue="rate(5 minutes)"

# 스택 상태 확인
aws cloudformation describe-stacks --stack-name lambda-warmup-stack
```

##### 방법 C: Terraform 사용

```bash
# Terraform 초기화
terraform init

# 계획 확인
terraform plan

# 배포
terraform apply

# 변수 커스터마이징
terraform apply \
  -var="lambda_function_name=lambda-cognito-delete" \
  -var="warmup_schedule=rate(5 minutes)"
```

##### 방법 D: AWS CLI로 직접 설정

```bash
# 1. EventBridge Rule 생성
aws events put-rule \
  --name lambda-cognito-delete-warmup-rule \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED \
  --description "Lambda warm-up to reduce cold starts"

# 2. Lambda 함수 ARN 가져오기
LAMBDA_ARN=$(aws lambda get-function \
  --function-name lambda-cognito-delete \
  --query 'Configuration.FunctionArn' \
  --output text)

# 3. Target 추가
aws events put-targets \
  --rule lambda-cognito-delete-warmup-rule \
  --targets "Id"="1","Arn"="$LAMBDA_ARN","Input"='{"source":"aws.events","detail-type":"Scheduled Event","detail":{"warmup":true}}'

# 4. Lambda 권한 추가
aws lambda add-permission \
  --function-name lambda-cognito-delete \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:YOUR_ACCOUNT_ID:rule/lambda-cognito-delete-warmup-rule
```

### Schedule 옵션

#### Rate 표현식
- `rate(1 minute)` - 1분마다 (최소 간격)
- `rate(5 minutes)` - 5분마다 (권장)
- `rate(10 minutes)` - 10분마다
- `rate(1 hour)` - 1시간마다

#### Cron 표현식
- `cron(0/5 * * * ? *)` - 5분마다
- `cron(0 8-18 ? * MON-FRI *)` - 평일 오전 8시~오후 6시 매시간
- `cron(*/10 * * * ? *)` - 10분마다
- `cron(0 9,12,15,18 ? * MON-FRI *)` - 평일 9시, 12시, 3시, 6시

### 비용 최적화

#### 예상 비용 (us-east-1 기준)
- Lambda 호출: $0.20 per 1M requests
- EventBridge: 무료 (기본 이벤트)

**5분 간격 warm-up 비용:**
- 월 호출 수: 8,640회 (60/5 * 24 * 30)
- 월 비용: ~$0.002 (거의 무료)

**권장 설정:**
- 개발 환경: `rate(10 minutes)` 또는 업무 시간만
- 프로덕션: `rate(5 minutes)` 또는 트래픽 패턴에 맞춤

### 모니터링

#### CloudWatch Logs 확인
```bash
# Warm-up 로그 확인
aws logs filter-log-events \
  --log-group-name /aws/lambda/lambda-cognito-delete \
  --filter-pattern "Warm-up ping received"
```

#### EventBridge Rule 상태 확인
```bash
# Rule 상태 확인
aws events describe-rule --name lambda-cognito-delete-warmup-rule

# Rule 비활성화
aws events disable-rule --name lambda-cognito-delete-warmup-rule

# Rule 활성화
aws events enable-rule --name lambda-cognito-delete-warmup-rule
```

#### CloudWatch Metrics
- Lambda → Metrics → Duration
- Cold start 감소 확인
- Invocations 증가 확인 (warm-up 호출 포함)

### 추가 최적화 팁

1. **Provisioned Concurrency** (더 강력한 방법)
   ```bash
   aws lambda put-provisioned-concurrency-config \
     --function-name lambda-cognito-delete \
     --provisioned-concurrent-executions 1
   ```
   - 비용: 시간당 과금 (~$0.015/hour)
   - 완전한 cold start 제거

2. **Lambda 메모리 증가**
   - 메모리를 늘리면 CPU도 증가하여 초기화 시간 단축
   - 512MB → 1024MB 테스트 권장

3. **VPC 최적화**
   - VPC 내 Lambda는 ENI 생성으로 cold start 증가
   - Hyperplane ENI 사용 (최신 Lambda 런타임)

4. **의존성 최적화**
   - Lambda Layer 사용
   - 불필요한 패키지 제거
   - 경량 라이브러리 사용

### 문제 해결

#### Warm-up이 작동하지 않는 경우
1. Lambda 로그에서 "Warm-up ping received" 확인
2. EventBridge Rule이 ENABLED 상태인지 확인
3. Lambda 권한 확인 (events.amazonaws.com)
4. Target 설정의 Input JSON 확인

#### 삭제 방법
```bash
# CloudFormation
aws cloudformation delete-stack --stack-name lambda-warmup-stack

# Terraform
terraform destroy

# AWS CLI
aws events remove-targets --rule lambda-cognito-delete-warmup-rule --ids 1
aws events delete-rule --name lambda-cognito-delete-warmup-rule
aws lambda remove-permission --function-name lambda-cognito-delete --statement-id AllowEventBridgeInvoke
```

### 참고 자료
- [AWS Lambda Cold Start 최적화](https://aws.amazon.com/blogs/compute/operating-lambda-performance-optimization-part-1/)
- [EventBridge Schedule Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
- [Lambda Provisioned Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html)
