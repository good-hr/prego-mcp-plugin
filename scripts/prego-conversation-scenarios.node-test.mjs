import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertConversationScenarios } from "./check-prego-contract.mjs";

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manifest = readJson("../contracts/conversation-scenarios.json");
const contract = readJson("../contracts/pilot-tools.json");
const source = manifest.scenarios
  .flatMap((scenario) => scenario.sourceScenarioIds)
  .map((id) => `\`${id}\``)
  .join("\n");

test("packaged scenarios cover every workflow and use existing capability contracts", () => {
  assert.equal(assertConversationScenarios(manifest, contract, source), 13);
});

test("required capabilities reject an unrelated workflow", () => {
  const changed = structuredClone(manifest);
  changed.scenarios.find(({ id }) => id === "policy-impact-review").skillIds = [
    "company-briefing",
  ];
  assert.throws(
    () => assertConversationScenarios(changed, contract, source),
    /payroll\.settings\.policy\.read is not declared by selected workflow/,
  );
});

test("required capabilities may use the union of selected workflows", () => {
  const changed = structuredClone(manifest);
  changed.scenarios.find(({ id }) => id === "policy-impact-review").skillIds = [
    "company-briefing",
    "payroll-policy-builder",
  ];
  assert.equal(assertConversationScenarios(changed, contract, source), 13);
});

test("removed capability or workflow cannot leave a silently stale evaluation", () => {
  const changed = structuredClone(contract);
  changed.capabilities = changed.capabilities.filter(
    ({ id }) => id !== "payroll.payment-item.update",
  );
  assert.throws(
    () => assertConversationScenarios(manifest, changed, source),
    /unknown capability/,
  );
  changed.skills = changed.skills.filter(({ id }) => id !== "company-briefing");
  assert.throws(
    () => assertConversationScenarios(manifest, changed, source),
    /unknown workflow/,
  );
});

test("canonical scenario removal and contradictory update expectations fail validation", () => {
  assert.throws(
    () => assertConversationScenarios(manifest, contract, ""),
    /missing canonical scenario/,
  );
  const changed = structuredClone(manifest);
  const save = changed.scenarios.find(({ id }) => id === "policy-save");
  save.expect.updates = "none";
  assert.throws(() => assertConversationScenarios(changed, contract, source));
  const readOnlyRequired = structuredClone(manifest);
  readOnlyRequired.scenarios.find(({ id }) => id === "policy-save").expect = {
    requiredCapabilities: ["payroll.settings.policy.read"],
    forbiddenCapabilities: [],
    updates: "required",
    readAfterUpdate: [],
  };
  assert.throws(
    () => assertConversationScenarios(readOnlyRequired, contract, source),
    /needs an update capability/,
  );
});
