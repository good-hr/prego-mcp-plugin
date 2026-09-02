import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assertExactCapabilityPairs,
  assertFullOpenApiArtifact,
} from "./check-prego-contract.mjs";
import {
  canonicalizeOpenApi,
  checkPregoContractFromRuntime,
  requireLoopback,
} from "./check-prego-contract-runtime.mjs";

// Negative cases fail before either checkout is read.
const frontendRoot = "/not-used";
const backendRoot = "/not-used";

const contract = JSON.parse(
  readFileSync(
    new URL("../contracts/pilot-tools.json", import.meta.url),
    "utf8",
  ),
);

function fullDocument({ includeNonPilot = true } = {}) {
  return {
    openapi: "3.0.3",
    info: { title: "Good HR API", version: "1" },
    paths: Object.fromEntries([
      ...contract.capabilities.map((capability, index) => [
        `/api/pilot/${index}`,
        { get: { operationId: `getPilotCapability${index}` } },
      ]),
      ...(includeNonPilot
        ? [["/api/v1/extra", { get: { operationId: "getNonPilotOperation" } }]]
        : []),
    ]),
    components: { schemas: { Example: { type: "object" } } },
  };
}

async function withServer(document, run) {
  const server = createServer((_, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(document));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}/v3/api-docs`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("runtime checker는 pilot 크기의 OpenAPI를 full provenance로 거부한다", async () => {
  const pilotLike = {
    ...fullDocument(),
    info: { title: "Prego MCP pilot OpenAPI contract", version: "1" },
    paths: Object.fromEntries(
      Object.entries(fullDocument().paths).slice(0, 12),
    ),
    components: { schemas: {} },
  };
  await withServer(pilotLike, async (openApiUrl) => {
    await assert.rejects(
      checkPregoContractFromRuntime({ frontendRoot, backendRoot, openApiUrl }),
      /pilot-openapi\.json은 full OpenAPI provenance로 사용할 수 없습니다/,
    );
  });
});

test("full provenance는 schema와 둘 이상의 operation을 요구한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "prego-openapi-contract-"));
  const artifact = join(directory, "openapi.json");
  try {
    writeFileSync(
      artifact,
      JSON.stringify({
        ...fullDocument({ includeNonPilot: false }),
        paths: Object.fromEntries(
          Object.entries(fullDocument({ includeNonPilot: false }).paths).slice(0, 1),
        ),
      }),
    );
    assert.throws(
      () => assertFullOpenApiArtifact(artifact),
      /둘 이상의 operation/,
    );
    writeFileSync(artifact, JSON.stringify(fullDocument()));
    assert.doesNotThrow(() => assertFullOpenApiArtifact(artifact));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("runtime checker는 public OpenAPI URL을 거부한다", async () => {
  await assert.rejects(
    checkPregoContractFromRuntime({
      frontendRoot,
      backendRoot,
      openApiUrl: "https://api.prego.team/v3/api-docs",
    }),
    /loopback 테스트 런타임/,
  );
});

test("runtime checker는 bracketed IPv6 loopback을 허용한다", () => {
  assert.doesNotThrow(() =>
    requireLoopback("http://[::1]:8080/v3/api-docs"),
  );
});

test("runtime checker는 loopback에서 시작한 redirect도 거부한다", async () => {
  const server = createServer((_, response) => {
    response.writeHead(302, { location: "https://api.prego.team/v3/api-docs" });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await assert.rejects(
      checkPregoContractFromRuntime({
        frontendRoot,
        backendRoot,
        openApiUrl: `http://127.0.0.1:${address.port}/v3/api-docs`,
      }),
      /redirect는 허용하지 않습니다/,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("OpenAPI artifact는 object key 순서와 무관하게 정규화한다", () => {
  assert.deepEqual(
    canonicalizeOpenApi({ z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] }),
    { a: [{ c: 3, d: 4 }], z: { a: 1, b: 2 } },
  );
});

test("capability contract는 extra capability drift를 거부한다", () => {
  assert.throws(
    () =>
      assertExactCapabilityPairs(
        "test registry",
        [{ id: "workforce.snapshot.read", effect: "read" }],
        [
          { id: "workforce.snapshot.read", effect: "read" },
          { id: "payroll.payment-item.create", effect: "update" },
        ],
      ),
    /capabilityId\/effect 집합이 plugin contract와 다릅니다/,
  );
});

test("foundation capability의 effect drift를 거부한다", () => {
  assert.throws(
    () =>
      assertExactCapabilityPairs(
        "FE registry foundation",
        [{ id: "company.context.read", effect: "read" }],
        [{ id: "company.context.read", effect: "update" }],
      ),
    /capabilityId\/effect 집합이 plugin contract와 다릅니다/,
  );
});
