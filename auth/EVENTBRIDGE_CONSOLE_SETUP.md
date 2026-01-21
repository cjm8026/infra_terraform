# EventBridge Console 설정 가이드

## 🎯 목표
Lambda 함수 `fproject-dev-db-query`를 5분마다 자동으로 호출하여 cold start 방지

---

## 📋 단계별 가이드

### 1단계: EventBridge 콘솔 접속

1. AWS Console 로그인
2. 검색창에 **"EventBridge"** 입력
3. **Amazon EventBridge** 클릭
4. 왼쪽 메뉴에서 **Rules** 클릭
5. **Create rule** 버튼 클릭

---

### 2단계: Rule 기본 정보 입력

**Define rule detail 페이지:**

```
Name: fproject-dev-db-query-warmup
Description: Lambda warm-up to reduce cold starts
Event bus: default
Rule type: Schedule 선택
```

→ **Next** 클릭

---

### 3단계: Schedule 설정

**Define schedule 페이지:**

**Schedule pattern 선택:**
- ✅ **A schedule that runs at a regular rate, such as every 10 minutes** 선택

**Rate expression:**
```
Rate: 5
Unit: Minutes 선택
```

또는 더 세밀한 제어를 원하면:
- ✅ **A fine-grained schedule that runs at a specific time** 선택
- **Cron expression:**
  ```
  cron(0/5 * * * ? *)
  ```
  (5분마다 실행)

→ **Next** 클릭

---

### 4단계: Target 설정

**Select target(s) 페이지:**

**Target types:**
- ✅ **AWS service** 선택

**Select a target:**
```
Target: Lambda function 선택
Function: fproject-dev-db-query 선택
```

**Additional settings (펼치기):**

**Configure target input:**
- ✅ **Constant (JSON text)** 선택

**JSON 입력:**
```json
{
  "source": "aws.events",
  "detail-type": "Scheduled Event",
  "detail": {
    "warmup": true
  }
}
```

→ **Next** 클릭

---

### 5단계: 태그 설정 (선택사항)

**Configure tags 페이지:**

태그 추가 (선택사항):
```
Key: Environment
Value: production

Key: Purpose
Value: lambda-warmup
```

→ **Next** 클릭

---

### 6단계: 검토 및 생성

**Review and create 페이지:**

설정 내용 확인:
- ✅ Name: fproject-dev-db-query-warmup
- ✅ Schedule: rate(5 minutes)
- ✅ Target: Lambda function (fproject-dev-db-query)
- ✅ Input: Constant JSON

→ **Create rule** 버튼 클릭

---

## ✅ 설정 완료 확인

### 1. Rule 상태 확인

EventBridge → Rules 페이지에서:
- ✅ **fproject-dev-db-query-warmup** 이름 확인
- ✅ **State: Enabled** 확인
- ✅ **Schedule: rate(5 minutes)** 확인

### 2. Lambda 권한 확인

Lambda 함수에 EventBridge 호출 권한이 자동으로 추가됩니다.

**확인 방법:**
1. Lambda Console → Functions → fproject-dev-db-query
2. **Configuration** 탭 → **Permissions** 클릭
3. **Resource-based policy statements** 섹션에서 EventBridge 권한 확인

### 3. 실제 동작 확인 (5분 후)

**CloudWatch Logs에서 확인:**

1. Lambda Console → Functions → fproject-dev-db-query
2. **Monitor** 탭 → **View CloudWatch logs** 클릭
3. 최근 로그 스트림 클릭
4. 다음 로그 메시지 확인:
   ```
   Warm-up ping received from EventBridge
   ```

**또는 터미널에서:**
```bash
# 최근 로그 확인
aws logs tail /aws/lambda/fproject-dev-db-query --follow

# "Warm-up ping received" 메시지가 5분마다 나타나야 함
```

---

## 🔧 Schedule 옵션

### Rate 표현식 (간단)
```
rate(5 minutes)   - 5분마다
rate(10 minutes)  - 10분마다
rate(1 hour)      - 1시간마다
```

### Cron 표현식 (세밀한 제어)
```
cron(0/5 * * * ? *)              - 5분마다
cron(0 * * * ? *)                - 매시간 정각
cron(0 9-18 ? * MON-FRI *)       - 평일 오전 9시~오후 6시 매시간
cron(*/10 8-18 ? * MON-FRI *)    - 평일 오전 8시~오후 6시 10분마다
```

**Cron 형식:** `cron(분 시 일 월 요일 년)`
- `*` : 모든 값
- `?` : 특정 값 없음 (일/요일 중 하나는 ? 사용)
- `0/5` : 0분부터 5분 간격
- `9-18` : 9시부터 18시까지
- `MON-FRI` : 월요일부터 금요일

---

## 💰 비용

**EventBridge:**
- 기본 이벤트: 무료
- 월 8,640회 호출 (5분 간격): **$0**

**Lambda:**
- 월 8,640회 호출
- 각 호출당 ~100ms 실행
- 월 비용: **~$0.002** (거의 무료)

---

## 🛠️ Rule 수정/삭제

### Rule 일시 중지
1. EventBridge → Rules
2. **fproject-dev-db-query-warmup** 선택
3. **Disable** 버튼 클릭

### Rule 수정
1. EventBridge → Rules
2. **fproject-dev-db-query-warmup** 선택
3. **Edit** 버튼 클릭
4. Schedule 또는 Target 수정
5. **Update** 클릭

### Rule 삭제
1. EventBridge → Rules
2. **fproject-dev-db-query-warmup** 선택
3. **Delete** 버튼 클릭
4. 확인

---

## 🚨 트러블슈팅

### Rule이 실행되지 않는 경우

**1. Rule 상태 확인:**
```bash
aws events describe-rule --name fproject-dev-db-query-warmup
```
- State가 "ENABLED"인지 확인

**2. Target 확인:**
```bash
aws events list-targets-by-rule --rule fproject-dev-db-query-warmup
```
- Lambda ARN이 올바른지 확인

**3. Lambda 권한 확인:**
```bash
aws lambda get-policy --function-name fproject-dev-db-query
```
- EventBridge 호출 권한이 있는지 확인

**4. CloudWatch Logs 확인:**
```bash
aws logs tail /aws/lambda/fproject-dev-db-query --since 10m
```
- 에러 메시지 확인

### Lambda가 warm-up을 인식하지 못하는 경우

Lambda 코드에서 다음 로직 확인:
```python
if event.get('source') == 'aws.events' and event.get('detail-type') == 'Scheduled Event':
    print('Warm-up ping received from EventBridge')
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Lambda warmed up successfully'})
    }
```

---

## 📊 모니터링

### CloudWatch Metrics

**Lambda Invocations:**
1. Lambda Console → fproject-dev-db-query
2. **Monitor** 탭
3. **Invocations** 그래프 확인
   - 5분마다 spike가 보여야 함

**Duration:**
- Warm-up 호출: ~50-100ms
- Cold start: ~500-1000ms
- Warm-up 효과로 평균 Duration 감소 확인

### EventBridge Metrics

1. CloudWatch Console → Metrics
2. **EventBridge** 선택
3. **Rule Metrics** 선택
4. **fproject-dev-db-query-warmup** 선택
   - Invocations: 시간당 12회 (5분 간격)
   - FailedInvocations: 0이어야 함

---

## ✅ 완료!

EventBridge Rule이 생성되면:
- ✅ 5분마다 Lambda 자동 호출
- ✅ Cold start 감소
- ✅ 응답 시간 개선
- ✅ 사용자 경험 향상

설정 후 10-15분 정도 기다린 후 CloudWatch Logs에서 warm-up 로그를 확인하세요!
