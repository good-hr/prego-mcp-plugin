---
name: onboarding-import
description: "Prepare and preflight official Prego employee and payroll onboarding Excel files from customer source spreadsheets. Use when an HR or implementation user asks to migrate, upload, or set up many employees in Prego."
---

# Prego onboarding import

Call `prego_company_context` and resolve one company. Call
`prego_onboarding_import_catalog` without `itemId` before deciding which files
to create. Inspect the user's source attachments, select only groups with
source evidence, then call the catalog once per selected `itemId` to obtain the
official empty workbook. Preserve its sheets, headers, code rows, dropdowns,
and hidden metadata; fill only the Data sheet. Never recreate a Prego workbook
from memory.

Use exact codes from each workbook's Codes sheet. Do not fuzzy-map an
organization, job, duty, pay item, bank, or policy code. Group ambiguous values
into a short blocker question. Do not invent values for missing required
fields. Do not infer that a field is required from example values, cell styles,
or dropdowns; use the official preflight result to decide whether a blank field
blocks delivery. Never copy passwords, credentials, resident-registration numbers, or
passport numbers. Account, tax, insurance, retirement, and garnishment fields
may be filled only when the source explicitly contains them and the matching
payroll group is requested; do not repeat their raw values in chat.

For a short or vague request such as "이거 Prego에 넣어줘", behave as a beginner
guide: explain the selected files in plain Korean and ask only blocking mapping
questions. For an HR operator, summarize missing rows and next actions. For a
payroll operator, keep HR and payroll validation results separate and never
call a file payroll-ready. For an implementation expert, honor explicit group,
cutover date, mapping, and chunk choices and report source coverage and excluded
rows. If the user does not state a level, infer it from their requested control,
not from job title.

Keep each official workbook at 100 data rows or fewer. For larger sources,
split deterministically by source order and preserve a source-row-to-file-row
mapping. Encode each completed workbook and call
`prego_onboarding_import_preflight`. Fix only errors whose correction is exact
from the source and workbook codes; otherwise return row, field, and one grouped
question. Repeat preflight until each deliverable is valid or explicitly
blocked.

Return the generated workbook files, per-file valid/error/warning counts,
unresolved blockers, source coverage, and the Prego handoffs. Preflight is
read-only and does not create a batch, upload, save, generate codes, or mark
system onboarding complete. Tell the user to inspect and upload the files in
Prego. Because a handoff cannot attach a local workbook or preselect an upload
group, name the exact information type to select and tell the user to choose
the generated file before running "파일 확인". Never claim completion from zero
preflight errors alone.
