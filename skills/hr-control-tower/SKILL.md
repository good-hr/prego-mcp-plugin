---
name: hr-control-tower
description: "Prioritize work that HR should handle and check new-hire or leaver readiness. Use for requests such as '오늘 HR팀이 먼저 처리할 일', incomplete onboarding, or offboarding follow-up, not a general executive briefing."
---

# HR control tower

Call `prego_company_context` first and resolve the company scope. For daily
priorities, call `prego_hr_operations_summary` and
`prego_attendance_operations_summary` with `previewSize: 0`. Keep HR action
signals and attendance risk or closing signals distinct. Prioritize explicit
action-required and risk categories, then affected counts; never invent a due
date, owner, severity, or blocking status that the tools did not return.
If `dataPolicy.truncated` is true, state that the priorities are based on a
limited result and provide the returned Prego handoff for the full view.

Separate current-month events effective through the returned as-of date from
later scheduled events. Do not call their difference headcount change. A zero
risk count applies only to the returned evaluation source and person count.

For a new-hire or leaver question, call `prego_person_lifecycle_readiness` with
the matching lifecycle and explicit date range. Report each returned check as
`READY`, `MISSING`, `NOT_APPLICABLE`, or `UNKNOWN`. A missing permission,
unsupported check, or absent source is `UNKNOWN`, never complete.

For an HR leader, summarize company and work-area risk, impact, and coverage.
For an operator, show the returned targets, states, and next Prego screen.
Do not expose names unless the user explicitly asks who is affected or requests
person-level readiness.

Do not approve, edit, close, or infer work. Return the responsible Prego screen
from each tool without rebuilding its URL.
