---
name: company-briefing
description: "Brief a company representative or HR leader on Prego workforce composition and material HR or attendance signals. Use for executive summaries or vague company-health questions, not detailed reports or task queues."
---

# Company briefing

Call `prego_company_context`, resolve the requested company scope, then call
`prego_workforce_snapshot`, `prego_hr_operations_summary`, and
`prego_attendance_operations_summary` for aligned dates. Use aggregate counts
only; do not expose preview-row names or turn the briefing into an operator
task queue.

For a vague question such as whether the company is doing okay, use the current
date and the single default company returned by `prego_company_context` instead
of asking the user to choose a metric. If there is no single default, ask the
user to choose. State that the answer covers workforce, HR, and attendance
signals only.

Return, in order:

1. one sentence describing the Prego HR scope and overall signal;
2. at most three material workforce or operating signals;
3. `Decision needed`, `Monitor`, and `Unknown` items supported by the results;
4. company scope, reference dates, coverage, truncation, and returned handoffs.

Do not infer revenue, budget, productivity, hiring-pipeline, legal, or business
causes that Prego did not return. A missing source is `Unknown`, not healthy.
Do not create a deck unless the user explicitly requests one; detailed
workforce reports belong to `$workforce-reporting`.
