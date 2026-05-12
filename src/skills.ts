import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fingerprintDirectory } from "./fingerprint.js";
import { toRelativeDisplay } from "./paths.js";
import type { SkillSource } from "./types.js";

export async function discoverSkills(rootDir: string, skillRoot: string, scope: SkillSource["scope"]): Promise<SkillSource[]> {
  if (!(await exists(skillRoot))) {
    return [];
  }

  const entries = await readdir(skillRoot, { withFileTypes: true });
  const skills: SkillSource[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const absolutePath = path.join(skillRoot, entry.name);
    if (!(await exists(path.join(absolutePath, "SKILL.md")))) {
      continue;
    }
    skills.push({
      name: entry.name,
      absolutePath,
      relativePath: toRelativeDisplay(rootDir, absolutePath),
      fingerprint: await fingerprintDirectory(absolutePath),
      scope
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function exists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}
