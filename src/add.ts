import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UnsafeOperationError, UsageError } from "./errors.js";
import { resolveProjectPath } from "./paths.js";
import { exists } from "./skills.js";
import type { AgentisyncConfig } from "./types.js";

export interface AddSkillOptions {
  rootDir: string;
  homeDir: string;
  config: AgentisyncConfig;
  name: string;
}

export async function addSkill(options: AddSkillOptions): Promise<void> {
  validateSkillName(options.name);
  const canonicalRoot = resolveProjectPath(options.rootDir, options.config.canonical, options.homeDir);
  const skillDir = path.join(canonicalRoot, options.name);
  if (await exists(skillDir)) {
    throw new UnsafeOperationError("skill already exists");
  }

  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), scaffoldSkill(options.name));
}

function validateSkillName(name: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new UsageError("skill name must use lowercase letters, numbers, and hyphens");
  }
}

function scaffoldSkill(name: string): string {
  return `---
name: ${name}
description: Describe when this skill should be used.
---

# ${name}

Describe the workflow, references, or instructions for this skill.
`;
}
