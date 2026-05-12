import { lstat, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applySyncPlan, createSyncPlan } from "../src/sync.js";
import type { AgentisyncConfig } from "../src/types.js";

async function writeSkill(root: string, relativeDir: string, body: string): Promise<void> {
  const dir = path.join(root, relativeDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body);
}

describe("createSyncPlan", () => {
  it("plans creates for missing target skills without writing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config });

    expect(plan.blocked).toHaveLength(0);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: "create",
        targetName: "claude",
        skillName: "build-docs",
        mode: "symlink"
      })
    ]);
  });

  it("blocks conflicting target directories unless forced", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await writeSkill(root, ".claude/skills/build-docs", "different\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config });

    expect(plan.actions).toHaveLength(0);
    expect(plan.blocked).toEqual([
      expect.objectContaining({
        reason: "conflicting-target",
        targetName: "claude",
        skillName: "build-docs"
      })
    ]);
  });

  it("plans replaces for conflicting target directories when forced", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await writeSkill(root, ".claude/skills/build-docs", "different\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "copy" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config, force: true });

    expect(plan.blocked).toHaveLength(0);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: "replace",
        targetName: "claude",
        skillName: "build-docs",
        mode: "copy"
      })
    ]);
  });

  it("applies create actions as symlinks", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config });
    await applySyncPlan(plan);

    const target = path.join(root, ".claude/skills/build-docs");
    await expect(lstat(target).then((stat) => stat.isSymbolicLink())).resolves.toBe(true);
    await expect(realpath(target)).resolves.toBe(await realpath(path.join(root, ".agents/skills/build-docs")));
  });

  it("applies create actions as copies", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "copy" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config });
    await applySyncPlan(plan);

    await expect(readFile(path.join(root, ".claude/skills/build-docs/SKILL.md"), "utf8")).resolves.toBe("canonical\n");
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toBe("canonical\n");
  });

  it("refuses to apply blocked plans", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await writeSkill(root, ".claude/skills/build-docs", "different\n");
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "copy" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config });

    await expect(applySyncPlan(plan)).rejects.toThrow("sync plan has blocked actions");
  });

  it("blocks broken symlink target entries unless forced", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-sync-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await mkdir(path.join(root, ".claude/skills"), { recursive: true });
    await symlink(path.join(root, ".missing/build-docs"), path.join(root, ".claude/skills/build-docs"));
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: { claude: { path: ".claude/skills", mode: "symlink" } }
    };

    const plan = await createSyncPlan({ rootDir: root, homeDir: root, config });

    expect(plan.actions).toHaveLength(0);
    expect(plan.blocked).toEqual([
      expect.objectContaining({
        reason: "conflicting-target",
        targetName: "claude",
        skillName: "build-docs"
      })
    ]);
  });
});
