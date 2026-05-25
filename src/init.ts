import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UnsafeOperationError } from "./errors.js";
import { exists } from "./skills.js";
import type { LibraryConfig } from "./types.js";

export interface InitProjectOptions {
  rootDir: string;
  force?: boolean;
  library?: LibraryConfig;
}

export async function initProject(options: InitProjectOptions): Promise<void> {
  const configPath = path.join(options.rootDir, ".agentisync.yaml");
  if ((await exists(configPath)) && !options.force) {
    throw new UnsafeOperationError("config already exists");
  }

  await mkdir(path.join(options.rootDir, ".agents/skills"), { recursive: true });
  await writeFile(configPath, buildConfig(options.library));
}

function buildConfig(library?: LibraryConfig): string {
  const lines = [
    "version: 1",
    "canonical: .agents/skills",
    "consumers:",
    "  codex:",
    "    path: .agents/skills",
    "  openclaw:",
    "    path: .agents/skills",
    "targets:",
    "  claude:",
    "    path: .claude/skills",
    "    mode: symlink",
    "  opencode:",
    "    path: .opencode/skills",
    "    mode: symlink"
  ];

  if (library) {
    lines.push("library:", `  url: ${quoteYaml(library.url)}`);
    if (library.branch) {
      lines.push(`  branch: ${quoteYaml(library.branch)}`);
    }
    if (library.canonical) {
      lines.push(`  canonical: ${quoteYaml(library.canonical)}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}
