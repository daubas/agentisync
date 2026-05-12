import { describe, expect, it } from "vitest";
import { formatStatus } from "../src/format.js";
import type { StatusResult } from "../src/types.js";

describe("formatStatus", () => {
  it("renders canonical, targets, consumers, and drift", () => {
    const status: StatusResult = {
      version: 1,
      canonical: { path: ".agents/skills", skillCount: 1 },
      consumers: [{ name: "codex", path: ".agents/skills", state: "ready" }],
      summary: {
        state: "drifted",
        clean: 0,
        missing: 1,
        drifted: 0,
        extra: 0,
        broken: 0,
        conflict: 0,
        skipped: 0
      },
      targets: [
        {
          name: "claude",
          path: ".claude/skills",
          mode: "symlink",
          state: "missing",
          skills: [{ name: "build-docs", state: "missing", canonicalFingerprint: "sha256:a" }]
        }
      ]
    };

    const output = formatStatus(status);

    expect(output).toContain("state      drifted");
    expect(output).toContain("canonical  .agents/skills  1 skills");
    expect(output).toContain("claude     .claude/skills   symlink   missing");
    expect(output).toContain("codex      .agents/skills   ready");
    expect(output).toContain("claude/build-docs  missing");
  });
});
