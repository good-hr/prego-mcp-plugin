---
name: hr-control-tower
description: "Prioritize today's Prego HR and attendance work and check new-hire or leaver readiness. Use for daily HR priorities, incomplete onboarding, or offboarding follow-up."
---

# HR control tower

Call `prego_company_context` first and resolve the company scope. For daily
priorities, call `prego_hr_operations_summary` and
`prego_attendance_operations_summary`. Keep HR action signals and attendance
risk or closing signals distinct. Prioritize explicit action-required and risk
categories, then affected counts; never invent a due date, owner, severity, or
blocking status that the tools did not return.
If `dataPolicy.truncated` is true, state that the priorities are based on a
limited result and provide the returned Prego handoff for the full view.

For a new-hire or leaver question, call `prego_person_lifecycle_readiness` with
the matching lifecycle and explicit date range. Report each returned check as
`READY`, `MISSING`, `NOT_APPLICABLE`, or `UNKNOWN`. A missing permission,
unsupported check, or absent source is `UNKNOWN`, never complete.

For an HR leader, summarize company and work-area risk, impact, and coverage.
For an operator, show the returned targets, states, and next Prego screen.

Do not approve, edit, close, or infer work. Return the responsible Prego screen
from each tool without rebuilding its URL.
