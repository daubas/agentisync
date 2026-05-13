import path from "node:path";
import { resolveProjectPath } from "./paths.js";
import { discoverSkills, exists } from "./skills.js";
import type { ScanResult, ScanSkill, SkillSource } from "./types.js";

const PROJECT_SCAN_PATHS = [".github/skills", ".claude/skills", ".agents/skills", ".opencode/skills"];
const HOME_SCAN_PATHS = [
  "~/.agentisync/skills",
  "~/.agents/skills",
  "~/.claude/skills",
  "~/.copilot/skills",
  "~/.hermes/skills"
];

export interface ScanWorkspaceOptions {
  rootDir: string;
  homeDir: string;
  canonical: string;
}

export async function scanWorkspace(options: ScanWorkspaceOptions): Promise<ScanResult> {
  const canonicalRoot = resolveProjectPath(options.rootDir, options.canonical, options.homeDir);
  const canonicalSkills = await discoverSkills(options.rootDir, canonicalRoot, "project");
  const skills = new Map<string, ScanSkill>();

  for (const skill of canonicalSkills) {
    skills.set(skill.name, {
      name: skill.name,
      state: "canonical",
      canonical: skill,
      sources: []
    });
  }

  for (const source of await discoverImportSources(options, canonicalRoot)) {
    const existing = skills.get(source.name);
    if (!existing) {
      skills.set(source.name, {
        name: source.name,
        state: "importable",
        sources: [source]
      });
      continue;
    }

    existing.sources.push(source);
    if (existing.canonical) {
      if (existing.canonical.fingerprint !== source.fingerprint) {
        existing.state = "conflicting";
      } else if (existing.state !== "conflicting") {
        existing.state = "duplicate";
      }
      continue;
    }

    const firstFingerprint = existing.sources[0]?.fingerprint;
    if (firstFingerprint !== source.fingerprint) {
      existing.state = "conflicting";
    } else if (existing.state !== "conflicting") {
      existing.state = "duplicate";
    }
  }

  const conflicts = [...skills.values()].filter((skill) => skill.state === "conflicting");
  return { skills, conflicts };
}

async function discoverImportSources(options: ScanWorkspaceOptions, canonicalRoot: string): Promise<SkillSource[]> {
  const sources: SkillSource[] = [];
  const seen = new Set<string>();

  for (const relativePath of PROJECT_SCAN_PATHS) {
    const absolute = path.join(options.rootDir, relativePath);
    if (path.resolve(absolute) === path.resolve(canonicalRoot)) {
      continue;
    }
    sources.push(...dedupeSources(await discoverSkills(options.rootDir, absolute, "project"), seen));
  }

  for (const homePath of HOME_SCAN_PATHS) {
    const absolute = resolveProjectPath(options.rootDir, homePath, options.homeDir);
    if (path.resolve(absolute) === path.resolve(canonicalRoot) || !(await exists(absolute))) {
      continue;
    }
    sources.push(...dedupeSources(await discoverSkills(options.rootDir, absolute, "personal"), seen));
  }

  return sources;
}

function dedupeSources(sources: SkillSource[], seen: Set<string>): SkillSource[] {
  const deduped: SkillSource[] = [];
  for (const source of sources) {
    const key = path.resolve(source.absolutePath);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(source);
  }
  return deduped;
}
