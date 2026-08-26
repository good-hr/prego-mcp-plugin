---
name: company-briefing
description: "Brief a company representative or HR leader on Prego workforce composition and material HR or attendance signals. Use for executive company HR summaries, not detailed reports or task queues."
---

# Company briefing

Call `prego_company_context`, resolve the requested company scope, then call
`prego_workforce_snapshot`, `prego_hr_operations_summary`, and
`prego_attendance_operations_summary` for aligned dates. Use aggregate counts
only; do not expose preview-row names or turn the briefing into an operator
task queue.

Return, in order:

1. one sentence describing the Prego HR scope and overall signal;
2. at most three material workforce or operating signals;
3. `Decision needed`, `Monitor`, and `Unknown` items supported by the results;
4. company scope, reference dates, coverage, truncation, and returned handoffs.

Do not infer technical, configuration, integration, or business causes that
Prego did not return; report the cause as `Unknown`. A missing source is
`Unknown`, not healthy.
Do not create a deck unless the user explicitly requests one; detailed
workforce reports belong to `$workforce-reporting`.
