# Prego MCP plugin

Prego의 인사·급여 데이터를 ChatGPT, Codex, Claude, Gemini CLI에서 조회하고,
보고서 작성과 운영 점검 뒤 근거가 되는 Prego 화면으로 이동하는 플러그인이다.
허용된 설정 편집과 근태 마감·급여 준비·계산·정산·확정도 같은 MCP에서 실행한다.

## 제공 스킬

- `company-briefing`: 대표·인사 총괄을 위한 인력·인사 기준정보·HR 운영 브리핑
- `workforce-reporting`: 조직·직위·직무 인원현황 보고서와 인원·인건비 변화 분석
- `hr-control-tower`: HR 우선순위·입퇴사 준비, 계약 만료, 개인 휴가·근태 기록 확인
- `payroll-operations`: 급여 준비·계산·정산·확정과 후속 업무, 상태 확인과 명시적으로 요청한 실행
- `payroll-policy-builder`: 지급항목 계산식 초안 검증과 비저장 표본 테스트
- `onboarding-import`: 고객 원본에서 필요한 공식 사원·급여 업로드 파일 생성과 비저장 사전검증

플러그인은 `https://api.prego.team/mcp`만 사용한다. Prego 로그인과 외부 앱 연결 확인을 거치며, 접근 가능한 회사·기능·데이터 범위는 매 discovery와 호출마다 Prego가 다시 확인한다. `권한 관리` 권한이 있는 사용자는 `외부 서비스 연동 > AI 연결`에서 서비스별 조회·수정 허용 상태를 관리하며, 연결은 외부 서비스에서도 해제할 수 있다. 설정·실행 지원 여부와 입력은 현재 서버의 capability를 따른다. 정책 preview와 온보딩 사전검증은 비저장이며, 실제 은행 지급·외부 신고·전자서명·권한 변경은 지원하지 않는다. 화면 링크는 제품이 소비하는 회사·기간·탭·필터만 복원한다.

외부 AI가 반환 데이터를 저장·처리·국외이전하는 조건은 고객사가 선택한 서비스의 정책과 계약을 따른다. Prego MCP 감사 이벤트에는 호출 주체·외부 앱·tool·건수·상태만 남기며 prompt, tool 인자, 응답 payload는 저장하지 않는다.

## 연결

모든 client는 Prego OAuth의 단일 `prego:mcp` scope로 연결한다. 조회·수정 허용은
OAuth scope가 아니라 `외부 서비스 연동 > AI 연결`의 서비스 정책과 기존 SaaS의
앱·자료·사람 범위 권한으로 결정한다. 관리자가 서비스를 끄면 새 연결, token 갱신,
기존 token을 사용한 호출이 모두 거부된다.

## MCP 도구 계약

Prego는 내부 API별 도구를 공개하지 않는다. 스킬과 agent는 먼저
`prego_capabilities`로 현재 회사 맥락과 허용 capability를 확인한 뒤, 각
목록에서 고른 `capabilityId`를 같은 탐색 도구에 지정해 상세 입력 schema를 받는다.
그 형식에 맞춰 `prego_read` 또는 `prego_update`를 호출한다.
허용되지 않았거나 반환되지 않은 capability ID는 호출할 수 없다.

| Tool | 용도 | 확인 방식 |
| --- | --- | --- |
| `prego_capabilities` | 회사 맥락과 권한 기반 capability 탐색 | 조회 |
| `prego_read` | 허용된 조회 capability 실행 | 조회 |
| `prego_update` | 허용된 설정 변경·마감·계산·정산·확정 | 명시한 작업과 기존 업무 상태·권한 검사 |

`prego_update`는 destructive MCP tool이다. agent는 현재 값과 대상·기간을 확인하고
사용자가 요청한 변경만 실행한다. annotation은 client의 확인을 돕는 힌트이며
서버 권한·버전·업무 상태 검사를 대체하지 않는다. 접수·계산 완료·최종 확정·외부
지급은 서로 다르므로 반환 식별자로 결과를 재조회한다. 별도 `prego_operate`는 없다.

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
        "scopes": ["prego:mcp"]
      }
    }
  }
}
```

Gemini CLI를 다시 시작하고 `/mcp auth prego`를 실행한다. 브라우저가 열리면 Prego 로그인과 조직 선택을 완료한다. callback은 Gemini CLI가 연 로컬 포트의 `http://localhost:<port>/oauth/callback`을 사용한다.

### OAuth scope 변경 뒤 다시 연결하기

기존 연결이 이전 scope를 저장하고 있다면 연결 버튼을 반복해서 누르지 말고 해당
서비스에서 Prego 연결을 삭제한 뒤 MCP URL로 다시 추가한다. 새 연결이 Prego의
OAuth discovery에서 현재 `prego:mcp` scope를 읽어야 로그인 화면으로 이동한다.

## 지원 범위

- 기본 제공자: OpenAI(ChatGPT·Codex), Claude, Gemini CLI
- 추가 client: Prego 설정에서 CIMD metadata URL 또는 public client ID와 callback을 직접 등록
- 인증: authorization code + PKCE S256, client secret 미사용
- 미지원: DCR, confidential client, wildcard callback, 실제 이체·외부 신고·전자서명·사용자 권한 변경

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
