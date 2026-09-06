#!/usr/bin/env node

import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = resolve(
  SCRIPT_ROOT,
  "..",
  "contracts",
  "conversation-scenarios.json",
);
const CHECK_STATUSES = new Set(["PASS", "FAIL", "COVERAGE_GAP"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function check(id, status, detail) {
  if (!CHECK_STATUSES.has(status))
    throw new Error(`unsupported check status: ${status}`);
  return { id, status, detail };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireStringArray(name, value) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || !entry)
  ) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  return value;
}

export function validateScenario(scenario) {
  if (!isObject(scenario)) throw new Error("scenario must be an object");
  if (typeof scenario.id !== "string" || !scenario.id)
    throw new Error("scenario.id is required");
  requireStringArray("scenario.sourceScenarioIds", scenario.sourceScenarioIds);
  requireStringArray("scenario.skillIds", scenario.skillIds);
  if (typeof scenario.question !== "string" || !scenario.question.trim()) {
    throw new Error("scenario.question is required");
  }
  if (!isObject(scenario.expect))
    throw new Error("scenario.expect is required");
  requireStringArray(
    "scenario.expect.requiredCapabilities",
    scenario.expect.requiredCapabilities,
  );
  requireStringArray(
    "scenario.expect.forbiddenCapabilities",
    scenario.expect.forbiddenCapabilities,
  );
  if (!new Set(["none", "required"]).has(scenario.expect.updates)) {
    throw new Error("scenario.expect.updates must be none or required");
  }
  requireStringArray(
    "scenario.expect.readAfterUpdate",
    scenario.expect.readAfterUpdate,
  );
  requireStringArray("scenario.review", scenario.review);
  return scenario;
}

function normalizedScope(scope) {
  if (!isObject(scope) || typeof scope.mode !== "string") return null;
  if (scope.mode !== "selected") return null;
  const companyIds = Array.isArray(scope.companyIds)
    ? scope.companyIds
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .sort()
    : [];
  return companyIds.length === 1 ? { mode: "selected", companyIds } : null;
}

function sameExplicitScope(left, right) {
  const first = normalizedScope(left);
  const second = normalizedScope(right);
  return (
    first !== null &&
    second !== null &&
    JSON.stringify(first) === JSON.stringify(second)
  );
}

function isCompletedNonError(call) {
  return (
    call?.transportStatus === "completed" && call.businessStatus !== "error"
  );
}

function isCompletedError(call) {
  return (
    call?.transportStatus === "completed" && call.businessStatus === "error"
  );
}

function isPregoBusinessCall(call) {
  return (
    call?.server === "prego_fixture" &&
    ["prego_read", "prego_update"].includes(call?.tool)
  );
}

function eventPosition(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function transcriptState(summary) {
  const transcript = summary?.transcript;
  if (!isObject(transcript))
    return { usable: false, reason: "summary.transcript is missing" };
  if (
    transcript.available !== true ||
    !Number.isInteger(transcript.eventCount) ||
    transcript.eventCount < 1
  ) {
    return { usable: false, reason: "trace has no parsed events" };
  }
  if (
    !Array.isArray(transcript.toolCalls) ||
    transcript.toolCalls.length === 0
  ) {
    return { usable: false, reason: "trace has no completed tool calls" };
  }
  if (
    !Number.isInteger(transcript.malformedLineCount) ||
    transcript.malformedLineCount > 0
  ) {
    return { usable: false, reason: "trace contains malformed events" };
  }
  const inflight = transcript.toolCalls.some((call) =>
    ["in_progress", "unknown"].includes(call?.transportStatus),
  );
  if (inflight)
    return { usable: false, reason: "trace contains incomplete tool calls" };
  return { usable: true, reason: null };
}

function processCheck(summary) {
  const status = summary?.process?.status;
  if (status === "COMPLETED")
    return check("infrastructure.process", "PASS", "runner process completed");
  return check(
    "infrastructure.process",
    "COVERAGE_GAP",
    `runner process status is ${typeof status === "string" ? status : "unknown"}`,
  );
}

function capabilityChecks(scenario, calls, usable) {
  return scenario.expect.requiredCapabilities.map((capabilityId) => {
    const matching = calls.filter(
      (call) => isPregoBusinessCall(call) && call.capabilityId === capabilityId,
    );
    if (matching.some(isCompletedNonError)) {
      return check(
        `required-capability:${capabilityId}`,
        "PASS",
        "completed without a business error",
      );
    }
    if (!usable) {
      return check(
        `required-capability:${capabilityId}`,
        "COVERAGE_GAP",
        "trace is incomplete or malformed",
      );
    }
    if (matching.some(isCompletedError)) {
      return check(
        `required-capability:${capabilityId}`,
        "FAIL",
        "completed with a business error",
      );
    }
    return check(
      `required-capability:${capabilityId}`,
      "FAIL",
      "not observed as a completed non-error call",
    );
  });
}

function forbiddenCapabilityChecks(scenario, calls, usable) {
  return scenario.expect.forbiddenCapabilities.map((capabilityId) => {
    const matching = calls.filter(
      (call) => isPregoBusinessCall(call) && call.capabilityId === capabilityId,
    );
    if (matching.length > 0)
      return check(
        `forbidden-capability:${capabilityId}`,
        "FAIL",
        "attempted through a Prego business façade",
      );
    return check(
      `forbidden-capability:${capabilityId}`,
      usable ? "PASS" : "COVERAGE_GAP",
      usable
        ? "not observed through a Prego business façade"
        : "trace is incomplete or malformed",
    );
  });
}

function updateCheck(scenario, calls, usable) {
  const updates = calls.filter(
    (call) => isPregoBusinessCall(call) && call.tool === "prego_update",
  );
  const successful = updates.filter(isCompletedNonError);
  const failed = updates.filter(isCompletedError);
  const incomplete = updates.filter(
    (call) => !isCompletedNonError(call) && !isCompletedError(call),
  );
  const id = "updates";
  if (scenario.expect.updates === "none") {
    if (updates.length > 0)
      return check(id, "FAIL", "prego_update was attempted");
    if (!usable || incomplete.length > 0) {
      return check(
        id,
        "COVERAGE_GAP",
        "no-write cannot pass with an incomplete or malformed trace",
      );
    }
    return check(id, "PASS", "no update call was observed");
  }
  if (failed.length > 0)
    return check(
      id,
      "FAIL",
      "an observed update completed with a business error",
    );
  if (successful.length > 0)
    return check(id, "PASS", "completed non-error update observed");
  if (!usable || incomplete.length > 0) {
    return check(id, "COVERAGE_GAP", "update trace is incomplete or malformed");
  }
  return check(id, "FAIL", "required update was not observed");
}

function readAfterUpdateChecks(scenario, calls, usable) {
  const successfulUpdates = calls.filter(
    (call) =>
      isPregoBusinessCall(call) &&
      call.tool === "prego_update" &&
      isCompletedNonError(call),
  );
  return scenario.expect.readAfterUpdate.map((capabilityId) => {
    const id = `read-after-update:${capabilityId}`;
    if (successfulUpdates.length === 0) {
      return check(
        id,
        usable ? "FAIL" : "COVERAGE_GAP",
        "no completed non-error update precedes the required readback",
      );
    }
    const reads = calls.filter(
      (call) =>
        isPregoBusinessCall(call) &&
        call.tool === "prego_read" &&
        call.capabilityId === capabilityId,
    );
    const timedUpdates = successfulUpdates.filter(
      (update) => eventPosition(update.completedEvent) !== null,
    );
    const timedReads = reads.filter(
      (read) => eventPosition(read.startedEvent) !== null,
    );
    if (
      timedReads.some(
        (read) =>
          isCompletedNonError(read) &&
          timedUpdates.some(
            (update) =>
              read.startedEvent > update.completedEvent &&
              sameExplicitScope(update.scope, read.scope),
          ),
      )
    ) {
      return check(
        id,
        "PASS",
        "completed readback followed the update with the same explicit scope",
      );
    }
    if (
      !usable ||
      timedUpdates.length !== successfulUpdates.length ||
      timedReads.length !== reads.length
    ) {
      return check(
        id,
        "COVERAGE_GAP",
        "readback trace is incomplete, malformed, or lacks start/complete event timing",
      );
    }
    const hasUnresolvedScope =
      successfulUpdates.some(
        (update) => normalizedScope(update.scope) === null,
      ) || reads.some((read) => normalizedScope(read.scope) === null);
    if (hasUnresolvedScope)
      return check(
        id,
        "COVERAGE_GAP",
        "default or missing company scope cannot prove same-scope readback",
      );
    if (reads.some((read) => isCompletedError(read))) {
      return check(
        id,
        "FAIL",
        "the named post-update readback completed with a business error",
      );
    }
    if (
      timedReads.some((read) =>
        timedUpdates.some(
          (update) => read.startedEvent <= update.completedEvent,
        ),
      )
    ) {
      return check(
        id,
        "FAIL",
        "the named read started before the update completed",
      );
    }
    return check(
      id,
      "FAIL",
      "no same-scope successful readback followed the update",
    );
  });
}

/**
 * Evaluates only independently observable transcript predicates. A mechanical
 * PASS never claims that a Prego business action, answer, or UI handoff passed.
 */
export function evaluateConversation({ scenario, summary } = {}) {
  validateScenario(scenario);
  if (!isObject(summary)) throw new Error("summary must be an object");
  validateSummaryBinding(scenario, summary);
  const trace = transcriptState(summary);
  const calls = Array.isArray(summary.transcript?.toolCalls)
    ? summary.transcript.toolCalls
    : [];
  const checks = [
    processCheck(summary),
    check(
      "trace",
      trace.usable ? "PASS" : "COVERAGE_GAP",
      trace.usable ? "completed trace available" : trace.reason,
    ),
    ...capabilityChecks(scenario, calls, trace.usable),
    ...forbiddenCapabilityChecks(scenario, calls, trace.usable),
    updateCheck(scenario, calls, trace.usable),
    ...readAfterUpdateChecks(scenario, calls, trace.usable),
  ];
  const exitCode = checks.some((entry) => entry.status === "FAIL")
    ? 1
    : checks.some((entry) => entry.status === "COVERAGE_GAP")
      ? 2
      : 0;
  return {
    scenarioId: scenario.id,
    executionProvenance: {
      mode: summary.mode ?? null,
      model: summary.model ?? null,
      reasoningEffort: summary.reasoningEffort ?? null,
      skillIds: summary.skillIds ?? null,
      skillSha256: summary.skillSha256 ?? null,
    },
    checks,
    mechanicalVerdict:
      exitCode === 0 ? "PASS" : exitCode === 1 ? "FAIL" : "COVERAGE_GAP",
    businessVerdict: "COVERAGE_GAP",
    infrastructureVerdict:
      summary.process?.status === "COMPLETED" ? null : "INFRA_ERROR",
    remainingReview: [
      ...scenario.review,
      "Review the final answer against the returned evidence and stated uncertainty.",
      ...(scenario.expect.updates === "none"
        ? []
        : ["Verify independent current state after the conversation."]),
    ],
    exitCode,
  };
}

export function loadScenario(manifestPath, scenarioId) {
  const text = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(text);
  const scenarios = manifest.scenarios;
  if (!Array.isArray(scenarios))
    throw new Error("conversation scenario manifest must contain scenarios");
  const scenario = scenarios.find((entry) => entry?.id === scenarioId);
  if (!scenario) throw new Error(`scenario not found: ${scenarioId}`);
  validateScenario(scenario);
  return { scenario, sha256: sha256(JSON.stringify(scenario)) };
}

function validateSummaryBinding(scenario, summary) {
  if (summary.scenarioId !== undefined && summary.scenarioId !== null) {
    if (summary.scenarioId !== scenario.id)
      throw new Error(
        "summary scenarioId does not match the selected scenario",
      );
    if (summary.caseId !== undefined && summary.caseId !== scenario.id) {
      throw new Error("summary caseId does not match the selected scenario");
    }
  }
  if (summary.scenarioSha256 !== undefined && summary.scenarioSha256 !== null) {
    const expected = sha256(JSON.stringify(scenario));
    if (summary.scenarioSha256 !== expected) {
      throw new Error(
        "summary scenarioSha256 does not match the selected scenario",
      );
    }
  }
}

function parseArgs(args) {
  const result = { manifest: DEFAULT_MANIFEST };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") return { help: true };
    const key = {
      "--scenario-id": "scenarioId",
      "--summary": "summary",
      "--output": "output",
      "--manifest": "manifest",
    }[option];
    if (!key || args[index + 1] === undefined)
      throw new Error(`unknown or incomplete option: ${option}`);
    result[key] = args[index + 1];
    index += 1;
  }
  for (const key of ["scenarioId", "summary", "output"]) {
    if (typeof result[key] !== "string" || !result[key])
      throw new Error(`${key} is required`);
  }
  return result;
}

function usage() {
  return "Usage: node scripts/evaluate-prego-conversation.mjs --scenario-id <id> --summary <summary.json> --output <report.json> [--manifest <scenarios.json>]";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const manifestPath = resolve(args.manifest);
  const summaryPath = resolve(args.summary);
  const outputPath = resolve(args.output);
  const { scenario, sha256: scenarioSha256 } = loadScenario(
    manifestPath,
    args.scenarioId,
  );
  const summaryText = readFileSync(summaryPath, "utf8");
  const summary = JSON.parse(summaryText);
  const report = {
    ...evaluateConversation({ scenario, summary }),
    provenance: {
      summaryPath,
      summarySha256: sha256(summaryText),
      scenarioSha256,
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);
  process.stdout.write(
    `${JSON.stringify({ scenarioId: report.scenarioId, mechanicalVerdict: report.mechanicalVerdict, businessVerdict: report.businessVerdict })}\n`,
  );
  process.exitCode = report.exitCode;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
