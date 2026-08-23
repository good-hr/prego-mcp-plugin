---
name: payroll-readiness
description: "Check Prego payroll preparation and existing ledger context without changing payroll."
---

# Payroll readiness

Use this to assess payroll preparation blockers and existing ledger results.

First call `prego_company_context` (`company.context.read`). It is the source
for customer companies available for scope resolution and their UUIDs; it does
not grant data access. Then use only `prego_payroll_prepare_readiness` (`payroll.prepare.readiness.read`)
and `prego_payroll_ledger` (`payroll.ledger.read`). If a required tool is
unavailable, do not substitute another tool. Never start a calculation, retry,
confirm results, or change a ledger.

For a new request, use `scope.mode: "default"` unless the user names one or
more companies or asks for the whole group. Map unambiguous returned company
labels to `scope.mode: "selected"` with those `companyIds`; use
`scope.mode: "all"` only for all customer companies. If a name or a
follow-up after a multi-company result is ambiguous, ask the user to choose
from returned labels before a business read. After a resolved business result,
reuse its exact scope for follow-ups unless the user changes it. Keep this only
in the conversation; do not claim that Prego stores a last scope.

Read payroll readiness first. It returns the selection candidates per company;
re-call it with an unambiguous candidate when more detail is needed, and ask
the user to select when candidates are ambiguous. Call the ledger only for one
selected company, one returned payroll candidate, and 1-100 explicit
`personIds` returned within that permitted scope. Never omit or invent
`personIds` to request a company-wide or all-group ledger.

Do not reconstruct sensitive fields or masked values that the tools did not return.
If `dataPolicy.truncated` is true, say the result is limited and use the Prego link for the full view.

Preserve the current user's customer, payroll, and people-data permissions.
Business results decide and return each company's actual permission and coverage. Do
not infer a company, pay type, month, sequence, preparation revision, or
readiness conclusion when the permitted reads do not supply it. State the
resolved scope and company count, then limit the response to returned evidence.

Include only the successful companies' `handoffs` returned by the business
tools, preserving their company, month, pay type, and pay sequence query state
exactly. Do not construct an unscoped base URL or a payroll-run URL. Do not
claim that calculation can start; these tools do not read active payroll-run
execution state.
