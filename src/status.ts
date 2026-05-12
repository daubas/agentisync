import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fingerprintDirectory } from "./fingerprint.js";
import { resolveProjectPath } from "./paths.js";
import { discoverSkills, exists } from "./skills.js";
import type { AgentisyncConfig, StatusConsumer, StatusResult, StatusSkill, StatusSummary, StatusTarget } from "./types.js";

export interface StatusOptions {
  rootDir: string;
  homeDir: string;
  config: AgentisyncConfig;
}

export async function getStatus(options: StatusOptions): Promise<StatusResult> {
  const canonicalRoot = resolveProjectPath(options.rootDir, options.config.canonical, options.homeDir);
  const canonicalSkills = await discoverSkills(options.rootDir, canonicalRoot, "project");
  const consumers = await getConsumers(options, canonicalRoot);
  const targets = await getTargets(options, canonicalSkills);
  const summary = summarize(targets);

  return {
    version: 1,
    canonical: {
      path: options.config.canonical,
      skillCount: canonicalSkills.length
    },
    consumers,
    summary,
    targets
  };
}

async function getConsumers(options: StatusOptions, canonicalRoot: string): Promise<StatusConsumer[]> {
  const consumers: StatusConsumer[] = [];
  for (const [name, consumer] of Object.entries(options.config.consumers)) {
    const absolute = resolveProjectPath(options.rootDir, consumer.path, options.homeDir);
    consumers.push({
      name,
      path: consumer.path,
      state: (await exists(absolute)) ? (path.resolve(absolute) === path.resolve(canonicalRoot) ? "ready" : "mismatch") : "missing"
    });
  }
  return consumers;
}

async function getTargets(options: StatusOptions, canonicalSkills: Awaited<ReturnType<typeof discoverSkills>>): Promise<StatusTarget[]> {
  const targets: StatusTarget[] = [];
  for (const [name, target] of Object.entries(options.config.targets)) {
    const targetRoot = resolveProjectPath(options.rootDir, target.path, options.homeDir);
    if (!(await exists(targetRoot))) {
      targets.push({
        name,
        path: target.path,
        mode: target.mode,
        state: target.optional ? "skipped" : "missing",
        skills: canonicalSkills.map((skill) => ({
          name: skill.name,
          state: target.optional ? "skipped" : "missing",
          canonicalFingerprint: skill.fingerprint
        }))
      });
      continue;
    }

    const skills: StatusSkill[] = [];
    const canonicalNames = new Set(canonicalSkills.map((skill) => skill.name));
    for (const skill of canonicalSkills) {
      skills.push(await inspectTargetSkill(targetRoot, skill));
    }
    for (const targetSkill of await discoverSkills(options.rootDir, targetRoot, "project")) {
      if (!canonicalNames.has(targetSkill.name)) {
        skills.push({
          name: targetSkill.name,
          state: "extra",
          targetFingerprint: targetSkill.fingerprint
        });
      }
    }

    targets.push({
      name,
      path: target.path,
      mode: target.mode,
      state: aggregateTargetState(target.mode, skills),
      skills
    });
  }
  return targets;
}

async function inspectTargetSkill(targetRoot: string, canonical: Awaited<ReturnType<typeof discoverSkills>>[number]): Promise<StatusSkill> {
  const targetPath = path.join(targetRoot, canonical.name);
  const targetStat = await lstatIfPresent(targetPath);
  if (!targetStat) {
    return { name: canonical.name, state: "missing", canonicalFingerprint: canonical.fingerprint };
  }

  if (targetStat.isSymbolicLink()) {
    try {
      const targetRealPath = await realpath(targetPath);
      const canonicalRealPath = await realpath(canonical.absolutePath);
      if (targetRealPath === canonicalRealPath) {
        return { name: canonical.name, state: "clean", canonicalFingerprint: canonical.fingerprint };
      }
    } catch {
      return { name: canonical.name, state: "broken", canonicalFingerprint: canonical.fingerprint };
    }
  }

  const targetFingerprint = await fingerprintDirectory(targetPath);
  return {
    name: canonical.name,
    state: targetFingerprint === canonical.fingerprint ? "clean" : "drifted",
    canonicalFingerprint: canonical.fingerprint,
    targetFingerprint
  };
}

async function lstatIfPresent(targetPath: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(targetPath);
  } catch {
    return null;
  }
}

function aggregateTargetState(mode: StatusTarget["mode"], skills: StatusSkill[]): StatusTarget["state"] {
  if (skills.some((skill) => skill.state === "missing")) {
    return "missing";
  }
  if (skills.some((skill) => skill.state === "drifted" || skill.state === "broken" || skill.state === "extra")) {
    return "drifted";
  }
  return mode === "copy" ? "copied" : "symlinked";
}

function summarize(targets: StatusTarget[]): StatusSummary {
  const summary: StatusSummary = {
    state: "clean",
    clean: 0,
    missing: 0,
    drifted: 0,
    extra: 0,
    broken: 0,
    conflict: 0,
    skipped: 0
  };

  for (const target of targets) {
    for (const skill of target.skills) {
      summary[skill.state] += 1;
    }
  }

  summary.state =
    summary.missing > 0 || summary.drifted > 0 || summary.extra > 0 || summary.broken > 0 || summary.conflict > 0 ? "drifted" : "clean";
  return summary;
}
