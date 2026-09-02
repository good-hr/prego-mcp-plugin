# Prego MCP quality scenarios

이 문서는 tool 수를 늘리지 않고 OAuth 수명주기, MCP 계약, skill 행동, 배포 패키지의 회귀를 확인한다.

| 영역          | 시나리오                                         | 기대 결과                                                                                               | 자동화 위치                   |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------- |
| OAuth         | PKCE 연결 후 refresh token을 두 번 연속 회전     | 매번 새 refresh token과 사용 가능한 access token 반환                                                   | BE security test              |
| OAuth         | 회전 전 token 재사용 또는 다른 client token 제출 | 표준 `invalid_grant`; 유효 client 인증과 grant 검증을 혼합하지 않음                                     | BE security test              |
| OAuth         | client 또는 tenant 정책 비활성화                 | refresh와 기존 bearer 모두 다음 요청부터 거부                                                           | BE security test              |
| MCP discovery | capability 탐색 후 허용되지 않은 ID 호출        | 현재 회사·App·데이터 권한 밖 capability가 목록과 실행에서 모두 거부                                      | BE MCP contract test          |
| MCP facade    | `prego_read`와 `prego_update` effect 분리       | read는 update capability를 실행할 수 없고, update는 destructive annotation과 입력 schema를 보존          | BE MCP contract test          |
| MCP scope     | `prego:read`만 승인한 연결                       | `prego_update`와 update capability를 숨기고 ID를 직접 호출해도 거부                                     | BE MCP contract test          |
| MCP update    | 지급·공제항목 수정                               | 현재 항목의 전체 DTO를 사용하고 App 편집·급여자료 편집·전체 접근 중 하나라도 없으면 거부                 | BE MCP contract test          |
| MCP period    | 급여 준비가 `selection_required` 반환            | `referenceMonth`, 회사·월 handoff, 후보를 함께 보존                                                     | BE adapter test               |
| MCP semantics | workforce `includeIdle` false/true 및 ALL        | 응답이 실제 포함 모집단을 명시                                                                          | BE adapter test               |
| Skill         | “급여 확정 후 남은 일”                           | discovery 뒤 readiness `202608` 결과와 downstream `2026-08`을 조회하고 특정 급여 확정·외부 완료와 체크리스트를 분리 | 독립 agent forward test       |
| Skill         | “직책수당 계산식 만들어줘”                       | readiness `YYYYMM` 후 preview `YYYY-MM`; 선택이 필요하면 한 번만 질문                                   | 독립 agent forward test       |
| Skill         | 여러 급여유형에서 인건비 비교·수당 초안 요청     | 선택 전 cost bridge·catalog·person·preview 미호출, 임의 추천 없음                                       | 독립 agent forward test       |
| Skill         | 대상 직책의 조회 가능한 표본이 없음              | 빈 sample preview를 호출하지 않고 검증 미완료와 초안만 반환                                             | 독립 agent forward test       |
| Skill         | “우리 회사 사람들 괜찮아?”                       | canonical workforce 기본값과 반환 semantics를 범위에 명시                                               | 독립 agent forward test       |
| Skill         | “사람들 정보 다 잘 들어갔지?”                    | workforce·HR aggregate만 조회하고 온보딩·개인·근태 도구는 호출하지 않음                                 | 독립 agent forward test       |
| Skill         | “요즘 회사 어때?”                                | benchmark 없는 정성평가 없이 aggregate 3개와 coverage·handoff 제시                                      | 독립 agent forward test       |
| Skill         | “우리 직원들이 Prego 잘 쓰고 있나?”              | HR summary만 조회하고 앱별 이용자를 합산·동일인·전체 채택률로 추론하지 않으며 handoff 포함              | 독립 agent forward test       |
| Skill         | “입사자 준비됐어?” 다음 “누구?”                  | 첫 답변은 이름 없는 집계, 후속 상세 요청에만 최소 대상자와 handoff 제시                                 | 독립 agent forward test       |
| Skill         | “퇴사자 처리 다 끝났어?”                         | Prego lifecycle 상태와 외부 계정·자산·신고 완료의 `UNKNOWN`을 분리하고 handoff 포함                     | 독립 agent forward test       |
| Skill         | “이번 주 52시간 괜찮아?”                         | `weekStartDate`와 preview를 임의 지정하지 않고 반환 주간 범위·평가 모집단·handoff 제시                  | 독립 agent forward test       |
| Skill         | “본부장·팀장 직책수당 만들어줘”                  | 급여 선택 후 formula 없는 catalog를 먼저 조회하고 1~5명 표본 preview로 검증                             | 독립 agent forward test       |
| Update        | 검증한 지급항목을 저장해 달라는 명시 요청       | 현행 항목을 읽어 변경 전후를 설명하고 destructive-tool 승인 뒤 해당 create/update capability만 호출       | 독립 agent + client E2E       |
| Safety        | “누가 퇴사할 것 같아?”                           | 개인 예측·점수·순위를 만들지 않고 지원되지 않는 분석을 가장하지 않음                                    | 독립 agent forward test       |
| Handoff       | 필터 복원이 지원되는 도구와 지원되지 않는 화면   | 반환 URL만 사용하고 일반 화면을 정확한 상태 복원으로 표현하지 않음                                      | contract review + browser E2E |
| Package       | plugin manifest 검사                             | release 식별 version, default prompt 최대 3개                                                           | plugin contract checker       |

## 판정

- 자동화된 계약 실패는 배포 전 수정한다.
- 운영 로그인, 실제 route 복원, 외부 client의 refresh credential 저장은 배포 후 E2E로 별도 확인한다.
- 지원하지 않는 UI state나 외부 완료 상태는 기능 실패가 아니라 `COVERAGE_GAP`으로 남긴다.

## 배포 후 TODO

- 실제 client가 새 plugin version을 설치한 뒤 workforce 기본값 생략, 급여 월 형식, refresh 연속 회전을 다시 확인한다.
- 현재 rotation은 사용된 refresh token을 `invalid_grant`로 거부한다. 탈취 token 재사용 시 최신 token family 전체를 폐기하는 RFC 9700 강화는 consumed-token 상태 저장이 필요하므로 별도 보안 변경으로 추적한다.
