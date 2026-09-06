import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildInvocation,
  childEnvironment,
  createRedactingTransform,
  extractTranscript,
  loadPluginSkill,
  makeDeveloperInstruction,
  readPreviousConversation,
  requireLoopbackMcpUrl,
  runPayrollConversation,
} from "./prego-payroll-conversation-runner.mjs";

async function assertProcessExited(pid, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    if (process.platform === "linux") {
      try {
        const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
        const processState = stat.slice(stat.lastIndexOf(") ") + 2).charAt(0);
        if (processState === "Z") return;
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
    }
    if (Date.now() >= deadline) assert.fail(`process ${pid} is still alive`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("conversation runner rejects non-loopback MCP fixture URLs", () => {
  assert.throws(
    () => requireLoopbackMcpUrl("https://api.prego.team/mcp"),
    /loopback MCP URL/,
  );
  assert.equal(
    requireLoopbackMcpUrl("http://127.0.0.1:8082/mcp"),
    "http://127.0.0.1:8082/mcp",
  );
  assert.equal(
    requireLoopbackMcpUrl("http://[::1]:8082/mcp"),
    "http://[::1]:8082/mcp",
  );
});

test("token is redacted even when split between output chunks", async () => {
  const transform = createRedactingTransform("private-token");
  let output = "";
  transform.on("data", (chunk) => {
    output += chunk.toString();
  });
  transform.write("before private-");
  transform.end("token after");
  await new Promise((resolve) => transform.on("end", resolve));
  assert.equal(output, "before [REDACTED_TOKEN] after");
  assert.equal(output.includes("private-token"), false);
});

test("redaction preserves UTF-8 JSONL split between byte chunks", async () => {
  const input = '{"message":"명절수당","token":"private-token"}\n';
  const bytes = Buffer.from(input);
  const koreanStart = bytes.indexOf(Buffer.from("명"));
  const tokenStart = bytes.indexOf(Buffer.from("private-token"));
  const chunks = [
    bytes.subarray(0, koreanStart + 1),
    bytes.subarray(koreanStart + 1, tokenStart + 8),
    bytes.subarray(tokenStart + 8),
  ];
  const transform = createRedactingTransform("private-token");
  let output = "";
  transform.on("data", (chunk) => {
    output += chunk.toString();
  });
  for (const chunk of chunks) transform.write(chunk);
  transform.end();
  await new Promise((resolve) => transform.on("end", resolve));

  assert.equal(output, '{"message":"명절수당","token":"[REDACTED_TOKEN]"}\n');
  assert.equal(output.includes("private-token"), false);
});

test("a prior run from another case cannot be resumed", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "prego-conversation-test-"));
  try {
    writeFileSync(
      join(outputDir, "other.summary.json"),
      JSON.stringify({
        caseId: "other-case",
        mcpUrl: "http://127.0.0.1:8082/mcp",
        mode: "raw-mcp",
        fixtureScope: "company fixture A",
        writePolicy: "allow-explicit-local-fixture",
        transcript: { threadId: "thread-other" },
      }),
    );
    assert.throws(
      () =>
        readPreviousConversation(outputDir, "other", {
          id: "followup",
          caseId: "holiday-allowance",
          mcpUrl: "http://127.0.0.1:8082/mcp",
          mode: "raw-mcp",
          fixtureScope: "company fixture A",
          writePolicy: "allow-explicit-local-fixture",
        }),
      /different caseId/,
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("runner isolates the agent without prescribing raw mode tool ordering", () => {
  const instruction = makeDeveloperInstruction({
    fixtureScope: "Company A local fixture only",
    writePolicy: "allow-explicit-local-fixture",
    mode: "raw-mcp",
  });
  const args = buildInvocation({
    cwd: "/tmp/isolated",
    question: "명절수당을 저장해줘",
    mcpUrl: "http://127.0.0.1:8082/mcp",
    tokenEnvVar: "PREGO_PAYROLL_CONVERSATION_BEARER",
    developerInstruction: instruction,
    answerPath: "/tmp/answer.md",
    previousThread: null,
    writePolicy: "allow-explicit-local-fixture",
  });
  assert.equal(instruction.includes("prego_capabilities"), false);
  assert.equal(args.includes("--ignore-user-config"), true);
  assert.equal(args.includes("--ignore-rules"), true);
  assert.equal(args.includes("gpt-5.6-terra"), true);
  assert.equal(args.includes("-s"), false);
  assert.equal(args.includes('sandbox_mode="workspace-write"'), true);
  assert.equal(
    args.includes("sandbox_workspace_write.network_access=true"),
    true,
  );
  assert.equal(args.includes("--approve-for-me"), false);
  assert.equal(args.includes('approval_policy="on-request"'), true);
  assert.equal(args.includes('approvals_reviewer="auto_review"'), true);
  assert.equal(args.includes('approval_policy="never"'), false);
});

test("deny write policy keeps the isolated agent read-only", () => {
  const args = buildInvocation({
    cwd: "/tmp/isolated",
    question: "명절수당을 알려줘",
    mcpUrl: "http://127.0.0.1:8082/mcp",
    tokenEnvVar: "PREGO_PAYROLL_CONVERSATION_BEARER",
    developerInstruction: "fixture boundary",
    answerPath: "/tmp/answer.md",
    previousThread: null,
    writePolicy: "deny",
  });
  assert.equal(args.includes("read-only"), true);
  assert.equal(
    args.includes("sandbox_workspace_write.network_access=true"),
    false,
  );
  assert.equal(args.includes("--approve-for-me"), false);
  assert.equal(args.includes('approval_policy="never"'), true);
});

test("child environment retains a custom CODEX_HOME", () => {
  const originalCodexHome = process.env.CODEX_HOME;
  const customCodexHome = "/tmp/custom-codex-home";
  process.env.CODEX_HOME = customCodexHome;
  try {
    const env = childEnvironment("PREGO_CONVERSATION_TEST_TOKEN", "");
    assert.equal(env.CODEX_HOME, customCodexHome);
  } finally {
    if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = originalCodexHome;
  }
});

test("plugin-skill snapshot contains its payroll reference and stable digest", () => {
  const skill = loadPluginSkill();
  assert.match(skill.sha256, /^[a-f0-9]{64}$/);
  assert.equal(skill.content.includes("# Payroll interpretation"), true);
  assert.equal(skill.content.includes("# Payroll reference"), true);
});

test("actual Codex MCP event shape is finalized once and keeps only non-PII evaluation keys", () => {
  const transcript = extractTranscript(
    [
      '{"type":"thread.started","thread_id":"thread-1"}',
      "not-json",
      JSON.stringify({
        type: "item.started",
        item: {
          id: "item-1",
          type: "mcp_tool_call",
          server: "prego_local_validation",
          tool: "prego_update",
          arguments: {
            capabilityId: "payroll.payment-item.create",
            scope: {
              mode: "selected",
              companyIds: ["company-fixture-1"],
              personIds: ["person-secret"],
            },
          },
          status: "in_progress",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item-1",
          type: "mcp_tool_call",
          server: "prego_local_validation",
          tool: "prego_update",
          arguments: {
            capabilityId: "payroll.payment-item.create",
            scope: {
              mode: "selected",
              companyIds: ["company-fixture-1"],
              personIds: ["person-secret"],
            },
          },
          result: {
            isError: false,
            structured_content: {
              companies: [
                {
                  companyId: "company-fixture-1",
                  status: "error",
                  data: { error: { code: "POLICY_CONFLICT" } },
                },
              ],
            },
          },
          auto_approved: true,
          status: "completed",
        },
      }),
      // A duplicate final event must not double-count the update.
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item-1",
          type: "mcp_tool_call",
          tool: "prego_update",
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item-2",
          type: "mcp_tool_call",
          tool: "prego_read",
          arguments: {
            capabilityId: "payroll.payment-item.list.read",
            scope: {
              mode: "selected",
              companyIds: ["company-fixture-1"],
              personIds: ["person-secret"],
            },
          },
          result: {
            isError: false,
            structured_content: {
              companies: [
                { companyId: "company-fixture-1", status: "success" },
              ],
            },
          },
          status: "completed",
        },
      }),
    ].join("\n"),
  );
  assert.equal(transcript.available, true);
  assert.equal(transcript.malformedLineCount, 1);
  assert.equal(transcript.updates.invoked, true);
  assert.equal(transcript.toolCalls.length, 2);
  assert.equal(transcript.updates.transportCompleted, 1);
  assert.equal(transcript.updates.autoApproved, 1);
  assert.deepEqual(transcript.updates.businessErrors, [
    { sequence: 1, errorKind: "prego-payload" },
  ]);
  assert.deepEqual(transcript.updates.subsequentReads, [
    {
      sequence: 2,
      transportStatus: "completed",
      businessStatus: "unknown",
      errorKind: null,
      approvalStatus: "not_recorded",
      capabilityId: "payroll.payment-item.list.read",
      scope: { mode: "selected", companyIds: ["company-fixture-1"] },
    },
  ]);
  assert.equal(JSON.stringify(transcript).includes("person-secret"), false);
  const malformedOnly = extractTranscript("not-json");
  assert.deepEqual(malformedOnly.toolCalls, []);
  assert.equal(malformedOnly.malformedLineCount, 1);
  assert.equal(malformedOnly.updates.invoked, false);
});

test("spawn failure produces a private SPAWN_ERROR summary instead of rejecting on error", async () => {
  const outputDir = mkdtempSync(
    join(tmpdir(), "prego-conversation-spawn-test-"),
  );
  const tokenEnv = "PREGO_CONVERSATION_TEST_TOKEN";
  const originalPath = process.env.PATH;
  process.env[tokenEnv] = "private-test-token";
  // childEnvironment inherits this empty executable directory, making `codex`
  // genuinely unavailable without changing the runner's production command.
  process.env.PATH = outputDir;
  try {
    const summary = await runPayrollConversation({
      id: "spawn-error",
      caseId: "holiday-allowance",
      question: "명절수당을 저장해줘",
      mcpUrl: "http://127.0.0.1:8082/mcp",
      fixtureScope: "Company fixture only",
      tokenEnvVar: tokenEnv,
      outputDir,
      timeoutMs: 1_000,
    });
    assert.equal(summary.process.status, "SPAWN_ERROR");
    assert.equal(JSON.stringify(summary).includes("private-test-token"), false);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    delete process.env[tokenEnv];
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("timeout force-kills a SIGTERM-trapping child after its leader closes", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "prego-conversation-timeout-"));
  const tokenEnv = "PREGO_CONVERSATION_TIMEOUT_TOKEN";
  const childPidPath = join(outputDir, "inherited-child.pid");
  const termPath = join(outputDir, "leader-term");
  const originalPath = process.env.PATH;
  process.env[tokenEnv] = "private-test-token";
  process.env.PATH = outputDir;
  const executable = join(outputDir, "codex");
  writeFileSync(
    executable,
    `#!/bin/sh
trap 'echo term > "${termPath}"; exit 0' TERM
/bin/sh -c 'trap "" TERM; echo $$ > "${childPidPath}"; exec >/dev/null 2>&1; while :; do /bin/sleep 1; done' &
while :; do /bin/sleep 1; done
`,
  );
  chmodSync(executable, 0o700);
  try {
    const startedAt = Date.now();
    const summary = await runPayrollConversation({
      id: "timeout-force-kill",
      caseId: "holiday-allowance",
      question: "명절수당을 저장해줘",
      mcpUrl: "http://127.0.0.1:8082/mcp",
      fixtureScope: "Company fixture only",
      tokenEnvVar: tokenEnv,
      outputDir,
      timeoutMs: 1_000,
    });
    const elapsedMs = Date.now() - startedAt;
    assert.equal(summary.process.status, "TIMED_OUT");
    assert.ok(elapsedMs < 2_500, `timeout took ${elapsedMs}ms`);
    assert.equal(existsSync(termPath), true);
    assert.equal(existsSync(childPidPath), true);
    const inheritedChildPid = Number(readFileSync(childPidPath, "utf8"));
    await assertProcessExited(inheritedChildPid);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    delete process.env[tokenEnv];
    rmSync(outputDir, { recursive: true, force: true });
  }
});
