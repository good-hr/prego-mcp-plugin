# Prego plugin

Prego의 HR 운영 데이터를 Codex와 ChatGPT에서 조회하고, 같은 상태의 Prego 화면으로 이동하는 read-only 플러그인이다.

## 제공 스킬

- `company-briefing`: HR 운영 요약과 재직자 현황
- `today-hr-operations`: HR·근태의 긴급 확인 항목
- `payroll-readiness`: 급여 준비·실행 준비도·원장 결과

플러그인은 `https://api.prego.team/mcp`만 사용한다. 연결 과정에서 Prego 로그인, 회사 선택, `prego:read` 동의를 거치며 한 연결은 한 회사에 고정된다. 쓰기, 승인, 급여 계산·확정 도구는 포함하지 않는다.

## 검증

paired frontend/backend checkout과 전체 OpenAPI artifact를 지정한다.

```sh
node scripts/check-prego-contract.mjs \
  --frontend-root "$GOOD_HR_FRONTEND_ROOT" \
  --backend-root "$GOOD_HR_BACKEND_ROOT" \
  --openapi "$OPENAPI_SPEC" \
  --require-openapi-digest
```

실제 OpenAPI digest 없이 실행한 검사는 로컬 구조 확인일 뿐 공개 배포 근거가 아니다.
