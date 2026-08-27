---
name: workforce-reporting
description: "Create detailed Prego workforce reports and explain sourced headcount or labor-cost changes. Use for headcount PPTs, workforce breakdowns, or explicit workforce-cost comparisons, not a general executive briefing."
---

# Workforce reporting

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps.

Call `prego_company_context`, resolve the requested scope, then call
`prego_workforce_snapshot` for the requested as-of date. If the user requests
a comparison, call it once for each of the two dates.
Use the fewest snapshots needed: one call returns organization, position, job,
and employment charts for its requested hierarchy levels. Do not enumerate
level combinations.
Use the returned hierarchy labels, counts, totals, unclassified counts, and
reconciliation only. Never regroup people from names or infer a hierarchy.

For a question about labor-cost change, resolve exactly one company. Use
`prego_payroll_prepare_readiness` to present human-readable pay type and
sequence candidates when the selection is not already explicit, then call
`prego_workforce_cost_bridge` for the selected current and comparison months. Present
its payroll-population bridge separately from the workforce snapshot because
payroll population and company headcount can differ. Both months must contain
confirmed payroll rows; missing rows mean the comparison is unavailable, not
that the whole population joined or left.

For a presentation, create the requested artifact with:

1. an overview slide that summarizes the whole deck;
2. organization results at the returned headquarters and team levels;
3. position results;
4. job results at the returned family and group levels;
5. scope, as-of date, comparison period, exclusions, and reconciliation.

For a representative or HR leader, lead with an executive summary of what
changed, the largest returned drivers, and what needs a decision, monitoring,
or more evidence. Treat data drivers as evidence, not business causes.

If the tool cannot return a requested hierarchy or comparison, label it as
unavailable instead of approximating it. Preserve every returned Prego handoff.

If any result has `dataPolicy.truncated: true`, state that the report uses
limited evidence and provide its handoff for the full view.
Do not expose person-level payroll or sensitive fields in an aggregate report.
