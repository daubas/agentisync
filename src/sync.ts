import { cp, mkdir, rm, symlink } from "node:fs/promises";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { UnsafeOperationError } from "./errors.js";
import { fingerprintDirectory } from "./fingerprint.js";
import { resolveProjectPath } from "./paths.js";
import { discoverSkills, exists } from "./skills.js";
import type { AgentisyncConfig, SkillSource, SyncPlan } from "./types.js";

export interface SyncPlanOptions {
  rootDir: string;
  homeDir: string;
  config: AgentisyncConfig;
  force?: boolean;
}

export async function createSyncPlan(options: SyncPlanOptions): Promise<SyncPlan> {
  const canonicalRoot = resolveProjectPath(options.rootDir, options.config.canonical, options.homeDir);
  const canonicalSkills = await discoverSkills(options.rootDir, canonicalRoot, "project");
  const plan: SyncPlan = { actions: [], blocked: [] };

  for (const [targetName, target] of Object.entries(options.config.targets)) {
    const targetRoot = resolveProjectPath(options.rootDir, target.path, options.homeDir);
    for (const skill of canonicalSkills) {
      const targetPath = path.join(targetRoot, skill.name);
      if (!(await hasPathEntry(targetPath))) {
        plan.actions.push({
          kind: "create",
          targetName,
          skillName: skill.name,
          mode: target.mode,
          sourcePath: skill.absolutePath,
          targetPath
        });
        continue;
      }

      if (await targetMatchesCanonical(targetPath, skill)) {
        continue;
      }

      if (options.force) {
        plan.actions.push({
          kind: "replace",
          targetName,
          skillName: skill.name,
          mode: target.mode,
          sourcePath: skill.absolutePath,
          targetPath
        });
        continue;
      }

      plan.blocked.push({
        reason: "conflicting-target",
        targetName,
        skillName: skill.name,
        sourcePath: skill.absolutePath,
        targetPath
      });
    }
  }

  return plan;
}

export async function applySyncPlan(plan: SyncPlan): Promise<void> {
  if (plan.blocked.length > 0) {
    throw new UnsafeOperationError("sync plan has blocked actions");
  }

  for (const action of plan.actions) {
    if (action.kind === "replace") {
      await rm(action.targetPath, { recursive: true, force: true });
    }

    await mkdir(path.dirname(action.targetPath), { recursive: true });
    if (action.mode === "symlink") {
      await symlink(action.sourcePath, action.targetPath, "dir");
    } else {
      await cp(action.sourcePath, action.targetPath, { recursive: true });
    }
  }
}

async function targetMatchesCanonical(targetPath: string, skill: SkillSource): Promise<boolean> {
  try {
    return (await fingerprintDirectory(targetPath)) === skill.fingerprint;
  } catch {
    return false;
  }
}

async function hasPathEntry(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}
