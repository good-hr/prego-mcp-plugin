---
name: hr-control-tower
description: "Prioritize HR work, check new-hire or leaver readiness and contract expiry, and answer one employee's leave or attendance-record questions. Use for daily HR operations and follow-up, not a general executive briefing."
---

# HR control tower

Apply `$prego-interpretation` and any `referenceSkills` returned by Prego reads.

Call `prego_capabilities` first and resolve the company scope from its context.
It is also the permission-filtered catalog: use `prego_read` with
`capabilityId`, `scope`, and capability-specific `arguments`, and never invent
an ID or call one it did not return. For daily priorities, read
`hr.operations.summary.read` and `attendance.operations.summary.read` with
`previewSize: 0`, unless the user explicitly asks who is affected; then request
the smallest useful preview.
Keep HR action signals and attendance risk or closing signals distinct.
Prioritize explicit action-required and risk categories, then affected counts;
never invent a due date, owner, severity, or blocking status that the tools did
not return.
If `dataPolicy.truncated` is true, state that the priorities are based on a
limited result and provide the returned Prego handoff for the full view.

Separate returned current-month lifecycle events effective through the as-of
date from later scheduled events. Do not call their difference headcount
change. A zero risk count applies only to the returned evaluation source and
person count.

For a new-hire or leaver question, read `person.lifecycle.readiness.read` with
the matching lifecycle and explicit date range. Report each returned check as
`READY`, `MISSING`, `NOT_APPLICABLE`, or `UNKNOWN`. A missing permission,
unsupported check, or absent source is `UNKNOWN`, never complete.
Lifecycle `READY` covers only the checks returned by Prego. Account or asset
recovery, government filing, actual payment, and other external completion stay
`UNKNOWN` unless a tool explicitly returns their state.

For an HR leader, summarize company and work-area risk, impact, and coverage.
For expiring contracts, use `hr.contract-expiry.read`; request a target page only
when the user asks who. Contract end dates do not establish renewal or termination.
For one employee's leave balance or history, use `attendance.leave.balance-history.read`;
for their dated work records, use `attendance.person.daily-records.read`. Resolve
the employee with `person.list.read`, asking the user if multiple people match;
an aggregate question is not a reason to fetch personal records.

For an operator, show the returned targets, states, and next Prego screen.
Do not expose names unless the user explicitly asks who is affected or requests
person-level readiness.

Do not approve, edit, close, or infer work. Include the responsible Prego screen
returned by each tool verbatim in the final answer.
