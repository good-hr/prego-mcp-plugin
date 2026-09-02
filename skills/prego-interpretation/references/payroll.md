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
