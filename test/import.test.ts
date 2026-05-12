import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importSkills } from "../src/importer.js";

async function writeSkill(root: string, relativeDir: string, body: string): Promise<void> {
  const dir = path.join(root, relativeDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body);
}

describe("importSkills", () => {
  it("imports an importable skill into canonical", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-import-"));
    await writeSkill(root, ".claude/skills/build-docs", "from claude\n");

    const result = await importSkills({ rootDir: root, homeDir: root, canonical: ".agents/skills" });

    expect(result.imported).toEqual(["build-docs"]);
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).resolves.toBe("from claude\n");
  });

  it("does not write when conflicts exist", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-import-"));
    await writeSkill(root, ".claude/skills/build-docs", "claude\n");
    await writeSkill(root, ".opencode/skills/build-docs", "opencode\n");

    await expect(importSkills({ rootDir: root, homeDir: root, canonical: ".agents/skills" })).rejects.toThrow(
      "cannot import with unresolved conflicts"
    );
    await expect(readFile(path.join(root, ".agents/skills/build-docs/SKILL.md"), "utf8")).rejects.toThrow();
  });
});
