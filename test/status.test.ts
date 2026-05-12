import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getStatus } from "../src/status.js";
import type { AgentisyncConfig } from "../src/types.js";

async function writeSkill(root: string, relativeDir: string, body: string): Promise<void> {
  const dir = path.join(root, relativeDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body);
}

describe("getStatus", () => {
  it("reports clean symlinked targets and ready consumers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-status-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await mkdir(path.join(root, ".claude/skills"), { recursive: true });
    await symlink(
      path.join(root, ".agents/skills/build-docs"),
      path.join(root, ".claude/skills/build-docs")
    );
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: { codex: { path: ".agents/skills" } },
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const status = await getStatus({ rootDir: root, homeDir: root, config });

    expect(status.summary.state).toBe("clean");
    expect(status.consumers[0]?.state).toBe("ready");
    expect(status.targets[0]?.skills[0]?.state).toBe("clean");
  });

  it("reports missing target skills as drift", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-status-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const status = await getStatus({ rootDir: root, homeDir: root, config });

    expect(status.summary.state).toBe("drifted");
    expect(status.targets[0]?.state).toBe("missing");
    expect(status.targets[0]?.skills[0]?.state).toBe("missing");
  });

  it("reports target-only skills as extra", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-status-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await mkdir(path.join(root, ".claude/skills"), { recursive: true });
    await symlink(
      path.join(root, ".agents/skills/build-docs"),
      path.join(root, ".claude/skills/build-docs")
    );
    await writeSkill(root, ".claude/skills/legacy", "legacy\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const status = await getStatus({ rootDir: root, homeDir: root, config });

    expect(status.summary.state).toBe("drifted");
    expect(status.summary.extra).toBe(1);
    expect(status.targets[0]?.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "legacy",
          state: "extra"
        })
      ])
    );
  });

  it("reports broken target symlinks", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-status-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await mkdir(path.join(root, ".claude/skills"), { recursive: true });
    await symlink(path.join(root, ".missing/build-docs"), path.join(root, ".claude/skills/build-docs"));
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const status = await getStatus({ rootDir: root, homeDir: root, config });

    expect(status.summary.state).toBe("drifted");
    expect(status.summary.broken).toBe(1);
    expect(status.targets[0]?.skills[0]?.state).toBe("broken");
  });
});
