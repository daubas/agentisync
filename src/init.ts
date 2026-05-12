import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UnsafeOperationError } from "./errors.js";
import { exists } from "./skills.js";

export interface InitProjectOptions {
  rootDir: string;
  force?: boolean;
}

const DEFAULT_CONFIG = `version: 1
canonical: .agents/skills
consumers:
  codex:
    path: .agents/skills
  openclaw:
    path: .agents/skills
targets:
  claude:
    path: .claude/skills
    mode: symlink
  opencode:
    path: .opencode/skills
    mode: symlink
`;

export async function initProject(options: InitProjectOptions): Promise<void> {
  const configPath = path.join(options.rootDir, ".agentisync.yaml");
  if ((await exists(configPath)) && !options.force) {
    throw new UnsafeOperationError("config already exists");
  }

  await mkdir(path.join(options.rootDir, ".agents/skills"), { recursive: true });
  await writeFile(configPath, DEFAULT_CONFIG);
}
