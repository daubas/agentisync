import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads consumers and targets from .agentisync.yaml", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-config-"));
    await writeFile(
      path.join(root, ".agentisync.yaml"),
      [
        "version: 1",
        "canonical: .agents/skills",
        "library:",
        "  url: git@github-daubas:daubas/skills.git",
        "consumers:",
        "  codex:",
        "    path: .agents/skills",
        "targets:",
        "  claude:",
        "    path: .claude/skills",
        "    mode: symlink",
        ""
      ].join("\n")
    );

    const config = await loadConfig(root);

    expect(config.canonical).toBe(".agents/skills");
    expect(config.consumers.codex.path).toBe(".agents/skills");
    expect(config.targets.claude.mode).toBe("symlink");
    expect(config.library?.url).toBe("git@github-daubas:daubas/skills.git");
  });

  it("rejects canonical when it is also configured as a target", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentisync-config-"));
    await writeFile(
      path.join(root, ".agentisync.yaml"),
      [
        "version: 1",
        "canonical: .agents/skills",
        "targets:",
        "  codex:",
        "    path: .agents/skills",
        "    mode: symlink",
        ""
      ].join("\n")
    );

    await expect(loadConfig(root)).rejects.toThrow("canonical path cannot also be a target");
  });
});
