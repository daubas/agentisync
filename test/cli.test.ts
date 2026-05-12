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
  try {
    const result = await execFileAsync(process.execPath, ["--import", TSX_LOADER, CLI, ...args], { cwd });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string; code?: number };
    if (reject) {
      throw error;
    }
    return { stdout: execError.stdout ?? "", stderr: execError.stderr ?? "", exitCode: execError.code ?? 1 };
  }
}

describe("cli", () => {
  it("runs init, add, status, and sync dry-run", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-cli-"));

    await runCli(["init"], root);
    await runCli(["add", "build-docs"], root);
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toContain("name: build-docs");

    const status = await runCli(["status"], root, false);
    expect(status.exitCode).toBe(1);
    expect(status.stdout).toContain("drifted");

    const sync = await runCli(["sync", "--dry-run"], root);
    expect(sync.stdout).toContain("create claude/build-docs");
  });

  it("imports existing skills", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-cli-"));
    await mkdir(path.join(root, ".claude/skills/build-docs"), { recursive: true });
    await writeFile(path.join(root, ".claude/skills/build-docs/SKILL.md"), "from claude\n");

    await runCli(["init"], root);
    const result = await runCli(["import"], root);

    expect(result.stdout).toContain("imported 1 skills");
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toBe("from claude\n");
  });

  it("returns exit code 3 for unsafe import conflicts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-cli-"));
    await mkdir(path.join(root, ".claude/skills/build-docs"), { recursive: true });
    await mkdir(path.join(root, ".opencode/skills/build-docs"), { recursive: true });
    await writeFile(path.join(root, ".claude/skills/build-docs/SKILL.md"), "from claude\n");
    await writeFile(path.join(root, ".opencode/skills/build-docs/SKILL.md"), "from opencode\n");

    await runCli(["init"], root);
    const result = await runCli(["import"], root, false);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("cannot import with unresolved conflicts");
  });
});
