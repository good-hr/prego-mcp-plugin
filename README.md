# Prego MCP plugin

Prego의 HR 운영 데이터를 ChatGPT, Codex, Claude, Gemini CLI에서 조회하고, 같은 상태의 Prego 화면으로 이동하는 read-only 플러그인이다.

## 제공 스킬

- `company-briefing`: HR 운영 요약과 재직자 현황
- `today-hr-operations`: HR·근태의 긴급 확인 항목
- `payroll-readiness`: 급여 준비·실행 준비도·원장 결과

플러그인은 `https://api.prego.team/mcp`만 사용한다. Prego 로그인, 조직 선택, 외부 앱 연결 확인을 거치며 한 연결은 한 조직에 고정된다. Prego의 MASTER·ADMIN은 `설정 > 외부 AI 연결`에서 제공자별 연결 허용 여부를 관리할 수 있다. 쓰기, 승인, 급여 계산·확정 도구는 포함하지 않는다.

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
