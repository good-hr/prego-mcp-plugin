---
name: workforce-reporting
description: "Create detailed Prego workforce reports and explain sourced headcount or labor-cost changes. Use for headcount PPTs, workforce breakdowns, or explicit workforce-cost comparisons, not a general executive briefing."
---

# Workforce reporting

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps. Phrase uncertain causes and follow-up not explicit in the evidence as
possibilities or suggestions; reserve decision language for choices supported
by the returned evidence.

Call `prego_capabilities`, resolve the requested scope from its context, then
use `prego_read` with `capabilityId`, `scope`, and capability-specific
`arguments`. Never invent an ID or call one that was not returned. Read
`workforce.snapshot.read` for the requested as-of date. If the user requests a
comparison, read it once for each of the two dates.
Unless the user requests another population, keep `includeIdle: false` and the
tool's default hierarchy levels. Report the returned population, idle scope,
hierarchy levels, and as-of date as part of the report scope.
Omit `orgLevel` and `jobLevel` when using their defaults; never send `0` as a
default.
Use the fewest snapshots needed: one call returns organization, position, job,
and employment charts for its requested hierarchy levels. Do not enumerate
level combinations.
Use the returned hierarchy labels, counts, totals, unclassified counts, and
reconciliation only. Never regroup people from names or infer a hierarchy.

For a question about labor-cost change, resolve exactly one company. Use
`payroll.prepare.readiness.read` to present human-readable pay type and
sequence candidates when the selection is not already explicit. When it
returns multiple candidates, ask the user to choose and do not call
`workforce.cost.bridge.read` until they do; never treat the first candidate as
a default or recommendation without an explicit returned marker. Workforce
snapshots may still be compared while waiting. Then call
`workforce.cost.bridge.read` for the selected current and comparison months. Present
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
unavailable instead of approximating it. Include every returned Prego handoff
URL verbatim in the final answer; label a general screen as general.

If any result has `dataPolicy.truncated: true`, state that the report uses
limited evidence and provide its handoff for the full view.
Do not expose person-level payroll or sensitive fields in an aggregate report.
