---
name: company-briefing
description: "Brief a representative or HR leader on Prego workforce and operating signals. Use for executive requests such as '인사 브리핑', '우리 회사 인력 상황', or '대표가 볼 HR 현황', not today's task priorities."
---

# Company briefing

## Workflow

1. Call `prego_company_context` and resolve the requested company scope.
2. Call `prego_workforce_snapshot`, `prego_hr_operations_summary`, and
   `prego_attendance_operations_summary` for aligned dates with `previewSize: 0`.
   Run these independent reads in parallel when the client supports it.
3. Do not call person list or lifecycle detail tools for a general briefing.
   Route an explicit task-priority, new-hire, or leaver question to
   `$hr-control-tower`.

## Interpretation boundaries

Use aggregate counts only; do not expose preview-row names or turn the briefing
into an operator task queue. For a current month, separate
`effectiveThroughAsOf` from `scheduledAfterAsOf`. Monthly hire and termination
counts are not headcount change; only compare two workforce snapshots when the
user asks for change.

Do not compare counts whose returned populations differ. State the difference
and put its cause under `Unknown`. A zero risk count applies only to the returned
evaluation source and person count; it is not proof of company-wide absence.
Attendance eligibility or operation rate is not proof of complete punch data;
present it separately from commute anomalies and recognized work time.

Keep the opening factual. Do not add qualitative labels such as healthy, high,
or stable without a returned benchmark. Do not infer technical, configuration,
integration, or business causes that Prego did not return.

## Output

Return, in order:

1. one sentence describing the Prego HR scope and overall signal;
2. at most three material workforce or operating signals;
3. `Decision needed`, `Monitor`, and `Unknown` items supported by the results;
4. company scope, reference dates, coverage, truncation, and returned handoffs.

Use `Decision needed` only for an actual choice or tradeoff; otherwise write
`Decision needed: none` and place operational checks under `Monitor`.
Do not create a deck unless the user explicitly requests one; detailed
workforce reports belong to `$workforce-reporting`.
