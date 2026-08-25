---
name: payroll-operations
description: "Review Prego payroll readiness, post-confirmation follow-up, and one employee's month-over-month pay variance. Use for payroll blockers, remaining payroll work, or pay-change explanations."
---

# Payroll operations

Call `prego_company_context` and resolve exactly one company. Use:

- `prego_payroll_prepare_readiness` before calculation;
- `prego_payroll_downstream_status` for the selected month's Prego payroll-operation checklist;
- `prego_person_list` to resolve exactly one permission-visible employee before
  `prego_payroll_variance_review`;
- `prego_payroll_ledger` only for an explicit single-month request covering 1–100
  selected employees.

Use the current month when the user says this month or asks about current
payroll readiness without a month, and state the applied month. When a pay type
or sequence is ambiguous, show the returned candidates and ask the user to choose.
Until the selection is resolved, say that readiness cannot be assessed; do not
say that payroll is safe or unsafe to run. Never guess, enumerate, or scan pay
sequences or employees.
Use only selections and people returned by discovery tools; if a confirmed
selection is not discoverable, stop and label that evidence unavailable.
Separate blockers, follow-up work, completed Prego records,
and unknown external states. A generated banking file is not proof that a bank
paid employees. The monthly operation checklist is not proof that a payroll
result was confirmed; distinguish default events from linked completion state.
Explain a variance only from returned item deltas and
calculation provenance; do not invent a business cause.

If a pay-change question does not say whether it concerns the company total or
one employee, ask only that distinction first. Route a company-total change to
`$workforce-reporting`; continue here only for one employee. For an employee
named in plain language, pass the user's name fragment as `keyword` to
`prego_person_list`, then prefer the least identifying detail that still lets
the user choose from the permission-visible matches. Use employee numbers only
when they are useful for distinguishing the returned candidates.

For an HR leader, summarize blockers and affected scope. For a payroll operator,
show the exact selection, target, state, and next action. This skill never
calculates, confirms, changes, or retries payroll. Preserve returned handoffs,
but label a handoff as a general screen when it does not restore the employee
or draft state.

If any result has `dataPolicy.truncated: true`, state that the review is based
on limited evidence and provide its handoff for the full view.
