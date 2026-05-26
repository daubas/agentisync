import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { UnsafeOperationError, UsageError } from "./errors.js";
import { fingerprintDirectory } from "./fingerprint.js";
import { git } from "./git.js";
import { resolveProjectPath } from "./paths.js";
import { exists } from "./skills.js";
import type { AgentisyncConfig } from "./types.js";

export interface PullSkillOptions {
  rootDir: string;
  homeDir: string;
  config: AgentisyncConfig;
  name: string;
  force?: boolean;
}

export interface PushSkillOptions {
  rootDir: string;
  homeDir: string;
  config: AgentisyncConfig;
  name: string;
}

export async function pullSkillFromLibrary(options: PullSkillOptions): Promise<void> {
  const library = requireLibrary(options.config);
  const libraryClone = await cloneLibraryRepo(library.url, library.branch);
  try {
    const libraryCanonical = resolveProjectPath(libraryClone, library.canonical ?? options.config.canonical, libraryClone);
    const sourcePath = path.join(libraryCanonical, options.name);
    if (!(await exists(sourcePath))) {
      throw new UsageError(`skill ${options.name} does not exist in library`);
    }

    const localCanonical = resolveProjectPath(options.rootDir, options.config.canonical, options.homeDir);
    const targetPath = path.join(localCanonical, options.name);
    await mkdir(localCanonical, { recursive: true });

    if (await exists(targetPath)) {
      const sourceFingerprint = await fingerprintDirectory(sourcePath);
      const targetFingerprint = await fingerprintDirectory(targetPath);
      if (sourceFingerprint !== targetFingerprint && !options.force) {
        throw new UnsafeOperationError(`local skill ${options.name} differs from library; use --force to overwrite`);
      }
      if (sourceFingerprint === targetFingerprint) {
        return;
      }
      await rm(targetPath, { recursive: true, force: true });
    }

    await cp(sourcePath, targetPath, { recursive: true });
  } finally {
    await rm(libraryClone, { recursive: true, force: true });
  }
}

export async function pushSkillToLibrary(options: PushSkillOptions): Promise<void> {
  const library = requireLibrary(options.config);
  const libraryClone = await cloneLibraryRepo(library.url, library.branch);
  try {
    const libraryCanonical = resolveProjectPath(libraryClone, library.canonical ?? options.config.canonical, libraryClone);
    const sourceCanonical = resolveProjectPath(options.rootDir, options.config.canonical, options.homeDir);
    const sourcePath = path.join(sourceCanonical, options.name);
    if (!(await exists(sourcePath))) {
      throw new UsageError(`skill ${options.name} does not exist in canonical`);
    }

    const targetPath = path.join(libraryCanonical, options.name);
    await mkdir(libraryCanonical, { recursive: true });
    await rm(targetPath, { recursive: true, force: true });
    await cp(sourcePath, targetPath, { recursive: true });

    const relPath = path.relative(libraryClone, targetPath);
    const changed = await hasStagedDiff(libraryClone, relPath);
    if (!changed) {
      return;
    }

    await git(["config", "user.name", "oh-my-skill-hub"], libraryClone);
    await git(["config", "user.email", "oh-my-skill-hub@local"], libraryClone);
    await git(["add", relPath], libraryClone);
    await git(["commit", "-m", `Update ${options.name}`], libraryClone);
    await git(["push", "origin", `HEAD${library.branch ? `:${library.branch}` : ""}`], libraryClone);
  } finally {
    await rm(libraryClone, { recursive: true, force: true });
  }
}

async function cloneLibraryRepo(url: string, branch?: string): Promise<string> {
  const cloneDir = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-library-"));
  const args = ["clone"];
  if (branch) {
    args.push("--branch", branch, "--single-branch");
  }
  args.push(url, cloneDir);
  await git(args, process.cwd());
  return cloneDir;
}

async function hasStagedDiff(rootDir: string, relativePath: string): Promise<boolean> {
  const result = await git(["status", "--porcelain", "--", relativePath], rootDir);
  return result.stdout.trim().length > 0;
}

function requireLibrary(config: AgentisyncConfig): NonNullable<AgentisyncConfig["library"]> {
  if (!config.library) {
    throw new UsageError("library config is required");
  }
  return config.library;
}
