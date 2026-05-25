import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { UsageError } from "./errors.js";
import { normalizePath } from "./paths.js";
import type { AgentisyncConfig, LibraryConfig, SyncMode } from "./types.js";

interface RawConfig {
  version?: unknown;
  canonical?: unknown;
  consumers?: unknown;
  targets?: unknown;
  library?: unknown;
}

export async function loadConfig(rootDir: string): Promise<AgentisyncConfig> {
  const configPath = path.join(rootDir, ".agentisync.yaml");
  const raw = parse(await readFile(configPath, "utf8")) as RawConfig;
  return parseConfig(raw);
}

export function parseConfig(raw: RawConfig): AgentisyncConfig {
  if (raw.version !== 1) {
    throw new UsageError("config version must be 1");
  }
  if (typeof raw.canonical !== "string" || raw.canonical.length === 0) {
    throw new UsageError("canonical path is required");
  }

  const consumers = parseConsumers(raw.consumers);
  const targets = parseTargets(raw.targets);
  const library = parseLibrary(raw.library);
  const canonical = normalizePath(raw.canonical);

  for (const target of Object.values(targets)) {
    if (normalizePath(target.path) === canonical) {
      throw new UsageError("canonical path cannot also be a target");
    }
  }

  return {
    version: 1,
    canonical,
    consumers,
    targets,
    library
  };
}

function parseConsumers(value: unknown): AgentisyncConfig["consumers"] {
  if (value == null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new UsageError("consumers must be a map");
  }

  const consumers: AgentisyncConfig["consumers"] = {};
  for (const [name, item] of Object.entries(value)) {
    if (!isRecord(item) || typeof item.path !== "string") {
      throw new UsageError(`consumer ${name} must define path`);
    }
    consumers[name] = { path: normalizePath(item.path) };
  }
  return consumers;
}

function parseTargets(value: unknown): AgentisyncConfig["targets"] {
  if (value == null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new UsageError("targets must be a map");
  }

  const targets: AgentisyncConfig["targets"] = {};
  for (const [name, item] of Object.entries(value)) {
    if (!isRecord(item) || typeof item.path !== "string") {
      throw new UsageError(`target ${name} must define path`);
    }
    if (!isSyncMode(item.mode)) {
      throw new UsageError(`target ${name} mode must be symlink or copy`);
    }
    targets[name] = {
      path: normalizePath(item.path),
      mode: item.mode,
      optional: typeof item.optional === "boolean" ? item.optional : undefined
    };
  }
  return targets;
}

function parseLibrary(value: unknown): LibraryConfig | undefined {
  if (value == null) {
    return undefined;
  }
  if (!isRecord(value) || typeof value.url !== "string" || value.url.length === 0) {
    throw new UsageError("library must define url");
  }
  return {
    url: value.url,
    branch: typeof value.branch === "string" && value.branch.length > 0 ? value.branch : undefined,
    canonical: typeof value.canonical === "string" && value.canonical.length > 0 ? normalizePath(value.canonical) : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSyncMode(value: unknown): value is SyncMode {
  return value === "symlink" || value === "copy";
}
