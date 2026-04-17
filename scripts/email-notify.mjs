#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, "..");
const configPath = path.join(pluginRoot, "config.local.json");
const args = new Set(process.argv.slice(2));

async function main() {
  const payload = await readJsonStdin();
  const mergedConfig = await loadConfig();
  const context = buildContext(payload);
  const shouldContinueJson = context.isStopHook;

  try {
    if (!shouldSend(context)) {
      return exitGracefully(shouldContinueJson);
    }

    if (!(await claimNotification(context, mergedConfig.stateDir))) {
      return exitGracefully(shouldContinueJson);
    }

    const mail = buildMail(context, mergedConfig);
    if (!mail) {
      log("Missing recipient or SMTP settings; skipping email.");
      return exitGracefully(shouldContinueJson);
    }

    if (mergedConfig.dryRun) {
      log(`Dry run email preview:\n${JSON.stringify(mail, null, 2)}`);
      return exitGracefully(shouldContinueJson);
    }

    const transporter = nodemailer.createTransport({
      host: mergedConfig.smtp.host,
      port: mergedConfig.smtp.port,
      secure: mergedConfig.smtp.secure,
      auth:
        mergedConfig.smtp.user || mergedConfig.smtp.pass
          ? {
              user: mergedConfig.smtp.user,
              pass: mergedConfig.smtp.pass
            }
          : undefined
    });

    await transporter.sendMail(mail);
    log(`Sent Codex completion email for ${context.turnId ?? context.eventName}.`);
  } catch (error) {
    log(`Email notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return exitGracefully(shouldContinueJson);
}

async function readJsonStdin() {
  if (process.stdin.isTTY) {
    return {};
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    log(`Could not parse JSON payload; ignoring input. ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

async function loadConfig() {
  const fileConfig = await readConfigFile(configPath);
  const smtp = {
    host: readString("CODEX_EMAIL_NOTIFY_SMTP_HOST") ?? fileConfig.smtp?.host ?? "",
    port: Number(readString("CODEX_EMAIL_NOTIFY_SMTP_PORT") ?? fileConfig.smtp?.port ?? 587),
    secure: readBoolean("CODEX_EMAIL_NOTIFY_SMTP_SECURE", fileConfig.smtp?.secure ?? false),
    user: readString("CODEX_EMAIL_NOTIFY_SMTP_USER") ?? fileConfig.smtp?.user ?? "",
    pass: readString("CODEX_EMAIL_NOTIFY_SMTP_PASS") ?? fileConfig.smtp?.pass ?? ""
  };

  return {
    to: normalizeRecipients(readString("CODEX_EMAIL_NOTIFY_TO") ?? fileConfig.to ?? []),
    from:
      readString("CODEX_EMAIL_NOTIFY_FROM") ??
      fileConfig.from ??
      smtp.user ??
      "",
    subjectPrefix:
      readString("CODEX_EMAIL_NOTIFY_SUBJECT_PREFIX") ??
      fileConfig.subjectPrefix ??
      "[Codex]",
    dryRun: args.has("--dry-run") || readBoolean("CODEX_EMAIL_NOTIFY_DRY_RUN", false),
    stateDir:
      readString("CODEX_EMAIL_NOTIFY_STATE_DIR") ??
      fileConfig.stateDir ??
      path.join(os.tmpdir(), "codex-email-notify"),
    smtp
  };
}

async function readConfigFile(targetPath) {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    log(`Could not read ${targetPath}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function buildContext(payload) {
  return {
    payload,
    isStopHook: pick(payload, "hook_event_name", "hook-event-name", "hookEventName") === "Stop",
    stopHookActive: Boolean(pick(payload, "stop_hook_active", "stop-hook-active", "stopHookActive")),
    eventName:
      pick(payload, "event", "type", "notification_type", "notification-type", "notificationType") ??
      pick(payload, "hook_event_name", "hook-event-name", "hookEventName") ??
      "unknown",
    sessionId: pick(payload, "session_id", "session-id", "sessionId") ?? "unknown-session",
    turnId: pick(payload, "turn_id", "turn-id", "turnId") ?? null,
    cwd: pick(payload, "cwd") ?? process.cwd(),
    model: pick(payload, "model") ?? "unknown-model",
    lastAssistantMessage: extractMessage(
      pick(payload, "last_assistant_message", "last-assistant-message", "lastAssistantMessage")
    ),
    promptSummary: summarizePrompt(payload)
  };
}

function shouldSend(context) {
  if (context.isStopHook) {
    return !context.stopHookActive;
  }

  const normalized = String(context.eventName).toLowerCase();
  if (normalized === "agent-turn-complete" || normalized === "after_agent" || normalized === "after-agent") {
    return true;
  }

  return Boolean(context.lastAssistantMessage || context.promptSummary);
}

async function claimNotification(context, stateDir) {
  const key = sanitize([context.sessionId, context.turnId ?? context.eventName].join("__"));
  const targetPath = path.join(stateDir, `${key}.stamp`);

  try {
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(targetPath, new Date().toISOString(), { flag: "wx" });
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

function buildMail(context, config) {
  if (!config.to.length) {
    return null;
  }

  if (!config.dryRun && !config.smtp.host) {
    return null;
  }

  const workspace = path.basename(context.cwd || "workspace");
  const prompt = clip(context.promptSummary || "No prompt summary available.", 1200);
  const assistant = clip(context.lastAssistantMessage || "No assistant summary available.", 4000);
  const subject = clip(
    `${config.subjectPrefix} ${workspace}: task complete${context.promptSummary ? ` - ${clip(context.promptSummary, 60)}` : ""}`,
    160
  );

  const lines = [
    "Codex task completed.",
    "",
    `Event: ${context.eventName}`,
    `Session ID: ${context.sessionId}`,
    `Turn ID: ${context.turnId ?? "n/a"}`,
    `Model: ${context.model}`,
    `Working directory: ${context.cwd}`,
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "Prompt summary:",
    prompt,
    "",
    "Assistant message:",
    assistant
  ];

  return {
    from: config.from || config.smtp.user || "codex-notify@localhost",
    to: config.to.join(", "),
    subject,
    text: lines.join("\n")
  };
}

function summarizePrompt(payload) {
  const prompt = pick(payload, "prompt");
  if (typeof prompt === "string" && prompt.trim()) {
    return prompt.trim();
  }

  const inputMessages = pick(payload, "input_messages", "input-messages", "inputMessages", "messages");
  if (!Array.isArray(inputMessages)) {
    return "";
  }

  const textParts = [];
  for (const message of inputMessages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    if ("role" in message && message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      textParts.push(message.content.trim());
      continue;
    }

    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        const value = extractMessage(part);
        if (value) {
          textParts.push(value);
        }
      }
    }
  }

  return textParts.join("\n").trim();
}

function extractMessage(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text.trim();
  }

  if (typeof value.content === "string") {
    return value.content.trim();
  }

  if (Array.isArray(value.content)) {
    return value.content
      .map((part) => extractMessage(part))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function pick(object, ...keys) {
  for (const key of keys) {
    if (object && Object.prototype.hasOwnProperty.call(object, key) && object[key] != null) {
      return object[key];
    }
  }
  return undefined;
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function readString(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return Boolean(fallback);
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function sanitize(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function clip(value, limit) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function log(message) {
  process.stderr.write(`[codex-email-notify] ${message}\n`);
}

function exitGracefully(isStopHook) {
  if (isStopHook) {
    process.stdout.write('{"continue":true}\n');
  }
}

await main();
