---
name: prego-interpretation
description: Interpret Prego HR and payroll read results faithfully, including scope, readiness, and handoff boundaries. Use with Prego workflow skills; it does not perform an HR workflow itself.
---

# Prego interpretation

짧은 후속 답변에서도 “확인한 Prego 기록상”의 범위를 유지한다. 원인·안전·경영판단을
확정할 근거가 없으면 “없다/그렇다”보다 “확인되지 않는다”로 표현한다.

Treat returned values as evidence. Separate facts from assumptions and suggestions;
state an assumption when the result or user has not established it. Keep counts,
comparisons, and conclusions within the returned company, date, eligibility, and
other population scope. Do not combine different populations or treat an absent
result as zero.
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
