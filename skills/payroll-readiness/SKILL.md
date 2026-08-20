---
name: payroll-readiness
description: "Check Prego payroll preparation, run readiness, and ledger context without changing payroll."
---

# Payroll readiness

Use this to assess whether a payroll scope is ready to calculate.

Use only the approved read tools `prego_payroll_prepare_readiness`
(`payroll.prepare.readiness.read`), `prego_payroll_run_readiness`
(`payroll.run.readiness.read`), and `prego_payroll_ledger`
(`payroll.ledger.read`). If a tool is unavailable, do not substitute another
tool. Never start a calculation, retry, confirm results, or change a ledger.

Do not reconstruct sensitive fields or masked values that the tools did not return.
If `dataPolicy.truncated` is true, say the result is limited and use the Prego link for the full view.

Preserve the current user's company, payroll, and people-data permissions. Do
not infer a company, pay type, month, sequence, preparation revision, or
readiness conclusion when the permitted reads do not supply it. State the
missing scope and limit the response to the returned evidence.

Always include the relevant Prego direct links:

- Payroll preparation: `https://prego.team/app/payroll/payroll-prepare`
- Payroll run: `https://prego.team/app/payroll/payroll-run`
- Payroll ledger: `https://prego.team/app/payroll/payroll-ledger`

Only add URL state when every required value is returned: preparation needs
`companyId`, `yearMonth`, `payTypeId`, `paySeq`, and `tab`; run uses the same
scope fields. Otherwise keep the
base Prego link and explicitly say that its scope was not reconstructed.
