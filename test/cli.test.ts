import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const CLI = path.resolve("src/cli.ts");
const TSX_LOADER = path.resolve("node_modules/tsx/dist/loader.mjs");
const execFileAsync = promisify(execFile);

async function runCli(args: string[], cwd: string, reject = true): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const homeDir = path.join(cwd, "home");
  try {
    const result = await execFileAsync(process.execPath, ["--import", TSX_LOADER, CLI, ...args], {
      cwd,
      env: {
        ...process.env,
        HOME: homeDir
      }
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string; code?: number };
    if (reject) {
      throw error;
    }
    return { stdout: execError.stdout ?? "", stderr: execError.stderr ?? "", exitCode: execError.code ?? 1 };
  }
}

async function runGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function seedLibraryRepo(content: string): Promise<string> {
  const library = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-library-"));
  const workParent = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-seed-"));
  const work = path.join(workParent, "repo");

  await runGit(["init", "--bare", library], workParent);
  await runGit(["clone", library, work], workParent);
  await runGit(["checkout", "-b", "main"], work);
  await runGit(["config", "user.name", "oh-my-skill-hub"], work);
  await runGit(["config", "user.email", "oh-my-skill-hub@local"], work);
  await mkdir(path.join(work, ".agents/skills/build-docs"), { recursive: true });
  await writeFile(path.join(work, ".agents/skills/build-docs/SKILL.md"), content);
  await runGit(["add", "."], work);
  await runGit(["commit", "-m", "seed skills library"], work);
  await runGit(["push", "-u", "origin", "main"], work);

  return library;
}

describe("cli", () => {
  it("prints help without requiring a project config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));

    const result = await runCli(["--help"], root);

    expect(result.stdout).toContain("Usage: myskillhub <command>");
    expect(result.stdout).toContain("myskillhub init");
    expect(result.stdout).toContain("myskillhub sync --dry-run");
  });

  it("prints version without requiring a project config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));

    const result = await runCli(["--version"], root);

    expect(result.stdout.trim()).toBe("0.1.0");
  });

  it("runs init, add, status, and sync dry-run", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));

    await runCli(["init"], root);
    await runCli(["add", "build-docs"], root);
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toContain("name: build-docs");

    const status = await runCli(["status"], root, false);
    expect(status.exitCode).toBe(1);
    expect(status.stdout).toContain("drifted");

    const sync = await runCli(["sync", "--dry-run"], root);
    expect(sync.stdout).toContain("create claude/build-docs");
  });

  it("initializes a library-backed config from the cli", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));

    await runCli(["init", "--library", "git@github-daubas:daubas/skills.git", "--branch", "main"], root);

    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain("library:");
    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain('url: "git@github-daubas:daubas/skills.git"');
    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain('branch: "main"');
  });

  it("imports existing skills", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));
    await mkdir(path.join(root, ".claude/skills/build-docs"), { recursive: true });
    await writeFile(path.join(root, ".claude/skills/build-docs/SKILL.md"), "from claude\n");

    await runCli(["init"], root);
    const result = await runCli(["import"], root);

    expect(result.stdout).toContain("imported 1 skills");
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toBe("from claude\n");
  });

  it("returns exit code 3 for unsafe import conflicts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));
    await mkdir(path.join(root, ".claude/skills/build-docs"), { recursive: true });
    await mkdir(path.join(root, ".opencode/skills/build-docs"), { recursive: true });
    await writeFile(path.join(root, ".claude/skills/build-docs/SKILL.md"), "from claude\n");
    await writeFile(path.join(root, ".opencode/skills/build-docs/SKILL.md"), "from opencode\n");

    await runCli(["init"], root);
    const result = await runCli(["import"], root, false);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("cannot import with unresolved conflicts");
  });

  it("pulls a single skill from a git library", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));
    const library = await seedLibraryRepo("from library\n");

    await runCli(["init"], root);
    await writeFile(
      path.join(root, ".agentisync.yaml"),
      [
        "version: 1",
        "canonical: .agents/skills",
        "library:",
        `  url: ${library}`,
        ""
      ].join("\n")
    );

    const result = await runCli(["pull", "build-docs"], root);

    expect(result.stdout).toContain("pulled build-docs");
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toBe("from library\n");
  });

  it("pushes a single skill back to the git library", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "oh-my-skill-hub-cli-"));
    const library = await seedLibraryRepo("from library\n");

    await runCli(["init"], root);
    await writeFile(
      path.join(root, ".agentisync.yaml"),
      [
        "version: 1",
        "canonical: .agents/skills",
        "library:",
        `  url: ${library}`,
        ""
      ].join("\n")
    );

    await mkdir(path.join(root, ".agents/skills/build-docs"), { recursive: true });
    await writeFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "updated locally\n");

    const result = await runCli(["push", "build-docs"], root);

    expect(result.stdout).toContain("pushed build-docs");
    const remoteRead = await execFileAsync("git", ["--git-dir", library, "show", "main:.agents/skills/build-docs/SKILL.md"]);
    expect(remoteRead.stdout).toBe("updated locally\n");
  });
});
