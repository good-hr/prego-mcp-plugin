---
name: payroll-policy-builder
description: "Draft, validate, and sample-test a supported Prego payroll allowance formula. Use when an HR leader or payroll operator is preparing a payment rule such as a role allowance."
---

# Payroll policy builder

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps. Phrase uncertain causes and follow-up not explicit in the evidence as
possibilities or suggestions; reserve decision language for choices supported
by the returned evidence.

Call `prego_company_context` and resolve one company, effective month,
payment-item classification, target role codes, and amounts. Use `YYYY-MM` for
the policy preview's `yearMonth`. Use compact `YYYYMM` for
`prego_payroll_prepare_readiness.yyyymm`; for example, the same month is
`2026-08` in policy preview and `202608` in readiness. If the user omits it,
use the current business month for the read-only draft and state that
assumption; do not stop only to ask for a month that can be changed before
saving. Resolve the pay type and sequence with
`prego_payroll_prepare_readiness`; never ask the user for an opaque ID. Ask one
short choice only when that tool returns multiple payroll selections. Stop
there until the user chooses: do not recommend a candidate without an explicit
returned marker or call the catalog, person list, or formula preview first.
Then call `prego_payroll_policy_preview` without a formula to discover the
available variables, functions, operators, and allowed duty codes. Then call `prego_person_list` and select at most five
permission-visible samples whose returned `dutyCode` covers the target roles
and a non-target role. Never scan or guess people. Call the preview again with
the formula, a clear draft item code and name, and those sample IDs. If the
selected samples contain no permission-visible employee with a target-role
`dutyCode`, do not call formula preview; return the exact draft and state that
validation and target-role amount impact remain unverified. A draft code and
the default calculation order are preview inputs, not business blockers; label
them as changeable and let validation report a conflict. In the formula, use the returned canonical
variable expressions exactly; never invent a variable alias or helper
function. Use only variables, functions, and operators returned by its catalog.
The preview must validate the
formula against the supported payroll expression contract, report current
Circuit readiness, run non-persistent sample tests, and return the selected
samples' amount impact before any change. Never infer
company-wide affected counts or amounts from those samples.

Show a copyable exact draft, test cases, limitations, and Prego handoff. The v1 MCP is
read-only: it does not save a payment item or activate a Circuit. Tell the user
that the handoff opens the general payroll settings screen, where the item
classification and draft must be entered and reviewed before saving.
Never claim that preview changed payroll, and never change confirmed results.
