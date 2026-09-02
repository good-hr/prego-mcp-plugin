---
name: onboarding-import
description: "Prepare and preflight official Prego employee and payroll onboarding Excel files from customer source spreadsheets. Use when an HR or implementation user asks to migrate, upload, or set up many employees in Prego, not to audit data already stored in Prego."
---

# Prego onboarding import

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps. Phrase uncertain causes and follow-up not explicit in the evidence as
possibilities or suggestions; reserve decision language for choices supported
by the returned evidence.

Call `prego_company_context` and resolve one company. Call
`prego_onboarding_import_catalog` without `itemId` before deciding which files
to create. Always make these two discovery calls even when no source file is
attached; a missing attachment stops item selection and preflight, not discovery.
Inspect only files attached in the current chat or explicitly
supplied in the current workspace. If none is available, ask for an attachment;
never search for or reuse prior or temporary artifacts. Select only groups with
source evidence, then call the catalog once per selected `itemId` to obtain the
official empty workbook. Preserve its sheets, headers, code rows, dropdowns,
and hidden metadata; fill only the Data sheet. Never recreate a Prego workbook
from memory.

A source field that could fit more than one information type is not enough to
select an additional workbook. For example, a hire date alone does not prove an
HR event type or employment status. Select an event, history, or payroll group
only when its required business values are explicit in the source or confirmed
by the user. Do not derive required values merely to make a template pass.

Use exact codes from each workbook's Codes sheet. Do not fuzzy-map an
organization, job, duty, pay item, bank, or policy code. Group ambiguous values
into a short blocker question. Do not invent values for missing required
fields. Do not infer that a field is required from example values, cell styles,
or dropdowns; use the official preflight result to decide whether a blank field
blocks delivery. Exclude passwords, credentials, resident-registration numbers,
and passport numbers from generated files and chat. If the source contains them,
warn the user without making source cleanup a blocker. Account, tax, insurance,
retirement, and garnishment fields may be filled only when the source explicitly
contains them and the matching payroll group is requested; do not repeat their
raw values in chat.

For a short or vague request such as "이거 Prego에 넣어줘", behave as a beginner
guide: explain the selected files in plain Korean and ask only blocking mapping
questions. For an HR operator, summarize missing rows and next actions. For a
payroll operator, keep HR and payroll validation results separate and never
call a file payroll-ready. Explain that onboarding preflight checks whether the
file can be uploaded; zero errors do not prove payroll calculation, payment, or
filing readiness. For an implementation expert, honor explicit group, cutover
date, and mapping choices and report source coverage and excluded rows. If the
user does not state a level, infer it from their requested control, not from job
title.

Create one official workbook per selected information type regardless of the
number of employees. Keep all applicable source rows in their original order;
do not split one information type into multiple workbooks. Encode each completed
workbook and call `prego_onboarding_import_preflight`. Fix only errors whose
correction is exact from the source and workbook codes; otherwise return row,
field, and one grouped question. Call preflight again only after changing a
workbook to fix an error returned by the previous call. Do not recheck an
unchanged or already valid workbook merely for confirmation.

Treat the first preflight as a reconciliation preview. Use its row decisions to
separate `NEW`, `CHANGE_REVIEW`, `UNCHANGED`, and `IDENTITY_CONFLICT` rows.
Exclude `UNCHANGED` rows from the deliverable and report their count as excluded
coverage. A same-name, different-employee-number row is an identity conflict,
never proof of a match; withhold it and ask whether it is a different person or
an employee-number correction. For `CHANGE_REVIEW`, show the source row and
changed field names without repeating existing or sensitive values, and wait
for explicit confirmation before including that row. Never reinterpret either
case as permission to overwrite. After the user resolves conflicts and approves
changes, build the final workbook from new rows plus only the approved changed
rows, preserve source order, and preflight it again.

Return the generated workbook files, per-file valid/error/warning counts,
new/changed/unchanged/conflict counts, unresolved blockers, source coverage,
and the Prego handoffs. Preflight is
read-only and does not create a batch, upload, save, generate codes, or mark
system onboarding complete. Tell the user to inspect and upload the files in
Prego. Because a handoff cannot attach a local workbook or preselect an upload
group, name the exact information type to select and tell the user to choose
the generated file before running "파일 확인". Never claim completion from zero
preflight errors alone.
