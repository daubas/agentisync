export type SyncMode = "symlink" | "copy";

export interface ConsumerConfig {
  path: string;
}

export interface TargetConfig {
  path: string;
  mode: SyncMode;
  optional?: boolean;
}

export interface LibraryConfig {
  url: string;
  branch?: string;
  canonical?: string;
}

export interface AgentisyncConfig {
  version: 1;
  canonical: string;
  consumers: Record<string, ConsumerConfig>;
  targets: Record<string, TargetConfig>;
  library?: LibraryConfig;
}

export type SkillState = "clean" | "missing" | "drifted" | "extra" | "broken" | "skipped" | "conflict";
export type ConsumerState = "ready" | "missing" | "mismatch";
export type TargetState = "symlinked" | "copied" | "unmanaged" | "missing" | "skipped" | "drifted";

export interface SkillSource {
  name: string;
  absolutePath: string;
  relativePath: string;
  fingerprint: string;
  scope: "project" | "personal" | "imported";
}

export interface ScanSkill {
  name: string;
  state: "canonical" | "importable" | "duplicate" | "conflicting";
  canonical?: SkillSource;
  sources: SkillSource[];
}

export interface ScanResult {
  skills: Map<string, ScanSkill>;
  conflicts: ScanSkill[];
}

export interface StatusSkill {
  name: string;
  state: SkillState;
  canonicalFingerprint?: string;
  targetFingerprint?: string;
}

export interface StatusConsumer {
  name: string;
  path: string;
  state: ConsumerState;
}

export interface StatusTarget {
  name: string;
  path: string;
  mode: SyncMode;
  state: TargetState;
  skills: StatusSkill[];
}

export interface StatusSummary {
  state: "clean" | "drifted";
  clean: number;
  missing: number;
  drifted: number;
  extra: number;
  broken: number;
  conflict: number;
  skipped: number;
}

export interface StatusResult {
  version: 1;
  canonical: {
    path: string;
    skillCount: number;
  };
  consumers: StatusConsumer[];
  summary: StatusSummary;
  targets: StatusTarget[];
}

export type SyncActionKind = "create" | "replace";
export type SyncBlockReason = "conflicting-target" | "unsupported-target";

export interface SyncPlanAction {
  kind: SyncActionKind;
  targetName: string;
  skillName: string;
  mode: SyncMode;
  sourcePath: string;
  targetPath: string;
}

export interface SyncPlanBlock {
  reason: SyncBlockReason;
  targetName: string;
  skillName: string;
  sourcePath: string;
  targetPath: string;
}

export interface SyncPlan {
  actions: SyncPlanAction[];
  blocked: SyncPlanBlock[];
}
