---
name: today-hr-operations
description: "Summarize the HR and attendance operations a Prego HR team should review today."
---

# Today HR operations

Use this for a daily HR operations review.

First call `prego_company_context` (`company.context.read`). It is the source
for customer companies available for scope resolution and their UUIDs; it does
not grant data access. Then use only `prego_hr_operations_summary` (`hr.operations.summary.read`) and
`prego_attendance_operations_summary` (`attendance.operations.summary.read`).
If a required tool is unavailable, do not substitute another tool. Never use a
write, approval, correction, calculation, or administration tool.

For a new request, use `scope.mode: "default"` unless the user names one or
more companies or asks for the whole group. Map unambiguous returned company
labels to `scope.mode: "selected"` with those `companyIds`; use
`scope.mode: "all"` only for all customer companies. If a name or a
follow-up after a multi-company result is ambiguous, ask the user to choose
from returned labels before a business read. After a resolved business result,
reuse its exact scope for follow-ups unless the user changes it. Keep this only
in the conversation; do not claim that Prego stores a last scope.

Do not reconstruct sensitive fields or masked values that the tools did not return.
If `dataPolicy.truncated` is true, say the result is limited and use the Prego link for the full view.

Respect the current user's customer, App, attendance, and people-data
permissions. Do not infer a date, issue state, owner, or resolution from
missing data. Business results decide and return each company's actual
permission and coverage. Separate HR and attendance findings, state the resolved scope and
company count, and say which permitted read did not return data when applicable.

Include only the successful companies' `handoffs` returned by the business
tools. Preserve each URL's company and resolved period query state exactly; do
not construct or replace it with an unscoped base URL.
