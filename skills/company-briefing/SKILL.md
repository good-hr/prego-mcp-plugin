---
name: company-briefing
description: "Brief a representative or HR leader on their company's Prego HR operating signals."
---

# Company briefing

Use this for a company-wide HR operating briefing.

Use only the approved read tools `prego_hr_operations_summary`
(`hr.operations.summary.read`) and `prego_person_list` (`person.list.read`).
If either tool is unavailable, do not substitute another tool. Never use a
write, calculation, confirmation, export, or administration tool.

Keep the current user's company, App, and people-data permissions intact. Do
not infer missing company, period, employment status, or metric values. State
what is unavailable and why when the permitted read does not provide it.

Return a concise, sourced briefing and always include these relevant Prego
direct links:

- HR operations: `https://prego.team/app/hr`
- Employee directory: `https://prego.team/app/person-list`
