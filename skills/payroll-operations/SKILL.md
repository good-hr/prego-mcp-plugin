---
name: payroll-operations
description: "Review Prego payroll readiness, post-confirmation follow-up, and one employee's month-over-month pay variance. Use for payroll blockers, remaining payroll work, or pay-change explanations."
---

# Payroll operations

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps.

Call `prego_company_context` and resolve exactly one company. For a go/no-go or
remaining-work question, call `prego_payroll_prepare_readiness` first, then
call `prego_payroll_downstream_status` for the same operating month.
Downstream status is month-scoped and does not take a payroll type or sequence.
For other requests, use:

- `prego_payroll_prepare_readiness` before calculation;
- `prego_payroll_downstream_status` for the selected month's Prego payroll-operation checklist;
- `prego_person_list` to resolve exactly one permission-visible employee before
  `prego_payroll_variance_review`;
- `prego_payroll_ledger` only for an explicit single-month request covering 1–100
  selected employees.

When a pay type or sequence is ambiguous, show the returned candidates and ask
the user to choose. Never guess, enumerate, or scan pay sequences or employees.
Use only selections and people returned by discovery tools; if a confirmed
selection is not discoverable, stop and label that evidence unavailable.
Separate blockers, follow-up work, completed Prego records,
and unknown external states. A generated banking file is not proof that a bank
paid employees. The monthly operation checklist is not proof that a payroll
result was confirmed; distinguish default events from linked completion state.
For go/no-go answers, present four separate sections: calculation readiness and
its returned blockers; non-blocking data observations; Prego checklist items
without a completion mark; and external states Prego cannot know. A raw missing
count is not a blocker or required action unless readiness returns it as an
issue or action item. Describe an unmarked checklist item only as not marked
complete in Prego, not as proof that the external task was not done.
Explain a variance only from returned item deltas and
calculation provenance; do not invent a business cause.

For an HR leader, summarize blockers and affected scope. For a payroll operator,
show the exact selection, target, state, and next action. This skill never
calculates, confirms, changes, or retries payroll. Preserve returned handoffs,
but label a handoff as a general screen when it does not restore the employee
or draft state.

If any result has `dataPolicy.truncated: true`, state that the review is based
on limited evidence and provide its handoff for the full view.
