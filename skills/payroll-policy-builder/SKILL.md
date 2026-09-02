---
name: payroll-policy-builder
description: "Draft, validate, and optionally save a supported Prego payroll allowance formula. Use when an HR leader or payroll operator is preparing a payment rule such as a role allowance."
---

# Payroll policy builder

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps. Phrase uncertain causes and follow-up not explicit in the evidence as
possibilities or suggestions; reserve decision language for choices supported
by the returned evidence.

Call `prego_capabilities` and resolve one company from its context. It is also
the permission-filtered catalog: use `prego_read` with `capabilityId`, `scope`,
and capability-specific `arguments`, and never invent an ID or call one it did
not return. Use `YYYY-MM` for `payroll.policy.preview.read`'s `yearMonth` and
compact `YYYYMM` for `payroll.prepare.readiness.read`'s `yyyymm`; for example,
the same month is `2026-08` in preview and `202608` in readiness. If the user
omits it, use the current business month for the non-persistent draft and state
that assumption; do not stop only to ask for a month that can be changed before
saving.

Resolve the pay type and sequence with `payroll.prepare.readiness.read`; never
ask the user for an opaque ID. Ask one short choice only when it returns
multiple payroll selections. Stop there until the user chooses: do not
recommend a candidate without an explicit returned marker or read the catalog,
person list, or formula preview first. Then read `payroll.policy.preview.read`
without a formula to discover the available variables, functions, operators,
and allowed duty codes. Read `person.list.read` and select at most five
permission-visible samples whose returned `dutyCode` covers the target roles
and a non-target role. Never scan or guess people. Read the preview again with
the formula, a clear draft item code and name, and those sample IDs. If the
selected samples contain no permission-visible employee with a target-role
`dutyCode`, do not read the formula preview; return the exact draft and state
that validation and target-role amount impact remain unverified. A draft code
and default calculation order are preview inputs, not business blockers; label
them as changeable and let validation report a conflict. In the formula, use
the returned canonical variable expressions exactly; never invent a variable
alias or helper function. Use only variables, functions, and operators returned
by its catalog. The preview must validate the formula against the supported
payroll expression contract, report current Circuit readiness, run
non-persistent sample tests, and return the selected samples' amount impact
before any change. Never infer company-wide affected counts or amounts from
those samples.

Show a copyable exact draft, test cases, limitations, and Prego handoff. If the
sample results are discussed, show only the role and amount impact by default,
not names, employee numbers, or email addresses. If the
user explicitly asks to save a supported payment item after reviewing the
draft, first read `payroll.payment-item.list.read`; for an edit, preserve every
unchanged field returned by that read. Then call `prego_update` with either
`payroll.payment-item.create` or `payroll.payment-item.update`. State the exact
item and fields that will change immediately before the call, but do not ask a
second conversational confirmation: the client's destructive-tool approval is
the confirmation. Do not use `prego_update` for activation, deletion,
reordering, payroll calculation, or confirmed results. A formula preview never
changes payroll, and an unavailable update capability means the user must use
the returned Prego handoff instead.
