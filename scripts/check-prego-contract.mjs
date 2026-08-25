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
  if (record.kind === "foundational") {
    return {
      kind: record.kind,
      capabilityId: record.capabilityId,
      operationId: record.operationId,
    };
  }
  return {
    kind: record.kind,
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
      kind: app.foundation ? "foundational" : "capability",
      tool: capability.tool,
      capabilityId: capability.id,
      appCode: app.appCode,
      operationId: capability.read.operationId,
      handoffPath: capability.handoff.path,
    })),
  );
}

function frontendFoundationRecord(frontendRoot, openApi) {
  const spec = readJson(
    openApi && !/^https?:\/\//.test(openApi)
      ? openApi
      : join(
          frontendRoot,
          "docs/features/core/prego-plugin/pilot-openapi.json",
        ),
  );
  return Object.entries(spec.paths ?? {}).flatMap(([path, methods]) =>
    Object.entries(methods).flatMap(([method, operation]) =>
      operation?.operationId
        ? [
            {
              operationId: operation.operationId,
              method: method.toUpperCase(),
              path,
            },
          ]
        : [],
    ),
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
  const requiredValue = (body, name) => {
    const match = body.match(new RegExp(`${name} = (null|"[^"]+")`));
    if (!match) throw new Error(`BE enum에 ${name} 값이 없습니다`);
    return match[1] === "null" ? null : match[1].slice(1, -1);
  };
  const optionalValue = (body, name) => {
    const match = body.match(new RegExp(`${name} = (null|"[^"]+")`));
    return !match || match[1] === "null" ? null : match[1].slice(1, -1);
  };
  return [...source.matchAll(/\n\s{4}([A-Z_]+)\(([\s\S]*?)\n\s{4}\),/g)].map(
    (match) => {
      const [, enumName, body] = match;
      const appCode = optionalValue(body, "appCode");
      const operationId = requiredValue(body, "operationId");
      const handoffPath = optionalValue(body, "handoffPath");
      return {
        kind:
          appCode === null && handoffPath === null
            ? "foundational"
            : "capability",
        enum: enumName,
        tool: requiredValue(body, "toolName"),
        capabilityId: requiredValue(body, "capabilityId"),
        ...(appCode === null ? {} : { appCode }),
        ...(operationId === null ? {} : { operationId }),
        ...(handoffPath === null ? {} : { handoffPath }),
      };
    },
  );
}

function backendAdapterEnums(backendRoot) {
  const directory = join(
    backendRoot,
    "application/src/main/kotlin/good/hr/api/mcp",
  );
  return readdirSync(directory)
    .filter(
      (file) =>
        file.includes("McpReadAdapter") && file !== "PregoMcpReadAdapter.kt",
    )
    .flatMap((file) => {
      const source = readFileSync(join(directory, file), "utf8");
      const matches = [
        ...source.matchAll(
          /TypedPregoMcpReadAdapter<[^>]+>\(\s*PregoMcpTool\.([A-Z_]+)/g,
        ),
      ];
      if (!matches.length)
        throw new Error(`BE adapter ${file}에 PregoMcpTool 연결이 없습니다`);
      return matches.map((match) => match[1]);
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
    /appCode == null \|\| appAccessQueryService\.canViewApp\(it\.appCode\)/,
    "BE registry가 foundational tool을 App gate 없이 노출하지 않습니다",
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
    /val principal = currentCustomerScopedUser\(\)[\s\S]*val execution = try \{\s*toolRegistry\.call\(principal, toolName, arguments\)/,
    "BE MCP handler가 tools/call을 registry로 위임하지 않습니다",
  );
  assert.match(
    registrySource,
    /requestLimiter\.check\(principal, toolName\)[\s\S]*dataPolicy\.apply/,
    "BE MCP registry가 호출 제한과 응답 데이터 정책을 적용하지 않습니다",
  );
  assert.match(
    registrySource,
    /inputSchema = checkNotNull\(adaptersByTool\[tool\]\)\.inputSchema/,
    "BE registry가 typed adapter schema를 tools/list에 사용하지 않습니다",
  );
  assert.ok(
    !existsSync(join(mcpDirectory, "PregoMcpTools.kt")),
    "정적 @McpTool entrypoint는 제거되어야 합니다",
  );
}

function skillTools(skillPath) {
  return [
    ...new Set(
      [
        ...readFileSync(skillPath, "utf8").matchAll(/`(prego_[a-z0-9_]+)`/g),
      ].map((match) => match[1]),
    ),
  ].sort();
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
  const foundationalTools = contract.tools.filter(
    (tool) => tool.kind === "foundational",
  );
  const capabilityTools = contract.tools.filter(
    (tool) => tool.kind === "capability",
  );
  assert.equal(
    foundationalTools.length,
    1,
    "foundational tool은 정확히 하나여야 합니다",
  );
  assert.ok(
    capabilityTools.length > 0,
    "business capability가 하나 이상 필요합니다",
  );
  assert.deepEqual(
    Object.keys(foundationalTools[0]).sort(),
    ["capabilityId", "enum", "kind", "operationId", "tool"],
    "company context에는 App gate나 handoff를 두면 안 됩니다",
  );
  assert.deepEqual(
    comparable(foundationalTools[0]),
    {
      kind: "foundational",
      capabilityId: "company.context.read",
      operationId: "getPregoMcpCompanyContext",
    },
    "company context는 App gate와 handoff가 없는 foundational tool이어야 합니다",
  );
  const registry = frontendRegistry(frontendRoot, openApi);
  const frontendCapabilityRecords = frontendRecords(registry).filter(
    (record) => record.kind === "capability",
  );
  const frontendFoundationalRecords = frontendRecords(registry).filter(
    (record) => record.kind === "foundational",
  );
  assertSameRecords("FE registry", capabilityTools, frontendCapabilityRecords);
  assertSameRecords(
    "FE foundational registry",
    foundationalTools,
    frontendFoundationalRecords,
  );
  assert.deepEqual(
    frontendFoundationRecord(frontendRoot, openApi).filter(
      (operation) => operation.operationId === foundationalTools[0].operationId,
    ),
    [
      {
        operationId: foundationalTools[0].operationId,
        method: "GET",
        path: "/api/v1/prego/mcp/company-context",
      },
    ],
    "FE pinned OpenAPI에 company context GET provenance가 없습니다",
  );
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
  for (const skill of contract.skills) {
    const actualTools = skillTools(
      join(PLUGIN_ROOT, "skills", skill.id, "SKILL.md"),
    );
    assert.deepEqual(
      actualTools,
      [...skill.tools].sort(),
      `${skill.id}: 허용 tool이 contract와 다릅니다`,
    );
    assert.equal(
      skill.tools[0],
      foundationalTools[0].tool,
      `${skill.id}: business read 전에 company context를 호출해야 합니다`,
    );
    assert.ok(
      actualTools.every((tool) => approvedTools.has(tool)),
      `${skill.id}: 승인되지 않은 tool을 참조합니다`,
    );
  }
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
