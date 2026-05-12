import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addSkill } from "../src/add.js";
import type { AgentisyncConfig } from "../src/types.js";

describe("addSkill", () => {
  it("creates a canonical SKILL.md", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-add-"));
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: {}
    };

    await addSkill({ rootDir: root, homeDir: root, config, name: "build-docs" });

    const skill = await readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8");
    expect(skill).toContain("name: build-docs");
    expect(skill).toContain("# build-docs");
  });

  it("fails when the skill already exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-add-"));
    const config: AgentisyncConfig = {
      version: 1,
      canonical: ".agents/skills",
      consumers: {},
      targets: {}
    };

    await addSkill({ rootDir: root, homeDir: root, config, name: "build-docs" });

    await expect(addSkill({ rootDir: root, homeDir: root, config, name: "build-docs" })).rejects.toThrow("skill already exists");
  });
});
