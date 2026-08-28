#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertFullOpenApiArtifact,
  checkPregoContract,
} from "./check-prego-contract.mjs";

const PLUGIN_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseArguments(args) {
  const result = {
    frontendRoot: resolve(PLUGIN_ROOT, "..", "good-hr-frontend"),
    backendRoot: resolve(PLUGIN_ROOT, "..", "good-hr-backend"),
    openApiUrl: "http://127.0.0.1:8080/v3/api-docs",
  };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const key = {
      "--frontend-root": "frontendRoot",
      "--backend-root": "backendRoot",
      "--openapi-url": "openApiUrl",
    }[option];
    if (!key || !args[index + 1]) throw new Error(`알 수 없는 옵션: ${option}`);
    result[key] =
      key === "openApiUrl" ? args[index + 1] : resolve(args[index + 1]);
    index += 1;
  }
  return result;
}

export function requireLoopback(urlText) {
  const url = new URL(urlText);
  const allowedHosts = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(
      "OpenAPI는 공개 endpoint가 아닌 loopback 테스트 런타임에서만 가져올 수 있습니다",
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("OpenAPI runtime URL은 HTTP(S)여야 합니다");
  }
  return url;
}

export function canonicalizeOpenApi(value) {
  if (Array.isArray(value)) return value.map(canonicalizeOpenApi);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeOpenApi(value[key])]),
    );
  }
  return value;
}

export async function checkPregoContractFromRuntime({
  frontendRoot,
  backendRoot,
  openApiUrl,
}) {
  const url = requireLoopback(openApiUrl);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("OpenAPI test runtime redirect는 허용하지 않습니다");
  }
  if (!response.ok) {
    throw new Error(`OpenAPI test runtime 요청 실패: HTTP ${response.status}`);
  }
  const document = await response.json();
  const canonicalDocument = `${JSON.stringify(canonicalizeOpenApi(document))}\n`;
  const directory = mkdtempSync(join(tmpdir(), "prego-full-openapi-"));
  const artifact = join(directory, "openapi.json");
  try {
    writeFileSync(artifact, canonicalDocument, {
      encoding: "utf8",
      mode: 0o600,
    });
    assertFullOpenApiArtifact(artifact);
    const expectedSha256 = createHash("sha256")
      .update(canonicalDocument)
      .digest("hex");
    const result = checkPregoContract({
      frontendRoot,
      backendRoot,
      openApi: artifact,
      requireOpenApiDigest: true,
    });
    if (result.openApiSha256 !== expectedSha256) {
      throw new Error("FE registry OpenAPI digest가 runtime artifact와 다릅니다");
    }
    process.stdout.write(`Prego pilot contract OK: ${result.toolCount} tools\n`);
    return {
      sha256: expectedSha256,
      pathCount: Object.keys(document.paths ?? {}).length,
      schemaCount: Object.keys(document.components?.schemas ?? {}).length,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function main() {
  const evidence = await checkPregoContractFromRuntime(
    parseArguments(process.argv.slice(2)),
  );
  process.stdout.write(
    `Full OpenAPI provenance OK: sha256=${evidence.sha256}, paths=${evidence.pathCount}, schemas=${evidence.schemaCount}\n`,
  );
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
