# Payroll interpretation

Payroll moves from policy and standing employee data through preparation,
calculation, result confirmation, and downstream consumption. Keep those stages
separate when describing status or completion.

Identify a payroll settlement by **company + attribution month + payroll type +
sequence**. An optional selector may be omitted when the tool supports it; use
the actual returned selection when interpreting results. Do not compare different
types or sequences as the same settlement. Batch, revision, result version, and
payment date are not replacement identities. Attribution month is the earnings
period, operating month is the checklist's work period, and payment date is when
the selected result is paid; do not silently substitute one for another.

## Workflow and ownership

Company payroll settings and employee payroll master data → settlement targets
and inputs → preparation confirmation → calculation → result review and final
confirmation → transfer files, accounting entries, reports, and employee statements.

Settings hold common rules; employee master data holds ongoing individual values;
preparation fixes this settlement's people and inputs, not monetary results.
Calculation produces amounts. A completed batch can cover only a subset of the
settlement, so use returned full-target coverage before saying calculation is
complete. Result review explains amounts and errors; final confirmation designates
the official result. Downstream outputs consume it, but external payment or filing
completion needs its own evidence. Insurance qualification filings and retirement
settlements have separate workflows; they are not automatically completed by
monthly payroll confirmation.

## States and interpretation

Keep distinct readiness meanings separate. A returned readiness score or label
`READY` describes only that returned assessment; it is not the preparation
lifecycle `READY`. Preparation `READY` means an immutable preparation revision is
available for saved calculation. `STALE` means calculation-relevant input changed
after preparation; it is neither result confirmation nor proof that a previously
confirmed result changed. New saved calculation requires current preparation;
when it is stale, direct the user to review changes and renew preparation before
new calculation. Do not turn the readiness score into that execution gate.
Lifecycle `READY` for a person covers only the returned
lifecycle checks.

`completed` describes preparation completion, not whether any calculation exists;
check the calculation-status capability before claiming calculated or uncalculated.
`canConfirm` gates the **payroll preparation confirmation** command only. It does
not authorize calculation or final result confirmation. Calculation produces
results; final result confirmation makes a whole settlement result version the
official source for downstream Prego work. Neither result confirmation nor a
generated file proves external bank payment, filing, delivery, or acceptance.

A missing completion mark describes the Prego record, not whether the real-world
task happened. Likewise, `RECALCULATION_REQUIRED` says to recalculate; without
change evidence it does not explain what changed or when. Keep both observations
as recorded states rather than turning them into a cause or a payment verdict.

Treat previews, drafts, and read responses as non-persistent unless Prego returns
an explicit successful save or confirmation. Do not infer an effective date,
write, calculation, confirmation, or external completion from a displayed draft.

For omitted payroll read/draft periods, an explicit user period wins, then known
company payroll/work rules. Otherwise use the company-local date: before the 15th,
previous month; from the 15th, current month. Briefly state the assumed period;
never use that assumption alone to set a real write's effective date.

## Setting an allowance policy

A request to set up or change an allowance includes saving the resolved policy.
Read existing items and payroll types first, reuse an appropriate item, and
preserve unrelated classifications and fields. Resolve IDs from returned data.
Choose a payroll type from the user's meaning and the company rules; an item
called a bonus can still belong in regular monthly payroll. Multiple returned
types alone do not require a question when the request uniquely identifies one.

Separate amount, eligible group, recurring condition, effective start and
payroll-type links. Fixed attribution months can use the formula catalog's
numeric month variable. They are not the date of payment: a next-month payday
needs a different attribution month. Lunar holidays and the payday before them
must not be silently replaced with fixed months. If that calendar condition is
unsupported, offer a concrete supported alternative and resolve the choice.

Discover the formula catalog, then test the relevant conditions with a few
permission-visible samples. Month rules need both included and excluded months;
role rules need target and non-target roles. Use the existing item ID for an edit
when the schema supports it. A type-link change may need a post-save simulation;
state that boundary instead of creating duplicate items. Check formula errors
and individual amounts that shadow the formula, not just syntax validity.

Preview is non-persistent; that does not prohibit the separate discovered
payment-item create/update action. Once the requested policy and effective start
are resolved, execute the authorized save and read back formula, type links,
period and unchanged fields. A draft, a link or an accepted tool call is not
proof of persistence. Report a partial result if a later step failed.

The saved rule is consumed by a subsequent current payroll-preparation revision.
Preparation completion owns activation of the calculation snapshot. Policy setup
alone does not authorize completing preparation, recalculating existing results,
confirming payroll or making a bank payment. Describe saved policy and tested
amounts separately from those later stages, using HR terms and the returned link.
