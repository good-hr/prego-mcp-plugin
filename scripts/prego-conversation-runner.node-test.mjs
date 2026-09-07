import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
import { fileURLToPath } from "node:url";

import {
  buildInvocation,
  childEnvironment,
  createRedactingTransform,
  extractTranscript,
  loadPluginSkills,
  makeDeveloperInstruction,
  readPreviousConversation,
  requireLoopbackMcpUrl,
  runConversation,
} from "./prego-conversation-runner.mjs";

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

async function waitForFile(path, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) assert.fail(`timed out waiting for ${path}`);
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

test("a resume cannot mix a different workflow snapshot or reasoning effort", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "prego-conversation-resume-"));
  const previous = {
    caseId: "executive-briefing",
    mcpUrl: "http://127.0.0.1:8082/mcp",
    mode: "plugin-skill",
    fixtureScope: "company fixture A",
    writePolicy: "deny",
    model: "gpt-5.6-terra",
    reasoningEffort: "high",
    scenarioId: "executive-briefing",
    scenarioSha256: "scenario-digest",
    skillIds: ["company-briefing"],
    skillSha256: "skill-digest",
    transcript: { threadId: "thread-previous" },
  };
  try {
    writeFileSync(
      join(outputDir, "previous.summary.json"),
      JSON.stringify(previous),
    );
    const options = {
      ...previous,
      id: "followup",
      reasoningEffort: "medium",
    };
    assert.throws(
      () => readPreviousConversation(outputDir, "previous", options),
      /different reasoningEffort/,
    );
    assert.throws(
      () =>
        readPreviousConversation(outputDir, "previous", {
          ...previous,
          id: "followup",
          skillIds: ["hr-control-tower"],
        }),
      /different skillIds/,
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("raw scenario runs do not inject scenario workflows, while explicit raw workflows fail", async () => {
  const options = {
    id: "raw-scenario",
    scenarioId: "executive-briefing",
    mode: "raw-mcp",
    mcpUrl: "http://127.0.0.1:8082/mcp",
    fixtureScope: "Company fixture only",
    tokenEnvVar: "PREGO_CONVERSATION_MISSING_TOKEN",
  };
  await assert.rejects(
    () => runConversation(options),
    /PREGO_CONVERSATION_MISSING_TOKEN is required/,
  );
  await assert.rejects(
    () =>
      runConversation({
        ...options,
        skillIds: ["company-briefing"],
      }),
    /raw-mcp mode must not include skillIds/,
  );
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
    tokenEnvVar: "PREGO_CONVERSATION_BEARER",
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
  assert.equal(args.includes('model_reasoning_effort="high"'), true);
});

test("runner accepts only supported reasoning effort values", () => {
  const args = buildInvocation({
    cwd: "/tmp/isolated",
    question: "인사 현황을 알려줘",
    mcpUrl: "http://127.0.0.1:8082/mcp",
    tokenEnvVar: "PREGO_CONVERSATION_BEARER",
    developerInstruction: "fixture boundary",
    answerPath: "/tmp/answer.md",
    previousThread: null,
    writePolicy: "deny",
    reasoningEffort: "medium",
  });
  assert.equal(args.includes('model_reasoning_effort="medium"'), true);
  assert.throws(
    () =>
      buildInvocation({
        cwd: "/tmp/isolated",
        question: "인사 현황을 알려줘",
        mcpUrl: "http://127.0.0.1:8082/mcp",
        tokenEnvVar: "PREGO_CONVERSATION_BEARER",
        developerInstruction: "fixture boundary",
        answerPath: "/tmp/answer.md",
        previousThread: null,
        writePolicy: "deny",
        reasoningEffort: "max",
      }),
    /invalid reasoningEffort/,
  );
});

test("deny write policy keeps the isolated agent read-only", () => {
  const args = buildInvocation({
    cwd: "/tmp/isolated",
    question: "명절수당을 알려줘",
    mcpUrl: "http://127.0.0.1:8082/mcp",
    tokenEnvVar: "PREGO_CONVERSATION_BEARER",
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

test("selected payroll workflow snapshot contains shared interpretation, reference, and stable digest", () => {
  const skill = loadPluginSkills(["payroll-policy-builder"]);
  assert.match(skill.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skill.ids, ["payroll-policy-builder"]);
  assert.equal(skill.content.includes("# Payroll interpretation"), true);
  assert.equal(skill.content.includes("# Payroll reference"), true);
});

test("selected non-payroll workflow omits the payroll reference", () => {
  const skill = loadPluginSkills(["company-briefing"]);
  assert.equal(skill.content.includes("# Shared interpretation"), true);
  assert.equal(skill.content.includes("# Payroll reference"), false);
});

test("only packaged workflow IDs can be selected", () => {
  assert.throws(
    () => loadPluginSkills(["prego-interpretation"]),
    /not a packaged workflow/,
  );
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
  assert.equal(transcript.toolCalls[0].startedEvent, 2);
  assert.equal(transcript.toolCalls[0].completedEvent, 3);
  assert.deepEqual(transcript.updates.businessErrors, [
    { sequence: 1, errorKind: "prego-payload" },
  ]);
  assert.deepEqual(transcript.updates.subsequentReads, [
    {
      sequence: 2,
      startedEvent: null,
      completedEvent: 5,
      server: null,
      transportStatus: "completed",
      unfinished: false,
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

test("an interrupted update remains visible to evaluators without raw arguments", () => {
  const transcript = extractTranscript(
    JSON.stringify({
      type: "item.started",
      item: {
        id: "unfinished-update",
        type: "mcp_tool_call",
        server: "prego_fixture",
        tool: "prego_update",
        arguments: {
          capabilityId: "payroll.payment-item.update",
          scope: {
            mode: "selected",
            companyIds: ["company-fixture-1"],
            personIds: ["person-secret"],
          },
          privateFormula: "do-not-copy",
        },
        status: "in_progress",
      },
    }),
  );
  assert.equal(transcript.toolCalls.length, 1);
  assert.equal(transcript.toolCalls[0].unfinished, true);
  assert.equal(transcript.toolCalls[0].server, "prego_fixture");
  assert.deepEqual(transcript.updates.unfinished, [
    {
      sequence: 1,
      startedEvent: 1,
      completedEvent: null,
      server: "prego_fixture",
      capabilityId: "payroll.payment-item.update",
      scope: { mode: "selected", companyIds: ["company-fixture-1"] },
    },
  ]);
  assert.equal(JSON.stringify(transcript).includes("person-secret"), false);
  assert.equal(JSON.stringify(transcript).includes("do-not-copy"), false);
});

test("compact observations retain a read start that preceded update completion", () => {
  const transcript = extractTranscript(
    [
      {
        type: "item.started",
        item: {
          id: "update",
          type: "mcp_tool_call",
          tool: "prego_update",
          status: "in_progress",
        },
      },
      {
        type: "item.started",
        item: {
          id: "read",
          type: "mcp_tool_call",
          tool: "prego_read",
          status: "in_progress",
        },
      },
      {
        type: "item.completed",
        item: {
          id: "update",
          type: "mcp_tool_call",
          tool: "prego_update",
          status: "completed",
          result: { structured_content: {} },
        },
      },
      {
        type: "item.completed",
        item: {
          id: "read",
          type: "mcp_tool_call",
          tool: "prego_read",
          status: "completed",
          result: { structured_content: {} },
        },
      },
    ]
      .map(JSON.stringify)
      .join("\n"),
  );
  const [update, read] = transcript.toolCalls;
  assert.equal(update.completedEvent, 3);
  assert.equal(read.startedEvent, 2);
  assert.ok(read.startedEvent < update.completedEvent);
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
    const summary = await runConversation({
      id: "spawn-error",
      caseId: "holiday-allowance",
      question: "명절수당을 저장해줘 private-test-token",
      mcpUrl: "http://127.0.0.1:8082/mcp",
      fixtureScope: "Company fixture only",
      tokenEnvVar: tokenEnv,
      outputDir,
      timeoutMs: 1_000,
    });
    assert.equal(summary.process.status, "SPAWN_ERROR");
    assert.equal(JSON.stringify(summary).includes("private-test-token"), false);
    assert.equal(
      readFileSync(summary.outputs.questionPath, "utf8"),
      "명절수당을 저장해줘 [REDACTED_TOKEN]",
    );
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    delete process.env[tokenEnv];
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("a scenario supplies selected workflows and provenance without exposing its question", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "prego-conversation-scenario-"));
  const tokenEnv = "PREGO_CONVERSATION_SCENARIO_TOKEN";
  const originalPath = process.env.PATH;
  process.env[tokenEnv] = "private-test-token";
  process.env.PATH = outputDir;
  try {
    const summary = await runConversation({
      id: "scenario-spawn-error",
      scenarioId: "executive-briefing",
      mcpUrl: "http://127.0.0.1:8082/mcp",
      fixtureScope: "Company fixture only",
      tokenEnvVar: tokenEnv,
      outputDir,
      timeoutMs: 1_000,
      reasoningEffort: "medium",
    });
    assert.equal(summary.process.status, "SPAWN_ERROR");
    assert.equal(summary.caseId, "executive-briefing");
    assert.equal(summary.mode, "plugin-skill");
    assert.deepEqual(summary.skillIds, ["company-briefing"]);
    assert.equal(summary.scenarioId, "executive-briefing");
    assert.match(summary.questionSha256, /^[a-f0-9]{64}$/);
    assert.equal(summary.reasoningEffort, "medium");
    assert.equal(JSON.stringify(summary).includes("우리 회사 인사"), false);
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
    const summary = await runConversation({
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

for (const [cancellationSignal, expectedExitCode] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  test(
    `${cancellationSignal} cancels the runner and force-kills its detached descendants`,
    { skip: process.platform === "win32" },
    async () => {
      const outputDir = mkdtempSync(
        join(tmpdir(), "prego-conversation-signal-"),
      );
      const tokenEnv = "PREGO_CONVERSATION_SIGNAL_TOKEN";
      const childPidPath = join(outputDir, "inherited-child.pid");
      const termPath = join(outputDir, "leader-term");
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
      const runner = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL("./prego-conversation-runner.mjs", import.meta.url),
          ),
          "--id",
          "signal-cancel",
          "--case-id",
          "holiday-allowance",
          "--question",
          "명절수당을 저장해줘",
          "--mcp-url",
          "http://127.0.0.1:8082/mcp",
          "--fixture-scope",
          "Company fixture only",
          "--token-env",
          tokenEnv,
          "--output-dir",
          outputDir,
          "--timeout-ms",
          "60000",
        ],
        {
          env: {
            ...process.env,
            PATH: outputDir,
            [tokenEnv]: "private-test-token",
          },
          stdio: "ignore",
        },
      );
      try {
        await waitForFile(childPidPath);
        const closed = new Promise((resolve) =>
          runner.once("close", (code, signal) => resolve([code, signal])),
        );
        runner.kill(cancellationSignal);
        const [exitCode, exitSignal] = await closed;
        assert.equal(exitCode, expectedExitCode);
        assert.equal(exitSignal, null);
        assert.equal(existsSync(termPath), true);
        const inheritedChildPid = Number(readFileSync(childPidPath, "utf8"));
        await assertProcessExited(inheritedChildPid);
        const summary = JSON.parse(
          readFileSync(join(outputDir, "signal-cancel.summary.json"), "utf8"),
        );
        assert.equal(summary.process.status, "CANCELLED");
        assert.equal(summary.process.signal, cancellationSignal);
      } finally {
        if (runner.exitCode === null && runner.signalCode === null)
          runner.kill("SIGKILL");
        rmSync(outputDir, { recursive: true, force: true });
      }
    },
  );
}
