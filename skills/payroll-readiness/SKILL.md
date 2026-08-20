---
name: payroll-readiness
description: "Check Prego payroll preparation and existing ledger context without changing payroll."
---

# Payroll readiness

Use this to assess payroll preparation blockers and existing ledger results.

Use only the approved read tools `prego_payroll_prepare_readiness`
(`payroll.prepare.readiness.read`) and `prego_payroll_ledger`
(`payroll.ledger.read`). If a tool is unavailable, do not substitute another
tool. Never start a calculation, retry, confirm results, or change a ledger.
Call the ledger only for one payroll month and 1-100 explicit `personIds`
already returned within the current user's permitted scope. Do not omit or
invent `personIds` to request a company-wide ledger.

Do not reconstruct sensitive fields or masked values that the tools did not return.
If `dataPolicy.truncated` is true, say the result is limited and use the Prego link for the full view.

Preserve the current user's company, payroll, and people-data permissions. Do
not infer a company, pay type, month, sequence, preparation revision, or
readiness conclusion when the permitted reads do not supply it. State the
missing scope and limit the response to the returned evidence.

Always include the relevant Prego direct links:

- Payroll preparation: `https://prego.team/app/payroll/payroll-prepare`
- Payroll ledger: `https://prego.team/app/payroll/payroll-ledger`
- Payroll run manual follow-up: `https://prego.team/app/payroll/payroll-run`

Keep the base Prego links and explicitly say that their scope was not
reconstructed. Do not claim that calculation can start; the v1 tools do not
read active payroll-run execution state.
