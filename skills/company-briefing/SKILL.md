---
name: company-briefing
description: "Brief a representative or HR leader on their company's Prego HR operating signals."
---

# Company briefing

Use this for a company-wide HR operating briefing.

First call `prego_company_context` (`company.context.read`). It is the source
for customer companies available for scope resolution and their UUIDs; it does
not grant data access. Then use only `prego_hr_operations_summary` (`hr.operations.summary.read`) and
`prego_person_list` (`person.list.read`). If a required tool is unavailable,
do not substitute another tool. Never use a write, calculation, confirmation,
export, or administration tool.

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

Keep the current user's customer, App, and people-data permissions intact.
Business results decide and return each company's actual permission and coverage.
Do not infer missing company, period, employment status, or metric values.
State the resolved scope and company count, and say what is unavailable and why
when the permitted read does not provide it.

Return a concise, sourced briefing. Include only the successful companies'
`handoffs` returned by the business tools, preserving their company and period
query state exactly. Do not construct or replace them with unscoped base URLs.
