#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = join(PLUGIN_ROOT, "contracts/pilot-tools.json");

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

function recordsByTool(records) {
  const result = new Map();
  for (const record of records) {
    if (result.has(record.tool))
      throw new Error(`tool ${record.tool}이 중복됩니다`);
    result.set(record.tool, record);
  }
  return result;
}

function comparable(record) {
  return {
    capabilityId: record.capabilityId,
    appCode: record.appCode,
    operationId: record.operationId,
    handoffPath: record.handoffPath,
  };
}

function assertSameRecords(label, expected, actual) {
  assert.deepEqual(
    [...recordsByTool(actual).keys()].sort(),
    [...recordsByTool(expected).keys()].sort(),
    `${label}: tool 목록이 pilot contract와 다릅니다`,
  );
  const actualByTool = recordsByTool(actual);
  for (const expectedRecord of expected) {
    assert.deepEqual(
      comparable(actualByTool.get(expectedRecord.tool)),
      comparable(expectedRecord),
      `${label}: ${expectedRecord.tool}의 capability/App/operation/handoff가 다릅니다`,
    );
  }
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

function frontendRecords(registry) {
  return registry.apps.flatMap((app) =>
    app.capabilities.map((capability) => ({
      tool: capability.tool,
      capabilityId: capability.id,
      appCode: app.appCode,
      operationId: capability.read.operationId,
      handoffPath: capability.handoff.path,
    })),
  );
}

function backendEnumRecords(backendRoot) {
  const source = readFileSync(
    join(
      backendRoot,
      "application/src/main/kotlin/good/hr/api/mcp/PregoMcpTool.kt",
    ),
    "utf8",
  );
  return [
    ...source.matchAll(
      /\n\s{4}([A-Z_]+)\(\n\s+toolName = "([^"]+)",\n\s+capabilityId = "([^"]+)",\n\s+appCode = "([^"]+)",\n\s+operationId = "([^"]+)",\n\s+handoffPath = "([^"]+)",/g,
    ),
  ].map((match) => ({
    enum: match[1],
    tool: match[2],
    capabilityId: match[3],
    appCode: match[4],
    operationId: match[5],
    handoffPath: match[6],
  }));
}

function backendAdapterEnums(backendRoot) {
  const directory = join(
    backendRoot,
    "application/src/main/kotlin/good/hr/api/mcp",
  );
  return readdirSync(directory)
    .filter(
      (file) =>
        file.endsWith("McpReadAdapter.kt") && file !== "PregoMcpReadAdapter.kt",
    )
    .map((file) => {
      const source = readFileSync(join(directory, file), "utf8");
      const match = source.match(
        /override val tool: PregoMcpTool = PregoMcpTool\.([A-Z_]+)/,
      );
      if (!match)
        throw new Error(`BE adapter ${file}에 PregoMcpTool 연결이 없습니다`);
      return match[1];
    })
    .sort();
}

function assertBackendRegistryAndHandlerDispatch(backendRoot) {
  const mcpDirectory = join(
    backendRoot,
    "application/src/main/kotlin/good/hr/api/mcp",
  );
  const registrySource = readFileSync(
    join(mcpDirectory, "PregoMcpToolRegistry.kt"),
    "utf8",
  );
  const handlerSource = readFileSync(
    join(mcpDirectory, "PregoMcpStatelessServer.kt"),
    "utf8",
  );

  assert.match(
    registrySource,
    /override fun listAvailableTools\(\): List<PregoMcpToolDescriptor> = PregoMcpTool\.entries/,
    "BE registry가 PregoMcpTool enum으로 tools/list를 만들지 않습니다",
  );
  assert.match(
    registrySource,
    /\.filter \{ appAccessQueryService\.canViewApp\(it\.appCode\) \}/,
    "BE registry가 앱 조회 권한으로 tools/list를 필터링하지 않습니다",
  );
  assert.match(
    handlerSource,
    /class PregoMcpStatelessServerHandler[\s\S]*: McpStatelessServerHandler/,
    "BE MCP handler가 stateless SDK handler가 아닙니다",
  );
  assert.match(
    handlerSource,
    /"tools\/list" -> success\(request, McpSchema\.ListToolsResult\(availableTools\(\), null\)\)/,
    "BE MCP handler가 tools/list를 registry dispatch하지 않습니다",
  );
  assert.match(
    handlerSource,
    /return toolRegistry\.listAvailableTools\(\)\.map \{ descriptor ->/,
    "BE MCP handler가 request별 registry tool 목록을 사용하지 않습니다",
  );
  assert.match(
    handlerSource,
    /val principal = currentCompanyScopedUser\(\)[\s\S]*val execution = try \{\s*toolRegistry\.call\(principal, toolName, arguments\)/,
    "BE MCP handler가 tools/call을 registry로 위임하지 않습니다",
  );
  assert.match(
    registrySource,
    /requestLimiter\.check\(userIdentity as CompanyScopedUserIdentity, toolName\)[\s\S]*dataPolicy\.apply\(adapter\.read\(userIdentity, arguments\)\)/,
    "BE MCP registry가 호출 제한과 응답 데이터 정책을 적용하지 않습니다",
  );
  assert.ok(
    !existsSync(join(mcpDirectory, "PregoMcpTools.kt")),
    "정적 @McpTool entrypoint는 제거되어야 합니다",
  );
}

function skillTools(skillPath) {
  return [...readFileSync(skillPath, "utf8").matchAll(/`(prego_[a-z0-9_]+)`/g)]
    .map((match) => match[1])
    .sort();
}

function pluginSkillIds() {
  return readdirSync(join(PLUGIN_ROOT, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function checkProvenance(registry, requireOpenApiDigest) {
  const source = registry.openapi?.source;
  const sha256 = registry.openapi?.sha256;
  if (source === "generated-api-fallback") {
    assert.equal(
      sha256,
      null,
      "generated API fallback에는 OpenAPI digest가 있으면 안 됩니다",
    );
    if (requireOpenApiDigest) {
      throw new Error(
        "real OpenAPI digest가 필요합니다: --openapi <JSON 또는 URL>을 제공하세요",
      );
    }
    return "COVERAGE_GAP: registry는 generated-api-fallback이며 real OpenAPI digest가 없습니다";
  }
  assert.match(
    sha256 ?? "",
    /^[a-f0-9]{64}$/,
    "real OpenAPI provenance에는 SHA-256이 필요합니다",
  );
  return null;
}

export function checkPregoContract({
  frontendRoot = resolve(PLUGIN_ROOT, "..", "good-hr-frontend"),
  backendRoot = resolve(PLUGIN_ROOT, "..", "good-hr-backend"),
  openApi = null,
  requireOpenApiDigest = false,
} = {}) {
  for (const [label, path] of [
    ["frontend", frontendRoot],
    ["backend", backendRoot],
  ]) {
    if (!existsSync(path)) throw new Error(`${label} root가 없습니다: ${path}`);
  }
  const contract = readJson(CONTRACT_PATH);
  assert.equal(
    contract.version,
    1,
    "지원하지 않는 pilot contract version입니다",
  );
  const registry = frontendRegistry(frontendRoot, openApi);
  assertSameRecords("FE registry", contract.tools, frontendRecords(registry));
  assertSameRecords(
    "BE PregoMcpTool enum",
    contract.tools,
    backendEnumRecords(backendRoot),
  );
  assert.deepEqual(
    backendAdapterEnums(backendRoot),
    contract.tools.map((tool) => tool.enum).sort(),
    "BE adapter가 pilot enum과 일대일이 아닙니다",
  );
  assertBackendRegistryAndHandlerDispatch(backendRoot);
  const approvedTools = new Set(contract.tools.map((tool) => tool.tool));
  assert.deepEqual(
    pluginSkillIds(),
    contract.skills.map((skill) => skill.id).sort(),
    "plugin skill 목록이 pilot contract와 다릅니다",
  );
  const referencedTools = new Set();
  for (const skill of contract.skills) {
    const actualTools = skillTools(
      join(PLUGIN_ROOT, "skills", skill.id, "SKILL.md"),
    );
    assert.deepEqual(
      actualTools,
      [...skill.tools].sort(),
      `${skill.id}: 허용 tool이 contract와 다릅니다`,
    );
    assert.ok(
      actualTools.every((tool) => approvedTools.has(tool)),
      `${skill.id}: 승인되지 않은 tool을 참조합니다`,
    );
    actualTools.forEach((tool) => referencedTools.add(tool));
  }
  assert.deepEqual(
    [...referencedTools].sort(),
    [...approvedTools].sort(),
    "pilot tool이 plugin skill에서 모두 참조되지 않습니다",
  );
  return {
    toolCount: contract.tools.length,
    coverageGap: checkProvenance(registry, requireOpenApiDigest),
  };
}

function main() {
  const result = checkPregoContract(parseArguments(process.argv.slice(2)));
  process.stdout.write(`Prego pilot contract OK: ${result.toolCount} tools\n`);
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
