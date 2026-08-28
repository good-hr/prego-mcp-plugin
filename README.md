# Prego MCP plugin

Prego의 인사·급여 데이터를 ChatGPT, Codex, Claude, Gemini CLI에서 조회하고, 보고서 작성과 운영 점검 뒤 근거가 되는 Prego 화면으로 이동하는 플러그인이다.

## 제공 스킬

- `company-briefing`: 대표·인사 총괄을 위한 인력·인사 기준정보·HR 운영 브리핑
- `workforce-reporting`: 조직·직위·직무 인원현황 보고서와 인원·인건비 변화 분석
- `hr-control-tower`: 인사 총괄의 위험·영향 요약과 운영 담당자의 대상·후속 화면
- `payroll-operations`: 급여 준비, 월 운영 체크리스트, 개인 급여 차이 검토
- `payroll-policy-builder`: 지급항목 계산식 초안 검증과 비저장 표본 테스트
- `onboarding-import`: 고객 원본에서 필요한 공식 사원·급여 업로드 파일 생성과 비저장 사전검증

플러그인은 `https://api.prego.team/mcp`만 사용한다. 고객에서 외부 AI 연결을 활성화한 뒤 Prego 로그인, 조직 선택, 외부 앱 연결 확인을 거친다. 한 연결은 고객에 고정되고, 조회할 회사 범위는 현재 권한으로 동적으로 정한다. Prego의 MASTER·ADMIN은 `설정 > 외부 AI 연결`에서 제공자별 연결 허용 여부를 관리할 수 있고, 연결은 외부 앱의 연결 설정에서 해제할 수 있다. 정책 preview와 온보딩 사전검증을 포함한 모든 도구는 비저장이며 쓰기, 승인, 업로드·커밋, 급여 계산·확정은 하지 않는다. 화면 링크는 제품이 지원하는 회사·기간·탭·필터만 복원하며, 지원하지 않는 대상 상태는 일반 확인 화면으로 안내한다.

외부 AI가 반환 데이터를 저장·처리·국외이전하는 조건은 고객사가 선택한 서비스의 정책과 계약을 따른다. Prego MCP 감사 이벤트에는 호출 주체·외부 앱·tool·건수·상태만 남기며 prompt, tool 인자, 응답 payload는 저장하지 않는다.

## 연결

모든 client는 OAuth `prego:read` scope로 연결한다. 조직 관리자가 해당 제공자를 껐다면 새 연결, token 갱신, 기존 token을 사용한 조회가 모두 거부된다.

### ChatGPT

1. ChatGPT의 `Settings > Apps & Connectors > Advanced settings`에서 Developer mode를 켠다.
2. connector 추가 화면에 MCP URL `https://api.prego.team/mcp`를 입력한다.
3. `Connect`를 눌러 Prego에 로그인하고 조직을 선택한다.

ChatGPT workspace를 사용하는 경우 workspace 관리자가 먼저 connector를 추가해야 할 수 있다.

### Codex

이 저장소를 Prego plugin으로 설치하면 `.mcp.json`의 원격 MCP 설정이 함께 적용된다. MCP만 직접 등록할 때는 다음처럼 설정한 뒤 로그인한다.

```sh
codex mcp add prego --url https://api.prego.team/mcp
codex mcp login prego
```

브라우저에서 Prego 로그인과 조직 선택을 완료한 뒤 새 Codex 세션에서 Prego tool을 사용할 수 있다.

### Claude

1. Claude 또는 Claude Desktop의 `Settings > Connectors`로 이동한다.
2. `Add custom connector`에서 이름은 `Prego`, URL은 `https://api.prego.team/mcp`로 입력한다.
3. 추가된 Prego connector에서 `Connect`를 눌러 로그인하고 조직을 선택한다.

Team·Enterprise 조직에서는 Owner가 Organization connectors에 먼저 추가해야 한다.

### Gemini CLI

`~/.gemini/settings.json`의 `mcpServers`에 Prego를 추가한다. Prego는 DCR을 제공하지 않으므로 `clientId`를 생략하면 안 된다.

```json
{
  "mcpServers": {
    "prego": {
      "httpUrl": "https://api.prego.team/mcp",
      "oauth": {
        "enabled": true,
        "clientId": "prego-gemini-cli",
        "scopes": ["prego:read"]
      }
    }
  }
}
```

Gemini CLI를 다시 시작하고 `/mcp auth prego`를 실행한다. 브라우저가 열리면 Prego 로그인과 조직 선택을 완료한다. callback은 Gemini CLI가 연 로컬 포트의 `http://localhost:<port>/oauth/callback`을 사용한다.

## 지원 범위

- 기본 제공자: OpenAI(ChatGPT·Codex), Claude, Gemini CLI
- 추가 client: Prego 설정에서 CIMD metadata URL 또는 public client ID와 callback을 직접 등록
- 인증: authorization code + PKCE S256, client secret 미사용
- 미지원: DCR, confidential client, wildcard callback, 쓰기 도구

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

공개 API 문서를 켜지 않는다. 격리된 backend test runtime의 loopback
`/v3/api-docs`만 사용한다. 전용 checker가 응답의 object key를 정규화한 임시
artifact로 digest를 만들고, pilot-only OpenAPI나 공개 URL은 full provenance로
받지 않는다. full proof에는 모든 pilot operation, pilot 밖 operation, schema가
함께 있어야 한다.

```sh
node scripts/check-prego-contract-runtime.mjs \
  --frontend-root "$GOOD_HR_FRONTEND_ROOT" \
  --backend-root "$GOOD_HR_BACKEND_ROOT" \
  --openapi-url "http://127.0.0.1:${OPENAPI_PORT}/v3/api-docs"
```
