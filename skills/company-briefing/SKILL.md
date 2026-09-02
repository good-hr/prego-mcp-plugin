---
name: company-briefing
description: "Brief a representative or HR leader on Prego workforce, HR master-data completeness, product usage, and operating signals. Use for executive requests such as '인사 브리핑', '우리 회사 인력 상황', 'Prego를 잘 쓰고 있나', or '사람들 정보가 잘 들어갔나', not today's task priorities."
---

# Company briefing

## Workflow

1. Call `prego_capabilities` first. It returns the connected company context and
   only the capability IDs available to this user. Use `prego_read` for each
   permitted read with `capabilityId`, `scope`, and capability-specific
   `arguments`; never invent an ID or call one that was not returned.
2. Choose one aggregate path. Run independent reads in parallel when the client
   supports it:
   - General executive briefing: call `prego_read` for
     `workforce.snapshot.read`, `hr.operations.summary.read`, and
     `attendance.operations.summary.read` for aligned dates with
     `previewSize: 0`. Keep the canonical `includeIdle: false` population.
     Preserve the default hierarchy levels and state the returned population,
     as-of date, and hierarchy basis; change them only when the user requests a
     different population or grouping. Omit `orgLevel` and `jobLevel` to use
     their defaults; never send `0` as a default.
   - HR master-data completeness: call only `workforce.snapshot.read` and
     `hr.operations.summary.read` with `previewSize: 0`; do not call attendance.
   - Prego product usage: call only `hr.operations.summary.read` with
     `previewSize: 0`; do not call workforce, attendance, lifecycle, or payroll.
3. Do not call person list or lifecycle detail tools for a general briefing.
   Route an explicit task-priority, new-hire, or leaver question to
   `$hr-control-tower`.

For an aggregate HR master-data completeness question, do not route to
onboarding import or inspect person-level rows unless the user explicitly asks
who is affected. Report only the returned required-information and workforce
classification completeness; omit lifecycle and attendance signals unless the
user asks for them. In this path, read `missing-required` from HR action signals
and `UNASSIGNED` counts from workforce charts, but do not narrate
`monthlyChanges`. Put fields or causes not present in the aggregates under
`Unknown`, and include both returned handoffs.

## Interpretation boundaries

HR and payroll records affect people and consequential work. Keep observations,
interpretations, and actions distinct. Use neutral language; do not judge an
employee, team, or company, or assign significance, cause, priority, or
completion beyond the returned evidence. State uncertainty instead of filling
gaps. Phrase uncertain causes and follow-up not explicit in the evidence as
possibilities or suggestions; reserve decision language for choices supported
by the returned evidence. Write this briefing as an information organizer, not
as a consultant diagnosing the company.

Use aggregate counts only; do not expose preview-row names or turn the briefing
into an operator task queue. For a current month, separate returned lifecycle
events in
`effectiveThroughAsOf` from `scheduledAfterAsOf`. Monthly hire and termination
counts are not headcount change; only compare two workforce snapshots when the
user asks for change.

Do not compare counts whose returned populations differ. State the difference
and put its cause under `Unknown`. A zero risk count applies only to the returned
evaluation source and person count; it is not proof of company-wide absence.
Attendance eligibility or operation rate is not proof of complete punch data;
present it separately from commute anomalies and recognized work time.

Do not add qualitative labels without a returned benchmark. Put unsupported
significance, cause, or priority under `Unknown`.

For product usage, report only the returned feature-level observations.
`activeUsers` and `uniqueUsers` are per metric or app; do not combine them,
infer that they are the same people, or turn them into overall adoption.
`monthlyOpens` measures opens, not work quality or business outcomes. Without a
returned benchmark, keep overall adoption and dependence on particular users
under `Unknown`.

## Output

Return, in order:

1. one factual sentence describing the Prego HR scope; add an overall
   assessment only when a returned benchmark supports it;
2. at most three material workforce or operating signals;
3. `Decision needed`, `Monitor`, and `Unknown` items supported by the results;
4. company scope, reference dates, coverage, truncation, and returned handoffs.

Copy each returned handoff URL verbatim. Do not rebuild it or shorten a full
`referenceDate` to a month. If the exact URL cannot be preserved, omit it
instead of emitting a modified link.

Use `Decision needed` only for an actual choice or tradeoff; otherwise write
`Decision needed: none` and place operational checks under `Monitor`.
Do not create a deck unless the user explicitly requests one; detailed
workforce reports belong to `$workforce-reporting`.
