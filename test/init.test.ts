import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initProject } from "../src/init.js";

describe("initProject", () => {
  it("creates config and canonical root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-init-"));

    await initProject({ rootDir: root });

    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain("canonical: .agents/skills");
    await expect(mkdir(path.join(root, ".agents/skills"), { recursive: false })).rejects.toThrow();
  });

  it("does not overwrite existing config unless forced", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-init-"));
    await writeFile(path.join(root, ".agentisync.yaml"), "version: 1\ncanonical: custom\n");

    await expect(initProject({ rootDir: root })).rejects.toThrow("config already exists");
    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain("canonical: custom");
  });

  it("writes library settings when provided", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-init-"));

    await initProject({
      rootDir: root,
      library: {
        url: "git@github-daubas:daubas/skills.git",
        branch: "main"
      }
    });

    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain("library:");
    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain('url: "git@github-daubas:daubas/skills.git"');
    await expect(readFile(path.join(root, ".agentisync.yaml"), "utf8")).resolves.toContain('branch: "main"');
  });
});
