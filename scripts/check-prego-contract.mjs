#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = join(PLUGIN_ROOT, "contracts/pilot-tools.json");
const FACADE_TOOLS = ["prego_capabilities", "prego_read", "prego_update"];
const LEGACY_TOOL_PATTERN = /prego_(company_context|hr_operations_summary|attendance_operations_summary|person_lifecycle_readiness|person_list|onboarding_import_catalog|onboarding_import_preflight|workforce_snapshot|payroll_prepare_readiness|payroll_ledger|payroll_downstream_status|payroll_variance_review|payroll_policy_preview|workforce_cost_bridge)/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseArguments(args) {
  const result = {
    frontendRoot: resolve(PLUGIN_ROOT, "..", "good-hr-frontend"),
    backendRoot: resolve(PLUGIN_ROOT, "..", "good-hr-backend"),
    openApi: null,
    requireOpenApiDigest: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--require-openapi-digest") {
      result.requireOpenApiDigest = true;
      continue;
    }
    const key = {
      "--frontend-root": "frontendRoot",
      "--backend-root": "backendRoot",
      "--openapi": "openApi",
    }[option];
    if (!key || !args[index + 1]) throw new Error(`알 수 없는 옵션: ${option}`);
    const value = args[index + 1];
    result[key] =
      key === "openApi" && /^https?:\/\//.test(value) ? value : resolve(value);
    index += 1;
  }
  return result;
}

function assertPluginManifest() {
  const manifest = readJson(join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"));
  assert.match(
    manifest.version ?? "",
    /^\d+\.\d+\.\d+\+codex\.\d{14}$/,
    "plugin version은 release마다 식별 가능한 semver+codex timestamp여야 합니다",
  );
  assert.ok(
    (manifest.interface?.defaultPrompt?.length ?? 0) <= 3,
    "plugin defaultPrompt는 Codex가 지원하는 최대 3개를 넘을 수 없습니다",
  );
}

function assertContract(contract) {
  assert.equal(contract.version, 2, "지원하지 않는 Prego facade contract version입니다");
  assert.deepEqual(
    contract.mcpTools?.map((tool) => tool.tool),
    FACADE_TOOLS,
    "공개 MCP tool은 capability discovery, read, destructive update 세 개여야 합니다",
  );
  assert.deepEqual(
    contract.mcpTools.map(({ tool, effect, destructive }) => ({ tool, effect, destructive })),
    [
      { tool: "prego_capabilities", effect: "discovery", destructive: false },
      { tool: "prego_read", effect: "read", destructive: false },
      { tool: "prego_update", effect: "update", destructive: true },
    ],
    "facade tool effect 또는 destructive contract가 다릅니다",
  );
  const ids = contract.capabilities.map((capability) => capability.id);
  assert.equal(new Set(ids).size, ids.length, "capability ID가 중복됩니다");
  assert.ok(
    contract.capabilities.every((capability) =>
      ["read", "update"].includes(capability.effect),
    ),
    "현재 facade contract에는 read 또는 update capability만 허용됩니다",
  );
  assert.deepEqual(
    contract.capabilities.filter((capability) => capability.foundation),
    [{ id: "company.context.read", effect: "read", foundation: true }],
    "company context는 discovery 결과에만 포함되는 foundation capability여야 합니다",
  );
  assert.ok(
    !contract.mcpTools.some((tool) => tool.tool === "prego_operate"),
    "operate capability가 생기기 전에는 prego_operate를 노출하지 않습니다",
  );
}

function pluginSkillIds() {
  return readdirSync(join(PLUGIN_ROOT, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function skillToolReferences(skillPath) {
  return [
    ...new Set(
      [...readFileSync(skillPath, "utf8").matchAll(/`(prego_[a-z0-9_]+)`/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
}

function assertSkills(contract) {
  assert.deepEqual(
    pluginSkillIds(),
    contract.skills.map((skill) => skill.id).sort(),
    "plugin skill 목록이 facade contract와 다릅니다",
  );
  const allowedCapabilityIds = new Set(
    contract.capabilities.map((capability) => capability.id),
  );
  for (const skill of contract.skills) {
    const source = readFileSync(join(PLUGIN_ROOT, "skills", skill.id, "SKILL.md"), "utf8");
    const actualTools = skillToolReferences(
      join(PLUGIN_ROOT, "skills", skill.id, "SKILL.md"),
    );
    assert.ok(
      actualTools.includes("prego_capabilities") && actualTools.includes("prego_read"),
      `${skill.id}: capability discovery와 generic read를 모두 안내해야 합니다`,
    );
    assert.ok(
      actualTools.every((tool) => FACADE_TOOLS.includes(tool)),
      `${skill.id}: facade 밖의 MCP tool을 참조합니다`,
    );
    assert.ok(
      skill.capabilities.every((id) => allowedCapabilityIds.has(id)),
      `${skill.id}: 등록되지 않은 capability를 참조합니다`,
    );
    assert.ok(
      skill.capabilities.every((id) => source.includes(`\`${id}\``)),
      `${skill.id}: 사용 capability ID를 skill에 명시해야 합니다`,
    );
  }
  const policy = readFileSync(
    join(PLUGIN_ROOT, "skills", "payroll-policy-builder", "SKILL.md"),
    "utf8",
  );
  assert.match(policy, /client's destructive-tool approval is\s+the confirmation/);
  assert.match(policy, /do not ask a\s+second conversational confirmation/);
}

function frontendRegistry(frontendRoot, openApi) {
  const args = ["scripts/prego-ai-capabilities.mjs", "registry"];
  if (openApi) args.push("--openapi", openApi);
  return JSON.parse(
    execFileSync(process.execPath, args, {
      cwd: frontendRoot,
      encoding: "utf8",
    }),
  );
}

function checkProvenance(registry, requireOpenApiDigest) {
  const source = registry.openapi?.source;
  const sha256 = registry.openapi?.sha256;
  if (source === "generated-api-fallback") {
    assert.equal(sha256, null, "generated API fallback에는 OpenAPI digest가 있으면 안 됩니다");
    if (requireOpenApiDigest) {
      throw new Error("real OpenAPI digest가 필요합니다: --openapi <JSON 또는 URL>을 제공하세요");
    }
    return "COVERAGE_GAP: registry는 generated-api-fallback이며 real OpenAPI digest가 없습니다";
  }
  assert.match(sha256 ?? "", /^[a-f0-9]{64}$/, "real OpenAPI provenance에는 SHA-256이 필요합니다");
  return null;
}

/** The pilot document is useful for a FE-only check, never release provenance. */
export function assertFullOpenApiArtifact(path) {
  const document = readJson(path);
  const operationCount = Object.values(document.paths ?? {}).flatMap((pathItem) =>
    Object.values(pathItem ?? {}).filter((operation) => operation?.operationId),
  ).length;
  assert.notEqual(document.info?.title, "Prego MCP pilot OpenAPI contract", "pilot-openapi.json은 full OpenAPI provenance로 사용할 수 없습니다");
  assert.ok(operationCount > 1, "full OpenAPI에는 둘 이상의 operation이 필요합니다");
  assert.ok(Object.keys(document.components?.schemas ?? {}).length > 0, "full OpenAPI에는 components.schemas가 필요합니다");
  return document;
}

export function assertExactCapabilityPairs(label, expected, actual) {
  const normalize = (pairs) => {
    const normalized = pairs
      .map(({ id, effect }) => ({ id, effect }))
      .sort((left, right) =>
        `${left.id}:${left.effect}`.localeCompare(`${right.id}:${right.effect}`),
      );
    assert.equal(
      new Set(normalized.map(({ id }) => id)).size,
      normalized.length,
      `${label}: capability ID가 중복됩니다`,
    );
    return normalized;
  };
  assert.deepEqual(
    normalize(actual),
    normalize(expected),
    `${label}: foundation을 제외한 capabilityId/effect 집합이 plugin contract와 다릅니다`,
  );
}

function assertFrontendRegistry(contract, frontendRoot, openApi) {
  const registry = frontendRegistry(frontendRoot, openApi);
  assert.equal(registry.version, 2, "FE registry는 facade capability manifest v2여야 합니다");
  const records = registry.apps.flatMap((app) =>
    app.capabilities.map((capability) => ({ ...capability, appCode: app.appCode, foundation: app.foundation })),
  );
  const businessRecords = records.filter((record) => !record.foundation);
  assertExactCapabilityPairs(
    "FE registry",
    contract.capabilities.filter((capability) => !capability.foundation),
    businessRecords,
  );
  for (const record of businessRecords) {
    assert.ok(record.operation?.operationId, `FE registry의 ${record.id}에 operationId가 없습니다`);
    assert.ok(record.handoff?.resolver, `FE registry의 ${record.id}에 handoff resolver가 없습니다`);
  }
  const byId = new Map(records.map((record) => [record.id, record]));
  const foundation = byId.get("company.context.read");
  assert.ok(foundation?.foundation, "company context는 FE registry의 foundation capability여야 합니다");
  return registry;
}

function backendCatalog(backendRoot) {
  const source = readFileSync(
    join(backendRoot, "application/src/main/kotlin/good/hr/api/mcp/PregoMcpTool.kt"),
    "utf8",
  );
  return [...source.matchAll(/\n {4}[A-Z_]+\(([\s\S]*?)\n {4}\),/g)].map((match) => {
    const body = match[1];
    const capabilityId = body.match(/capabilityId = "([^"]+)"/)?.[1];
    if (!capabilityId) throw new Error("BE PregoMcpTool catalog에 capabilityId가 없습니다");
    return {
      id: capabilityId,
      effect: body.match(/effect = PregoMcpCapabilityEffect\.([A-Z_]+)/)?.[1].toLowerCase() ?? "read",
    };
  });
}

function assertBackendFacade(backendRoot, contract) {
  const source = execFileSync(
    "rg",
    ["-l", "prego_(capabilities|read|update)|company.context.read", "application/src/main/kotlin"],
    { cwd: backendRoot, encoding: "utf8" },
  );
  assert.ok(source.trim(), "BE에 Prego facade MCP 구현이 없습니다");
  const files = source.trim().split("\n").map((file) => join(backendRoot, file));
  const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
  for (const tool of FACADE_TOOLS) {
    assert.ok(combined.includes(`\"${tool}\"`), `BE에 ${tool} facade가 없습니다`);
  }
  assertExactCapabilityPairs(
    "BE PregoMcpTool catalog",
    contract.capabilities.filter((capability) => !capability.foundation),
    backendCatalog(backendRoot).filter(({ id }) => id !== "company.context.read"),
  );
  assert.doesNotMatch(
    combined,
    LEGACY_TOOL_PATTERN,
    "BE discovery 또는 설명에 façade 이전 MCP tool 이름이 남아 있습니다",
  );
}

export function checkPregoContract({
  frontendRoot = resolve(PLUGIN_ROOT, "..", "good-hr-frontend"),
  backendRoot = resolve(PLUGIN_ROOT, "..", "good-hr-backend"),
  openApi = null,
  requireOpenApiDigest = false,
} = {}) {
  assertPluginManifest();
  const contract = readJson(CONTRACT_PATH);
  assertContract(contract);
  assertSkills(contract);
  for (const [label, path] of [["frontend", frontendRoot], ["backend", backendRoot]]) {
    if (!existsSync(path)) throw new Error(`${label} root가 없습니다: ${path}`);
  }
  if (requireOpenApiDigest) {
    assert.ok(openApi && !/^https?:\/\//.test(openApi), "full OpenAPI provenance에는 로컬 artifact가 필요합니다");
    assertFullOpenApiArtifact(openApi);
  }
  const registry = assertFrontendRegistry(contract, frontendRoot, openApi);
  assertBackendFacade(backendRoot, contract);
  return {
    capabilityCount: contract.capabilities.length - 1,
    coverageGap: checkProvenance(registry, requireOpenApiDigest),
    openApiSha256: registry.openapi?.sha256 ?? null,
  };
}

function main() {
  const result = checkPregoContract(parseArguments(process.argv.slice(2)));
  process.stdout.write(`Prego facade contract OK: ${result.capabilityCount} capabilities\n`);
  if (result.coverageGap) process.stdout.write(`${result.coverageGap}\n`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
