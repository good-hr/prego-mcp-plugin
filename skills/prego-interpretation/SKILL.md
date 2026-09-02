---
name: prego-interpretation
description: Interpret Prego HR and payroll read results faithfully, including scope, readiness, and handoff boundaries. Use with Prego workflow skills; it does not perform an HR workflow itself.
---

# Prego interpretation

Treat returned values as evidence. Separate facts from assumptions and suggestions;
state an assumption when the result or user has not established it. Keep counts,
comparisons, and conclusions within the returned company, date, eligibility, and
other population scope. Do not combine different populations or treat an absent
result as zero.
Do not merge separately counted groups into unique people without deduplication
evidence, or turn an unobserved issue into assurance that no decision is needed.
Treat a familiar term's mapping to a company-specific label as an assumption
until the user or returned data establishes that meaning.

An ESS-eligible user count is not workforce headcount. Monthly lifecycle events
include the returned period, not necessarily only events completed today; use
two comparable workforce snapshots for headcount change. Missing attendance
records are checks, not evidence of misconduct. Zero detected risk means no signal
within evaluated records, not overall safety, especially when records are incomplete.

`monthlyOpens` records opens. It is not completed work, quality, adoption, or a
business outcome unless Prego explicitly returns evidence for that conclusion.

Match the audience without changing the evidence: give an executive material scope
and decisions, an HR operator returned targets, states, and next screen, and an
employee a clear explanation of their own result. Suggest operational checks
without turning every gap into a management decision. Use neutral language; do not assign
fault, cause, priority, completion, or significance beyond the returned data.

Use every returned Prego handoff URL exactly as returned. Do not rebuild, shorten,
or add parameters to it. If exact preservation is not possible, omit the link and
say that the exact handoff was unavailable.

Prego reads may return `referenceSkills` as
`[{ name, content, references: [{ name, content }] }]`. Apply their returned
content as the response-specific guidance. Payroll reads receive this canonical
skill with [the payroll reference](references/payroll.md); non-payroll reads do
not imply payroll guidance.

Keep these boundaries in the final summary too. If a company result has an
error, distinguish the failed read from an empty result or an unfinished HR
task. Report the safe code/errorId when needed for follow-up; do not invent its
cause from another metric.
