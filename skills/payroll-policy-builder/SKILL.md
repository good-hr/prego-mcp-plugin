---
name: payroll-policy-builder
description: "Draft, validate, and sample-test a supported Prego payroll allowance formula. Use when an HR leader or payroll operator is preparing a payment rule such as a role allowance."
---

# Payroll policy builder

Call `prego_company_context` and resolve one company, effective month,
payment-item classification, target role codes, and amounts. Use `YYYY-MM` for
the effective month. Resolve the pay type and sequence with
`prego_payroll_prepare_readiness`; never ask the user for an opaque ID.
First call `prego_payroll_policy_preview` without a formula to discover the
allowed duty codes. Then call `prego_person_list` and select at most five
permission-visible samples whose returned `dutyCode` covers the target roles
and a non-target role. Never scan or guess people. Call the preview again with
the formula, item code and name, and those sample IDs. In the formula, use the
returned `dutyExpression` exactly; never invent a duty variable alias or helper
function. Use only
variables and operators accepted by its catalog. The preview must validate the
formula against the supported payroll expression contract, report current
Circuit readiness, run non-persistent sample tests, and return the selected
samples' amount impact before any change. Never infer
company-wide affected counts or amounts from those samples.

Show a copyable exact draft, test cases, limitations, and Prego handoff. The v1 MCP is
read-only: it does not save a payment item or activate a Circuit. Tell the user
that the handoff opens the general payroll settings screen, where the item
classification and draft must be entered and reviewed before saving.
Never claim that preview changed payroll, and never change confirmed results.
