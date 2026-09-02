---
name: payroll-operations
description: "Review Prego payroll readiness, post-confirmation follow-up, and one employee's month-over-month pay variance. Use for payroll blockers, remaining payroll work, or pay-change explanations."
---

# Payroll operations

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps. Phrase uncertain causes and follow-up not explicit in the evidence as
possibilities or suggestions; reserve decision language for choices supported
by the returned evidence.

Call `prego_capabilities` and resolve exactly one company from its context. It
is also the permission-filtered catalog: use `prego_read` with `capabilityId`,
`scope`, and capability-specific `arguments`, and never invent an ID or call
one it did not return. For a go/no-go or remaining-work question, read
`payroll.prepare.readiness.read` first and wait for its result, then read
`payroll.downstream.status.read` for the same operating month. Do not run these
two reads in parallel. The two capabilities intentionally use different month
formats:

- `payroll.prepare.readiness.read`: `yyyymm` in `YYYYMM`, for example `202608`;
- `payroll.downstream.status.read`: `operatingMonth` in `YYYY-MM`, for example `2026-08`.

Downstream status is month-scoped and does not take a payroll type or sequence.
For other requests, use:

- `payroll.prepare.readiness.read` before calculation;
- `payroll.downstream.status.read` for the selected month's Prego payroll-operation checklist;
- `person.list.read` to resolve exactly one permission-visible employee before
  `payroll.variance.review.read`;
- `payroll.ledger.read` only for an explicit single-month request covering 1–100
  selected employees.

When a pay type or sequence is ambiguous, show the returned candidates and ask
the user to choose. Do not call a selection-specific tool until the user has
chosen, and do not label a candidate as recommended unless the tool explicitly
returns that meaning. Never guess, enumerate, or scan pay sequences or employees.
Use only selections and people returned by discovery tools; if a confirmed
selection is not discoverable, stop and label that evidence unavailable.
Separate blockers, follow-up work, completed Prego records,
and unknown external states. A generated banking file is not proof that a bank
paid employees. The monthly operation checklist is not proof that a payroll
result was confirmed; distinguish default events from linked completion state.
If payroll type selection is still required, never turn a shared checklist's
`DONE` state into a claim that a specific payroll result is confirmed. Say the
selected payroll type's confirmation state is still unknown.
Preserve each returned importance when prioritizing checklist items. Do not put
`NORMAL` items under a high-risk heading solely because their due date passed.
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
calculates, confirms, changes, or retries payroll. Include the returned handoff
for every completed tool call, even in a short answer, but label it as a general
screen when it does not restore the employee or draft state.

If any result has `dataPolicy.truncated: true`, state that the review is based
on limited evidence and provide its handoff for the full view.
