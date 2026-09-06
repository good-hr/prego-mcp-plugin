import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateConversation } from "./evaluate-prego-conversation.mjs";

const scenario = {
  id: "allowance-save",
  sourceScenarioIds: ["SKILL-ALLOWANCE-001"],
  skillIds: ["payroll-policy-builder"],
  question: "Save the validated allowance.",
  expect: {
    requiredCapabilities: ["payroll.payment-item.create"],
    forbiddenCapabilities: ["payroll.deduction-item.create"],
    updates: "required",
    readAfterUpdate: ["payroll.payment-item.list.read"],
  },
  review: ["Confirm the persisted allowance in Prego."],
};

function call(
  sequence,
  {
    tool,
    capabilityId,
    scope,
    server = "prego_fixture",
    transportStatus = "completed",
    businessStatus = "unknown",
    startedEvent = sequence * 2 - 1,
    completedEvent = transportStatus === "completed" ? sequence * 2 : null,
  },
) {
  return {
    sequence,
    itemId: `item-${sequence}`,
    server,
    tool,
    capabilityId,
    scope,
    transportStatus,
    businessStatus,
    startedEvent,
    completedEvent,
  };
}

function summary(toolCalls, overrides = {}) {
  return {
    process: { status: "COMPLETED" },
    transcript: {
      available: true,
      eventCount: toolCalls.length + 1,
      malformedLineCount: 0,
      toolCalls,
    },
    ...overrides,
  };
}

const companyA = { mode: "selected", companyIds: ["company-a"] };
const companyB = { mode: "selected", companyIds: ["company-b"] };

test("reports mechanical success but never business PASS for same-scope write readback", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyA,
      }),
      call(2, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
      }),
      call(3, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyA,
      }),
    ]),
  });
  assert.equal(report.mechanicalVerdict, "PASS");
  assert.equal(report.businessVerdict, "COVERAGE_GAP");
  assert.equal(report.exitCode, 0);
  assert.equal(
    report.checks.every((entry) => entry.status === "PASS"),
    true,
  );
});

test("rejects a post-update readback for another company", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
      }),
      call(2, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyB,
      }),
    ]),
  });
  assert.equal(report.exitCode, 1);
  assert.equal(
    report.checks.find(
      (entry) =>
        entry.id === "read-after-update:payroll.payment-item.list.read",
    )?.status,
    "FAIL",
  );
});

test("does not accept a read that happened before the update", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyA,
      }),
      call(2, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
      }),
    ]),
  });
  assert.equal(report.exitCode, 1);
  assert.match(
    report.checks.find(
      (entry) =>
        entry.id === "read-after-update:payroll.payment-item.list.read",
    )?.detail ?? "",
    /before the update completed/,
  );
});

test("does not accept a concurrent read that started before the update completed", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
        startedEvent: 1,
        completedEvent: 4,
      }),
      call(2, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyA,
        startedEvent: 2,
        completedEvent: 3,
      }),
    ]),
  });
  assert.equal(report.exitCode, 1);
  assert.match(
    report.checks.find(
      (entry) =>
        entry.id === "read-after-update:payroll.payment-item.list.read",
    )?.detail ?? "",
    /started before the update completed/,
  );
});

test("completed business failures do not satisfy required capabilities or updates", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
        businessStatus: "error",
      }),
    ]),
  });
  assert.equal(report.exitCode, 1);
  assert.equal(
    report.checks.find(
      (entry) => entry.id === "required-capability:payroll.payment-item.create",
    )?.status,
    "FAIL",
  );
  assert.equal(
    report.checks.find((entry) => entry.id === "updates")?.status,
    "FAIL",
  );
});

test("a failed required update fails even when another update completed", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
      }),
      call(2, {
        tool: "prego_update",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
        businessStatus: "error",
      }),
      call(3, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyA,
      }),
    ]),
  });
  assert.equal(report.exitCode, 1);
  assert.equal(
    report.checks.find((entry) => entry.id === "updates")?.status,
    "FAIL",
  );
});

test("discovery does not satisfy required capability evidence and forbidden attempts fail", () => {
  const discoveryOnly = evaluateConversation({
    scenario,
    summary: summary([
      call(1, {
        tool: "prego_capabilities",
        capabilityId: "payroll.payment-item.create",
        scope: companyA,
      }),
    ]),
  });
  assert.equal(
    discoveryOnly.checks.find(
      (entry) => entry.id === "required-capability:payroll.payment-item.create",
    )?.status,
    "FAIL",
  );

  const noWrite = {
    ...scenario,
    expect: {
      ...scenario.expect,
      requiredCapabilities: [],
      forbiddenCapabilities: ["payroll.deduction-item.create"],
      updates: "none",
      readAfterUpdate: [],
    },
  };
  for (const transportStatus of ["failed", "in_progress"]) {
    const report = evaluateConversation({
      scenario: noWrite,
      summary: summary([
        call(1, {
          tool: "prego_update",
          capabilityId: "payroll.deduction-item.create",
          scope: companyA,
          transportStatus,
        }),
      ]),
    });
    assert.equal(report.exitCode, 1);
    assert.equal(
      report.checks.find(
        (entry) =>
          entry.id === "forbidden-capability:payroll.deduction-item.create",
      )?.status,
      "FAIL",
    );
    assert.equal(
      report.checks.find((entry) => entry.id === "updates")?.status,
      "FAIL",
    );
  }
});

test("inflight, malformed, and empty traces cannot prove a no-write scenario", () => {
  const noWrite = {
    ...scenario,
    expect: {
      ...scenario.expect,
      requiredCapabilities: [],
      updates: "none",
      readAfterUpdate: [],
    },
  };
  const cases = [
    summary([
      call(1, {
        tool: "prego_read",
        capabilityId: "payroll.payment-item.list.read",
        scope: companyA,
        transportStatus: "in_progress",
      }),
    ]),
    summary(
      [
        call(1, {
          tool: "prego_read",
          capabilityId: "payroll.payment-item.list.read",
          scope: companyA,
        }),
      ],
      {
        transcript: {
          available: true,
          eventCount: 2,
          malformedLineCount: 1,
          toolCalls: [
            call(1, {
              tool: "prego_read",
              capabilityId: "payroll.payment-item.list.read",
              scope: companyA,
            }),
          ],
        },
      },
    ),
    summary([], {
      transcript: {
        available: true,
        eventCount: 1,
        malformedLineCount: 0,
        toolCalls: [],
      },
    }),
  ];
  for (const trace of cases) {
    const report = evaluateConversation({ scenario: noWrite, summary: trace });
    assert.equal(report.exitCode, 2);
    assert.equal(
      report.checks.find((entry) => entry.id === "updates")?.status,
      "COVERAGE_GAP",
    );
  }
});

test("only a selected single-company scope can prove write readback", () => {
  for (const scope of [
    { mode: "default", companyIds: [] },
    { mode: "all", companyIds: [] },
    { mode: "selected", companyIds: [""] },
    null,
  ]) {
    const report = evaluateConversation({
      scenario,
      summary: summary([
        call(1, {
          tool: "prego_update",
          capabilityId: "payroll.payment-item.create",
          scope,
        }),
        call(2, {
          tool: "prego_read",
          capabilityId: "payroll.payment-item.list.read",
          scope,
        }),
      ]),
    });
    assert.equal(report.exitCode, 2);
    assert.equal(
      report.checks.find(
        (entry) =>
          entry.id === "read-after-update:payroll.payment-item.list.read",
      )?.status,
      "COVERAGE_GAP",
    );
  }
});

test("rejects the removed optional update expectation", () => {
  assert.throws(
    () =>
      evaluateConversation({
        scenario: {
          ...scenario,
          expect: { ...scenario.expect, updates: "optional" },
        },
        summary: summary([]),
      }),
    /none or required/,
  );
});

test("runner scenario provenance rejects mismatched replay summaries but permits unlabeled legacy traces", () => {
  assert.throws(
    () =>
      evaluateConversation({
        scenario,
        summary: summary([], {
          scenarioId: "another-scenario",
          caseId: "another-scenario",
        }),
      }),
    /scenarioId/,
  );
  assert.throws(
    () =>
      evaluateConversation({
        scenario,
        summary: summary([], {
          scenarioId: scenario.id,
          caseId: scenario.id,
          scenarioSha256: "stale",
        }),
      }),
    /scenarioSha256/,
  );
  const legacy = evaluateConversation({
    scenario,
    summary: summary(
      [
        call(1, {
          tool: "prego_update",
          capabilityId: "payroll.payment-item.create",
          scope: companyA,
        }),
        call(2, {
          tool: "prego_read",
          capabilityId: "payroll.payment-item.list.read",
          scope: companyA,
        }),
      ],
      { caseId: "legacy-label" },
    ),
  });
  assert.deepEqual(legacy.executionProvenance, {
    mode: null,
    model: null,
    reasoningEffort: null,
    skillIds: null,
    skillSha256: null,
  });
});

test("report preserves raw and plugin execution provenance without changing the verdict", () => {
  const raw = evaluateConversation({
    scenario,
    summary: summary([], {
      mode: "raw-mcp",
      model: "gpt-5.6-terra",
      reasoningEffort: "low",
      skillIds: [],
      skillSha256: null,
    }),
  });
  const plugin = evaluateConversation({
    scenario,
    summary: summary([], {
      mode: "plugin-skill",
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      skillIds: ["payroll-policy-builder"],
      skillSha256: "skill-digest",
    }),
  });

  assert.deepEqual(raw.executionProvenance, {
    mode: "raw-mcp",
    model: "gpt-5.6-terra",
    reasoningEffort: "low",
    skillIds: [],
    skillSha256: null,
  });
  assert.deepEqual(plugin.executionProvenance, {
    mode: "plugin-skill",
    model: "gpt-5.6-terra",
    reasoningEffort: "high",
    skillIds: ["payroll-policy-builder"],
    skillSha256: "skill-digest",
  });
  assert.equal(raw.businessVerdict, "COVERAGE_GAP");
  assert.equal(plugin.businessVerdict, "COVERAGE_GAP");
});

test("process failure is an infrastructure error and a mechanical coverage gap", () => {
  const report = evaluateConversation({
    scenario,
    summary: summary(
      [
        call(1, {
          tool: "prego_update",
          capabilityId: "payroll.payment-item.create",
          scope: companyA,
        }),
        call(2, {
          tool: "prego_read",
          capabilityId: "payroll.payment-item.list.read",
          scope: companyA,
        }),
      ],
      { process: { status: "TIMED_OUT" } },
    ),
  });
  assert.equal(report.infrastructureVerdict, "INFRA_ERROR");
  assert.equal(report.mechanicalVerdict, "COVERAGE_GAP");
  assert.equal(report.exitCode, 2);
});

test("CLI records fresh summary and scenario provenance in a private report", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "prego-conversation-evaluator-"),
  );
  try {
    const manifestPath = join(directory, "scenarios.json");
    const summaryPath = join(directory, "summary.json");
    const outputPath = join(directory, "report.json");
    writeFileSync(manifestPath, JSON.stringify({ scenarios: [scenario] }));
    writeFileSync(
      summaryPath,
      JSON.stringify(
        summary([
          call(1, {
            tool: "prego_update",
            capabilityId: "payroll.payment-item.create",
            scope: companyA,
          }),
          call(2, {
            tool: "prego_read",
            capabilityId: "payroll.payment-item.list.read",
            scope: companyA,
          }),
        ]),
      ),
    );
    chmodSync(summaryPath, 0o600);
    const result = spawnSync(process.execPath, [
      fileURLToPath(
        new URL("./evaluate-prego-conversation.mjs", import.meta.url),
      ),
      "--scenario-id",
      scenario.id,
      "--summary",
      summaryPath,
      "--output",
      outputPath,
      "--manifest",
      manifestPath,
    ]);
    assert.equal(result.status, 0, result.stderr.toString());
    const report = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.match(report.provenance.summarySha256, /^[a-f0-9]{64}$/);
    assert.match(report.provenance.scenarioSha256, /^[a-f0-9]{64}$/);
    assert.equal(report.businessVerdict, "COVERAGE_GAP");
    assert.equal(statSync(outputPath).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("readback follows every required update, not an earlier unrelated write", () => {
  const write = (n, capabilityId) =>
    call(n, { tool: "prego_update", capabilityId, scope: companyA });
  const read = (n) =>
    call(n, {
      tool: "prego_read",
      capabilityId: "payroll.payment-item.list.read",
      scope: companyA,
    });
  const required = "payroll.payment-item.create";
  for (const first of ["payroll.payment-item.update", required]) {
    const calls = [write(1, first), read(2), write(3, required)];
    assert.equal(
      evaluateConversation({ scenario, summary: summary(calls) })
        .mechanicalVerdict,
      "FAIL",
    );
    assert.equal(
      evaluateConversation({ scenario, summary: summary([...calls, read(4)]) })
        .mechanicalVerdict,
      "PASS",
    );
  }
});
