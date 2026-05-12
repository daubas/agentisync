import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { UnsafeOperationError } from "./errors.js";
import { resolveProjectPath } from "./paths.js";
import { scanWorkspace } from "./scan.js";

export interface ImportSkillsOptions {
  rootDir: string;
  homeDir: string;
  canonical: string;
}

export interface ImportSkillsResult {
  imported: string[];
  unchanged: string[];
}

export async function importSkills(options: ImportSkillsOptions): Promise<ImportSkillsResult> {
  const scan = await scanWorkspace(options);
  if (scan.conflicts.length > 0) {
    throw new UnsafeOperationError("cannot import with unresolved conflicts");
  }

  const canonicalRoot = resolveProjectPath(options.rootDir, options.canonical, options.homeDir);
  await mkdir(canonicalRoot, { recursive: true });

  const imported: string[] = [];
  const unchanged: string[] = [];
  for (const skill of scan.skills.values()) {
    if (skill.canonical) {
      unchanged.push(skill.name);
      continue;
    }
    const source = skill.sources[0];
    if (!source) {
      continue;
    }
    await cp(source.absolutePath, path.join(canonicalRoot, skill.name), { recursive: true });
    imported.push(skill.name);
  }

  return { imported, unchanged };
}
