import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanWorkspace } from "../src/scan.js";

async function writeSkill(root: string, relativeDir: string, body: string): Promise<void> {
  const dir = path.join(root, relativeDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body);
}

describe("scanWorkspace", () => {
  it("treats configured canonical as canonical, not an import source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-scan-"));
    await writeSkill(root, ".agents/skills/build-docs", "same\n");
    await writeSkill(root, ".claude/skills/build-docs", "same\n");

    const result = await scanWorkspace({
      rootDir: root,
      homeDir: root,
      canonical: ".agents/skills"
    });

    expect(result.skills.get("build-docs")?.state).toBe("duplicate");
    expect(result.skills.get("build-docs")?.canonical?.relativePath).toBe(".agents/skills/build-docs");
  });

  it("marks same-name different-content skills as conflicting", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-scan-"));
    await writeSkill(root, ".agents/skills/build-docs", "canonical\n");
    await writeSkill(root, ".claude/skills/build-docs", "different\n");

    const result = await scanWorkspace({
      rootDir: root,
      homeDir: root,
      canonical: ".agents/skills"
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.skills.get("build-docs")?.state).toBe("conflicting");
  });
});
