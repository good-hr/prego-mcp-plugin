---
name: prego-interpretation
description: Interpret Prego HR and payroll results faithfully, including scope, readiness, execution, and handoff boundaries. Use with Prego workflow skills; it does not perform an HR workflow itself.
---

# Prego interpretation

The capability list is concise. Before a read or update, call
`prego_capabilities` with the selected `capabilityId` for its exact input
schema; reuse that schema within the conversation rather than guessing fields.

짧은 후속 답변에서도 “확인한 Prego 기록상”의 범위를 유지한다. 원인·안전·경영판단을
확정할 근거가 없으면 “없다/그렇다”보다 “확인되지 않는다”로 표현한다.

Treat returned values as evidence. Separate facts from assumptions and suggestions;
state an assumption when the result or user has not established it. Keep counts,
comparisons, and conclusions within the returned company, date, eligibility, and
other population scope. Do not combine different populations or treat an absent
result as zero.
조회 결과는 현재 권한으로 볼 수 있는 범위다. 전사 범위가 확인되지 않으면 전사 합계로
확대하지 않는다. `MCP_NOT_FOUND`는 대상 부재와 접근 범위를 구분하지 않으므로,
미등록이나 권한 부족 어느 한쪽으로 단정하지 않는다.
조회한 일부 유형·표본을 전체로 확대하지 않고, 집계 간 대응·중복 제거 근거 없이
같은 사람이나 원인으로 연결하지 않는다. 관측되지 않았다는 이유로 판단이 필요 없다고 보증하지 않는다.
Treat a familiar term's mapping to a company-specific label as an assumption
until the user or returned data establishes that meaning.

An ESS-eligible user count is not workforce headcount. Monthly lifecycle events
include the returned period, not necessarily only events completed today; use
two comparable workforce snapshots for headcount change, and person-level
reconciliation before attributing that change to lifecycle events. Missing attendance
records are checks, not evidence of misconduct. Zero detected risk means no signal
within evaluated records, not overall safety, especially when records are incomplete.

`monthlyOpens` records opens. It is not completed work, quality, adoption, or a
business outcome unless Prego explicitly returns evidence for that conclusion.

Match the audience without changing the evidence: give an executive material scope
and decisions, an HR operator returned targets, states, and next screen, and an
employee a clear explanation of their own result. Suggest operational checks
without turning every gap into a management decision. Use neutral language; do not assign
fault, cause, priority, completion, or significance beyond the returned data.

Use every returned Prego handoff URL exactly as returned. Do not rebuild, shorten,
or add parameters to it. If exact preservation is not possible, omit the link and
say that the exact handoff was unavailable.

Prego reads may return `referenceSkills` as
`[{ name, content, references: [{ name, content }] }]`. Apply their returned
content as the response-specific guidance. Payroll reads receive this canonical
skill with [the payroll reference](references/payroll.md); non-payroll reads do
not imply payroll guidance.

Keep these boundaries in the final summary too. If a company result has an
error, distinguish the failed read from an empty result or an unfinished HR
task. Report the safe code/errorId when needed for follow-up; do not invent its
cause from another metric.

## Settings and execution

Use the discovered action schema, not a guessed endpoint. Read the current
resource before editing; preserve fields the user did not ask to change. A
company's effective policy may be shared with other companies: state that scope
before changing it. A setup checklist mark is not proof the underlying setup ran.

Settings saved, rules applied, calculation accepted, calculation completed, and
result confirmed are different outcomes. Carry returned IDs and versions into
the next action and read back its result. On timeout or conflict, inspect current
state before retrying; do not repeat a potentially completed write blindly.
Only execute the stages the user requested. External payment, filing, delivery,
and permission administration are not implied by a successful Prego operation.
