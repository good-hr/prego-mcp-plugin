---
name: payroll-policy-builder
description: "Set up or change Prego payroll allowances, recurring month conditions, and payment or deduction items; validate formulas and save requested settings. Use for HR compensation policy setup, not payroll result confirmation or bank payment."
---

# Payroll policy builder

Apply `$prego-interpretation` and the payroll reference in `referenceSkills`
returned by Prego reads.
Use current `prego_capabilities` schemas with `prego_read` for queries and
`prego_update` for requested saves; an old installed skill or a
non-persistent preview does not mean the connection cannot save settings.

## Resolve the HR policy

Read the company, `payroll.settings.policy.read` for current payroll types and
`payroll.payment-item.list.read` for relevant existing items before
planning a change. Reuse an existing item of the same purpose when the user's
intent and its scope match. Resolve internal IDs from reads, not from the user.

Identify the amount or formula, eligible group, recurring period, effective
start, and payroll type from the request and company rules. “With the monthly
salary” means its regular payroll type, even if the allowance is named a bonus;
the item's tax classification does not select the payroll type. When the data
uniquely matches that intent, use it. Ask a short business question only for an
unresolved choice that changes the result, not merely because several types or
sequences exist. A policy setup does not require an existing payroll settlement.
Use `payroll.prepare.readiness.read` when a request actually selects a settlement.

Distinguish fixed attribution months from payment dates. “January and September
each year” can use the catalog's numeric payroll-month variable. “The payday
before Lunar New Year and Chuseok” also requires the holiday dates and company
payment rule; do not silently replace it with fixed months. If that calendar
condition is unavailable, explain the gap and offer a concrete supported policy
for the user to choose. Keep that choice separate from whether a formula can be
saved. Market research supports a recommendation, not a company decision or a
legal classification. Preserve existing classifications unless changing them is
part of the request; resolve materially missing classifications before saving.

Use the user's effective start or an established company rule for a write.
For a read-only draft with no period, follow the returned payroll-period
guidance and disclose the assumption. Do not use that assumption alone for a
write. Preview uses `YYYY-MM`; readiness uses compact `YYYYMM`.

## Validate the intended rule

Discover `payroll.policy.preview.read` without a formula and use its canonical
variables, functions and operators exactly. For an edit, pass the existing
payment-item ID as supported by its schema. Do not create a duplicate just to
avoid a preview limitation.

Use `person.list.read` to select only a few permission-visible samples needed to exercise the rule.
Role-specific policies need target and non-target roles; a month-only fixed
allowance needs payment and non-payment months, not a target duty code. Check
each requested month and at least one excluded month. Report sample errors,
unsupported scenarios and any individual amount overriding the formula; syntax
validity alone is not proof of the amount. Never extrapolate samples to company
totals. If the proposed payroll-type link cannot yet be simulated, distinguish
that limitation and verify the stored item in that type after the requested save.

## Complete the requested setting

“Set up”, “add”, and “change” are save requests. Once the policy is resolved,
use the discovered `payroll.payment-item.create` or
`payroll.payment-item.update`; do not finish with a copyable draft or a screen
link simply because preview itself is read-only. State the concrete change
before execution without requiring a second conversational approval for an
already authorized setting. Preserve all unrelated fields in a full update.
Save the formula, intended payroll-type links and effective period together.

Read the saved item back and check those fields against the requested policy.
Then report the months, amounts, payroll type and effective start in HR terms,
with the returned Prego link. Distinguish settings saved from preparation,
calculation and payment; do not confirm preparation, activate arbitrary Circuit
definitions, recalculate results or transfer money merely to finish policy setup.
On a partial failure, say what was saved and what remains, and inspect current
state before retrying. A preview or successful process exit is not save evidence.

For deduction-only settings, use `payroll.deduction-item.list.read` and
`payroll.deduction-item.create` or `payroll.deduction-item.update` directly;
the payment preview is not a deduction
simulation. Lifecycle and ordering requests use their discovered action payloads;
calculation order and display order are different. Respect dependency guards and
shared-policy scope, and re-read the result.
