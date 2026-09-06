#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Transform } from "node:stream";
import { finished } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOKEN_ENV = "PREGO_CONVERSATION_BEARER";
const DEFAULT_MODEL = "gpt-5.6-terra";
const MODES = new Set(["raw-mcp", "plugin-skill"]);
const WRITE_POLICIES = new Set(["deny", "allow-explicit-local-fixture"]);
const REASONING_EFFORTS = new Set(["low", "medium", "high"]);
const PAYROLL_REFERENCE_WORKFLOWS = new Set([
  "payroll-operations",
  "payroll-policy-builder",
  "workforce-reporting",
]);
const TERMINATION_GRACE_MS = 1_000;

function requireIdentifier(name, value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    throw new Error(
      `${name} must contain lowercase letters, numbers, and hyphens only`,
    );
  }
}

function requireText(name, value) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required`);
  return value.trim();
}

function requireTokenEnvironmentName(value) {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{0,127}$/.test(value)) {
    throw new Error(
      "tokenEnvVar must be an uppercase environment variable name",
    );
  }
}

export function requireLoopbackMcpUrl(urlText) {
  let url;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error("mcpUrl must be a valid URL");
  }
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!loopbackHosts.has(url.hostname)) {
    throw new Error("Prego conversation fixtures must use a loopback MCP URL");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("mcpUrl must use HTTP(S)");
  }
  return url.toString();
}

function privateOutputDirectory(outputDir) {
  if (!outputDir) {
    const directory = mkdtempSync(join(tmpdir(), "prego-conversation-"));
    chmodSync(directory, 0o700);
    return directory;
  }
  const directory = resolve(outputDir);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  if (!statSync(directory).isDirectory())
    throw new Error("outputDir must be a directory");
  return directory;
}

function openPrivateNewFile(path, id) {
  if (existsSync(path)) throw new Error(`id already has an output: ${id}`);
  const descriptor = openSync(path, "wx", 0o600);
  closeSync(descriptor);
}

function outputFiles(outputDir, id) {
  const files = {
    questionPath: join(outputDir, `${id}.question.md`),
    answerPath: join(outputDir, `${id}.answer.md`),
    jsonlPath: join(outputDir, `${id}.jsonl`),
    stderrPath: join(outputDir, `${id}.stderr.log`),
    summaryPath: join(outputDir, `${id}.summary.json`),
  };
  for (const path of Object.values(files)) openPrivateNewFile(path, id);
  return files;
}

function requireSkillIds(skillIds, mode) {
  if (!Array.isArray(skillIds)) throw new Error("skillIds must be an array");
  for (const skillId of skillIds) requireIdentifier("skillId", skillId);
  if (new Set(skillIds).size !== skillIds.length)
    throw new Error("skillIds must not contain duplicates");
  if (mode === "plugin-skill" && skillIds.length === 0)
    throw new Error("plugin-skill mode requires one or more skillIds");
  if (mode === "raw-mcp" && skillIds.length > 0)
    throw new Error("raw-mcp mode must not include skillIds");
  return skillIds;
}

function packagedWorkflowIds() {
  const contract = JSON.parse(
    readFileSync(
      join(SCRIPT_ROOT, "..", "contracts", "pilot-tools.json"),
      "utf8",
    ),
  );
  return new Set(contract.skills.map((skill) => skill.id));
}

export function loadPluginSkills(
  skillIds,
  skillRoot = join(SCRIPT_ROOT, "..", "skills"),
) {
  requireSkillIds(skillIds, "plugin-skill");
  const root = resolve(skillRoot);
  const supportedIds = packagedWorkflowIds();
  for (const skillId of skillIds) {
    if (!supportedIds.has(skillId))
      throw new Error(`skillId is not a packaged workflow: ${skillId}`);
  }
  const workflows = skillIds.map((skillId) => ({
    id: skillId,
    content: readFileSync(join(root, skillId, "SKILL.md"), "utf8"),
  }));
  const interpretation = readFileSync(
    join(root, "prego-interpretation", "SKILL.md"),
    "utf8",
  );
  const includePayrollReference = skillIds.some((skillId) =>
    PAYROLL_REFERENCE_WORKFLOWS.has(skillId),
  );
  const payrollReference = includePayrollReference
    ? readFileSync(
        join(root, "prego-interpretation", "references", "payroll.md"),
        "utf8",
      )
    : null;
  const content = [
    ...workflows.map(
      ({ id, content: workflow }) => `# Workflow: ${id}\n\n${workflow}`,
    ),
    `# Shared interpretation\n\n${interpretation}`,
    ...(payrollReference ? [`# Payroll reference\n\n${payrollReference}`] : []),
  ].join("\n\n");
  return {
    root,
    ids: [...skillIds],
    content,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

/**
 * This intentionally contains only the fixture boundary. Workflow directions are
 * supplied exclusively by the plugin skill mode, never by the runner itself.
 */
export function makeDeveloperInstruction({
  fixtureScope,
  writePolicy,
  mode,
  pluginSkills,
}) {
  const scope = requireText("fixtureScope", fixtureScope);
  if (!WRITE_POLICIES.has(writePolicy)) throw new Error("invalid writePolicy");
  if (!MODES.has(mode)) throw new Error("invalid mode");
  if (mode === "plugin-skill" && !pluginSkills)
    throw new Error("plugin-skill mode requires selected pluginSkills");
  const writeBoundary =
    writePolicy === "deny"
      ? "Do not call update tools."
      : "You may call an update tool only for an explicit user save request and only against this local fixture.";
  const base = [
    "You are in a context-free Prego MCP fixture conversation.",
    `The only allowed Prego data scope is this local fixture: ${scope}`,
    writeBoundary,
    "Do not inspect local files, repositories, memories, user configuration, the internet, or other services.",
    "Do not claim an action succeeded without reporting the returned Prego evidence.",
  ].join("\n");
  return mode === "plugin-skill"
    ? `${base}\n\nApply the selected Prego plugin guidance below exactly as provided:\n\n${pluginSkills.content}`
    : base;
}

export function childEnvironment(tokenEnvVar, token) {
  const inherited = [
    "PATH",
    "HOME",
    "CODEX_HOME",
    "TMPDIR",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ];
  const env = {};
  for (const name of inherited)
    if (process.env[name]) env[name] = process.env[name];
  // The bearer is the sole Prego credential inherited by the child process.
  env[tokenEnvVar] = token;
  return env;
}

export function buildInvocation({
  cwd,
  question,
  mcpUrl,
  tokenEnvVar,
  developerInstruction,
  answerPath,
  previousThread,
  writePolicy,
  reasoningEffort = "high",
}) {
  if (!WRITE_POLICIES.has(writePolicy)) throw new Error("invalid writePolicy");
  if (!REASONING_EFFORTS.has(reasoningEffort))
    throw new Error("invalid reasoningEffort");
  const allowsFixtureWrites = writePolicy === "allow-explicit-local-fixture";
  const approvalConfig = allowsFixtureWrites
    ? [
        "-c",
        'approval_policy="on-request"',
        "-c",
        'approvals_reviewer="auto_review"',
        "-c",
        'sandbox_mode="workspace-write"',
      ]
    : ["-c", 'approval_policy="never"'];
  const common = [
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "-m",
    DEFAULT_MODEL,
    "--json",
    "-c",
    `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`,
    ...approvalConfig,
    "-c",
    "features.memories=false",
    "-c",
    "features.plugins=false",
    "-c",
    "features.apps=false",
    "-c",
    "features.shell_tool=false",
    "-c",
    'web_search="disabled"',
    ...(allowsFixtureWrites
      ? ["-c", "sandbox_workspace_write.network_access=true"]
      : []),
    "-c",
    `developer_instructions=${JSON.stringify(developerInstruction)}`,
    "-c",
    `mcp_servers.prego_fixture.url=${JSON.stringify(mcpUrl)}`,
    "-c",
    `mcp_servers.prego_fixture.bearer_token_env_var=${JSON.stringify(tokenEnvVar)}`,
    "-c",
    "mcp_servers.prego_fixture.tool_timeout_sec=120",
    "-o",
    answerPath,
  ];
  if (previousThread)
    return ["exec", "resume", ...common, previousThread, question];
  return [
    "exec",
    "-C",
    cwd,
    ...(allowsFixtureWrites ? [] : ["-s", "read-only"]),
    ...common,
    question,
  ];
}

export function redactText(value, secret) {
  const text = String(value ?? "");
  return secret ? text.split(secret).join("[REDACTED_TOKEN]") : text;
}

export function createRedactingTransform(secret) {
  let tail = "";
  const keep = Math.max(0, secret.length - 1);
  const decoder = new StringDecoder("utf8");
  const redactChunk = (value) => redactText(value, secret);
  return new Transform({
    transform(chunk, _encoding, callback) {
      const value = tail + decoder.write(chunk);
      if (!keep || value.length <= keep) {
        tail = value;
      } else {
        let cutoff = value.length - keep;
        const tokenStart = value.lastIndexOf(secret, cutoff - 1);
        if (tokenStart >= 0 && tokenStart + secret.length > cutoff)
          cutoff = tokenStart;
        this.push(redactChunk(value.slice(0, cutoff)));
        tail = value.slice(cutoff);
      }
      callback();
    },
    flush(callback) {
      this.push(redactChunk(tail + decoder.end()));
      callback();
    },
  });
}

function signalProcessGroup(child, signal) {
  if (!Number.isInteger(child.pid) || child.pid < 1) return false;
  if (process.platform === "win32") return child.kill(signal);
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

function capabilityContext(item) {
  const argumentsValue = item.arguments;
  const capabilityId =
    argumentsValue && typeof argumentsValue.capabilityId === "string"
      ? argumentsValue.capabilityId
      : null;
  const scope = argumentsValue?.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return { capabilityId, scope: null };
  }
  return {
    capabilityId,
    // Only company IDs identify a Prego scope. Do not copy people or arbitrary arguments.
    scope: {
      mode: typeof scope.mode === "string" ? scope.mode : null,
      companyIds: Array.isArray(scope.companyIds)
        ? scope.companyIds.filter((value) => typeof value === "string")
        : [],
    },
  };
}

function hasPregoBusinessError(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value))
    return value.some((entry) => hasPregoBusinessError(entry));
  if (typeof value !== "object") return false;
  for (const [key, entry] of Object.entries(value)) {
    if (
      key === "error" &&
      entry !== null &&
      entry !== undefined &&
      entry !== ""
    )
      return true;
    if (
      key === "status" &&
      typeof entry === "string" &&
      ["error", "failed"].includes(entry.toLowerCase())
    ) {
      return true;
    }
    // MCP text can contain arbitrary content. Structured data is the only evidence inspected.
    if (key !== "content" && hasPregoBusinessError(entry)) return true;
  }
  return false;
}

function businessOutcome(item, transportStatus) {
  if (transportStatus !== "completed")
    return { status: "unknown", errorKind: null };
  if (item.error || item.error_message || item.result?.isError === true) {
    return { status: "error", errorKind: "mcp-result" };
  }
  const payload = item.result?.structured_content;
  if (payload && hasPregoBusinessError(payload)) {
    return { status: "error", errorKind: "prego-payload" };
  }
  // A completed MCP transport is not proof a Prego setting was saved.
  return { status: "unknown", errorKind: null };
}

function approvalOutcome(item) {
  if (item.auto_approved === true) return "auto_approved";
  const errorText = [item.error, item.error_message, item.result?.error]
    .filter((value) => typeof value === "string")
    .join(" ");
  return /approval.*(?:required|denied)|requires approval/i.test(errorText)
    ? "human_approval_required"
    : "not_recorded";
}

/**
 * Parsing never decides whether the business task passed. It only reports the
 * transcript evidence that an evaluator can judge independently.
 */
export function extractTranscript(jsonlText) {
  const result = {
    available: false,
    eventCount: 0,
    malformedLineCount: 0,
    threadId: null,
    toolCalls: [],
    updates: {
      invoked: false,
      transportCompleted: 0,
      transportFailed: 0,
      businessErrors: [],
      businessUnknown: 0,
      autoApproved: 0,
      humanApprovalRequired: 0,
      unfinished: [],
      subsequentReads: [],
    },
  };
  const callsByItemId = new Map();
  const callForItem = (item, eventType, observationEvent) => {
    const itemId = typeof item.id === "string" ? item.id : null;
    const existing = itemId ? callsByItemId.get(itemId) : null;
    if (
      existing &&
      eventType === "item.completed" &&
      existing.transportStatus !== "in_progress"
    ) {
      return existing;
    }
    const transportStatus =
      eventType === "item.started"
        ? "in_progress"
        : item.status === "completed"
          ? "completed"
          : item.status === "failed"
            ? "failed"
            : "unknown";
    const business = businessOutcome(item, transportStatus);
    const { capabilityId, scope } = capabilityContext(item);
    const call = {
      sequence: existing?.sequence ?? result.toolCalls.length + 1,
      startedEvent:
        eventType === "item.started"
          ? observationEvent
          : (existing?.startedEvent ?? null),
      completedEvent:
        eventType === "item.completed"
          ? observationEvent
          : (existing?.completedEvent ?? null),
      itemId,
      server:
        typeof item.server === "string"
          ? item.server
          : (existing?.server ?? null),
      tool: item.tool ?? "unknown",
      transportStatus,
      unfinished: transportStatus === "in_progress",
      businessStatus: business.status,
      errorKind: business.errorKind,
      approvalStatus: approvalOutcome(item),
      capabilityId,
      scope,
    };
    if (existing) {
      Object.assign(existing, call);
      return existing;
    }
    result.toolCalls.push(call);
    if (itemId) callsByItemId.set(itemId, call);
    return call;
  };
  for (const line of String(jsonlText).split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      result.malformedLineCount += 1;
      continue;
    }
    result.available = true;
    result.eventCount += 1;
    if (
      event.type === "thread.started" &&
      typeof event.thread_id === "string"
    ) {
      result.threadId = event.thread_id;
    }
    const item = event.item;
    if (
      !["item.started", "item.completed"].includes(event.type) ||
      !item ||
      item.type !== "mcp_tool_call"
    )
      continue;
    callForItem(item, event.type, result.eventCount);
  }
  let updateSeen = false;
  for (const call of result.toolCalls) {
    if (call.tool === "prego_update") {
      updateSeen = true;
      result.updates.invoked = true;
      if (call.transportStatus === "completed")
        result.updates.transportCompleted += 1;
      if (call.transportStatus === "failed")
        result.updates.transportFailed += 1;
      if (call.unfinished) {
        result.updates.unfinished.push({
          sequence: call.sequence,
          startedEvent: call.startedEvent,
          completedEvent: call.completedEvent,
          server: call.server,
          capabilityId: call.capabilityId,
          scope: call.scope,
        });
      } else if (call.businessStatus === "error") {
        result.updates.businessErrors.push({
          sequence: call.sequence,
          errorKind: call.errorKind,
        });
      } else {
        result.updates.businessUnknown += 1;
      }
      if (call.approvalStatus === "auto_approved")
        result.updates.autoApproved += 1;
      if (call.approvalStatus === "human_approval_required") {
        result.updates.humanApprovalRequired += 1;
      }
    } else if (updateSeen && call.tool === "prego_read") {
      result.updates.subsequentReads.push({
        sequence: call.sequence,
        startedEvent: call.startedEvent,
        completedEvent: call.completedEvent,
        server: call.server,
        transportStatus: call.transportStatus,
        unfinished: call.unfinished,
        businessStatus: call.businessStatus,
        errorKind: call.errorKind,
        approvalStatus: call.approvalStatus,
        capabilityId: call.capabilityId,
        scope: call.scope,
      });
    }
  }
  return result;
}

export function readPreviousConversation(outputDir, previousId, options) {
  if (previousId === undefined || previousId === null) return null;
  requireIdentifier("previousId", previousId);
  if (previousId === options.id) throw new Error("id must be new");
  const path = join(outputDir, `${previousId}.summary.json`);
  if (!existsSync(path))
    throw new Error(`previous output not found: ${previousId}`);
  let previous;
  try {
    previous = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("previous summary is not valid JSON");
  }
  for (const key of [
    "caseId",
    "mcpUrl",
    "mode",
    "fixtureScope",
    "writePolicy",
    "model",
    "reasoningEffort",
    "scenarioId",
    "scenarioSha256",
    "skillIds",
    "skillSha256",
  ]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(options[key])) {
      throw new Error(
        `previous conversation cannot be mixed with a different ${key}`,
      );
    }
  }
  if (!previous.transcript?.threadId)
    throw new Error("previous conversation has no resumable thread");
  return previous.transcript.threadId;
}

function sanitizeAnswer(path, token) {
  if (!existsSync(path)) return;
  writeFileSync(path, redactText(readFileSync(path, "utf8"), token), {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

function loadScenario(scenarioId) {
  if (scenarioId === undefined || scenarioId === null) return null;
  requireIdentifier("scenarioId", scenarioId);
  const document = JSON.parse(
    readFileSync(
      join(SCRIPT_ROOT, "..", "contracts", "conversation-scenarios.json"),
      "utf8",
    ),
  );
  if (document.version !== 1 || !Array.isArray(document.scenarios))
    throw new Error("conversation scenarios must have version 1 and scenarios");
  const scenario = document.scenarios.find((entry) => entry.id === scenarioId);
  if (!scenario)
    throw new Error(`conversation scenario not found: ${scenarioId}`);
  requireIdentifier("scenario.id", scenario.id);
  requireText("scenario.question", scenario.question);
  requireSkillIds(scenario.skillIds, "plugin-skill");
  return {
    ...scenario,
    sha256: createHash("sha256").update(JSON.stringify(scenario)).digest("hex"),
  };
}

export async function runConversation({
  id,
  caseId,
  question,
  mcpUrl,
  fixtureScope,
  writePolicy = "allow-explicit-local-fixture",
  mode,
  tokenEnvVar = DEFAULT_TOKEN_ENV,
  previousId,
  outputDir,
  skillRoot,
  skillIds,
  scenarioId,
  reasoningEffort = "high",
  timeoutMs = 300_000,
} = {}) {
  const scenario = loadScenario(scenarioId);
  const resolvedMode = mode ?? (scenario ? "plugin-skill" : "raw-mcp");
  const resolvedCaseId = scenario ? scenario.id : caseId;
  if (scenario && caseId !== undefined && caseId !== scenario.id)
    throw new Error("caseId must match scenarioId when scenarioId is used");
  const resolvedQuestion = question ?? scenario?.question;
  const resolvedSkillIds =
    skillIds ??
    (resolvedMode === "plugin-skill" ? (scenario?.skillIds ?? []) : []);
  requireIdentifier("id", id);
  requireIdentifier("caseId", resolvedCaseId);
  requireText("question", resolvedQuestion);
  requireText("fixtureScope", fixtureScope);
  requireTokenEnvironmentName(tokenEnvVar);
  const normalizedUrl = requireLoopbackMcpUrl(mcpUrl);
  if (!WRITE_POLICIES.has(writePolicy)) throw new Error("invalid writePolicy");
  if (!MODES.has(resolvedMode)) throw new Error("invalid mode");
  requireSkillIds(resolvedSkillIds, resolvedMode);
  if (!REASONING_EFFORTS.has(reasoningEffort))
    throw new Error("invalid reasoningEffort");
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1_000 ||
    timeoutMs > 900_000
  ) {
    throw new Error("timeoutMs must be between 1000 and 900000");
  }
  const token = process.env[tokenEnvVar];
  if (!token) throw new Error(`${tokenEnvVar} is required in the environment`);

  const privateDir = privateOutputDirectory(outputDir);
  const pluginSkills =
    resolvedMode === "plugin-skill"
      ? loadPluginSkills(resolvedSkillIds, skillRoot)
      : null;
  const questionSha256 = createHash("sha256")
    .update(resolvedQuestion)
    .digest("hex");
  const options = {
    id,
    caseId: resolvedCaseId,
    mcpUrl: normalizedUrl,
    fixtureScope,
    writePolicy,
    mode: resolvedMode,
    model: DEFAULT_MODEL,
    reasoningEffort,
    scenarioId: scenario?.id ?? null,
    scenarioSha256: scenario?.sha256 ?? null,
    skillIds: pluginSkills?.ids ?? [],
    skillSha256: pluginSkills?.sha256 ?? null,
  };
  const previousThread = readPreviousConversation(
    privateDir,
    previousId,
    options,
  );
  const files = outputFiles(privateDir, id);
  writeFileSync(files.questionPath, redactText(resolvedQuestion, token), {
    mode: 0o600,
  });
  const cwd = mkdtempSync(join(tmpdir(), "prego-conversation-agent-"));
  chmodSync(cwd, 0o700);
  const developerInstruction = makeDeveloperInstruction({
    fixtureScope,
    writePolicy,
    mode: resolvedMode,
    pluginSkills,
  });
  const args = buildInvocation({
    cwd,
    question: resolvedQuestion,
    mcpUrl: normalizedUrl,
    tokenEnvVar,
    developerInstruction,
    answerPath: files.answerPath,
    previousThread,
    writePolicy,
    reasoningEffort,
  });
  const startedAt = Date.now();
  let timedOut = false;
  let spawnError = null;
  let exitCode = null;
  let signal = null;

  const child = spawn("codex", args, {
    cwd,
    env: childEnvironment(tokenEnvVar, token),
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  const stdout = createRedactingTransform(token);
  const stderr = createRedactingTransform(token);
  const jsonlOutput = openSync(files.jsonlPath, "w", 0o600);
  const stderrOutput = openSync(files.stderrPath, "w", 0o600);
  const jsonlStream = createWriteStream(files.jsonlPath, {
    fd: jsonlOutput,
    autoClose: true,
  });
  const stderrStream = createWriteStream(files.stderrPath, {
    fd: stderrOutput,
    autoClose: true,
  });
  if (child.stdout) child.stdout.pipe(stdout).pipe(jsonlStream);
  else jsonlStream.end();
  if (child.stderr) child.stderr.pipe(stderr).pipe(stderrStream);
  else stderrStream.end();
  const outputFinished = [finished(jsonlStream), finished(stderrStream)];
  let forceKillTimer = null;
  let forceKill = Promise.resolve();
  let cancellationSignal = null;
  let terminationRequested = false;
  const terminate = () => {
    if (terminationRequested) return;
    terminationRequested = true;
    signalProcessGroup(child, "SIGTERM");
    forceKill = new Promise((resolve) => {
      forceKillTimer = setTimeout(() => {
        signalProcessGroup(child, "SIGKILL");
        resolve();
      }, TERMINATION_GRACE_MS);
    });
  };
  const timer = setTimeout(() => {
    timedOut = true;
    terminate();
  }, timeoutMs);
  const cancel = (receivedSignal) => {
    cancellationSignal ??= receivedSignal;
    terminate();
  };
  const onSigint = () => cancel("SIGINT");
  const onSigterm = () => cancel("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  const closed = await new Promise((resolve) => {
    let settled = false;
    const finish = (code, closeSignal) => {
      if (settled) return;
      settled = true;
      resolve([code, closeSignal]);
    };
    child.once("error", (error) => {
      spawnError = redactText(error.message, token);
      if (!jsonlStream.writableEnded) jsonlStream.end();
      if (!stderrStream.writableEnded) stderrStream.end();
      finish(null, null);
    });
    child.once("close", finish);
  });
  clearTimeout(timer);
  if (terminationRequested) await forceKill;
  else clearTimeout(forceKillTimer);
  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);
  [exitCode, signal] = closed;
  await Promise.allSettled(outputFinished);
  sanitizeAnswer(files.answerPath, token);
  const transcript = extractTranscript(readFileSync(files.jsonlPath, "utf8"));
  const summary = {
    id,
    caseId: resolvedCaseId,
    mcpUrl: normalizedUrl,
    fixtureScope,
    writePolicy,
    mode: resolvedMode,
    pluginSkills: pluginSkills
      ? {
          root: pluginSkills.root,
          ids: pluginSkills.ids,
          sha256: pluginSkills.sha256,
        }
      : null,
    model: DEFAULT_MODEL,
    reasoningEffort,
    questionSha256,
    scenarioId: scenario?.id ?? null,
    scenarioSha256: scenario?.sha256 ?? null,
    skillIds: pluginSkills?.ids ?? [],
    skillSha256: pluginSkills?.sha256 ?? null,
    resumedFromThreadId: previousThread,
    process: {
      status: timedOut
        ? "TIMED_OUT"
        : cancellationSignal
          ? "CANCELLED"
          : spawnError
            ? "SPAWN_ERROR"
            : exitCode === 0
              ? "COMPLETED"
              : "PROCESS_FAILED",
      exitCode,
      signal: cancellationSignal ?? signal,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      error: spawnError,
    },
    transcript,
    outputs: files,
  };
  writeFileSync(files.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(files.summaryPath, 0o600);
  return summary;
}

function parseCli(args) {
  const result = {
    writePolicy: "allow-explicit-local-fixture",
  };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") {
      result.help = true;
      continue;
    }
    const key = {
      "--id": "id",
      "--case-id": "caseId",
      "--question": "question",
      "--mcp-url": "mcpUrl",
      "--fixture-scope": "fixtureScope",
      "--write-policy": "writePolicy",
      "--mode": "mode",
      "--token-env": "tokenEnvVar",
      "--previous-id": "previousId",
      "--output-dir": "outputDir",
      "--skill-root": "skillRoot",
      "--skills": "skillIds",
      "--scenario-id": "scenarioId",
      "--reasoning-effort": "reasoningEffort",
      "--timeout-ms": "timeoutMs",
    }[option];
    if (!key || args[index + 1] === undefined)
      throw new Error(`unknown or incomplete option: ${option}`);
    const value = args[index + 1];
    result[key] =
      key === "timeoutMs"
        ? Number(value)
        : key === "skillIds"
          ? value.split(",").map((skillId) => skillId.trim())
          : value;
    index += 1;
  }
  return result;
}

function usage() {
  return [
    "Usage: node scripts/prego-conversation-runner.mjs --id <run-id> --mcp-url <loopback-url> --fixture-scope <scope> (--case-id <case-id> --question <user-question> | --scenario-id <id>) [options]",
    "",
    "Options: --mode raw-mcp|plugin-skill; --skills <comma-separated-workflows>; --scenario-id <id>; --reasoning-effort low|medium|high; --write-policy deny|allow-explicit-local-fixture; --token-env <ENV>; --previous-id <run-id>; --output-dir <private-dir>; --skill-root <skills-dir>; --timeout-ms <ms>",
    "Plugin-skill mode requires --skills unless --scenario-id supplies skillIds. Scenario questions may be overridden with --question.",
    `The bearer is read only from ${DEFAULT_TOKEN_ENV} (or --token-env), never from CLI arguments or files.`,
  ].join("\n");
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const summary = await runConversation(options);
  // A completed process is intentionally not reported as a business PASS.
  process.stdout.write(
    `${JSON.stringify({ id: summary.id, process: summary.process.status, outputs: summary.outputs })}\n`,
  );
  if (summary.process.status === "CANCELLED")
    process.exitCode = summary.process.signal === "SIGINT" ? 130 : 143;
  else if (summary.process.status !== "COMPLETED") process.exitCode = 1;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
