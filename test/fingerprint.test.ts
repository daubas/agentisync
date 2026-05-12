import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprintDirectory } from "../src/fingerprint.js";

describe("fingerprintDirectory", () => {
  it("is stable for identical file contents", async () => {
    const a = await mkdtemp(path.join(tmpdir(), "agentisync-fp-a-"));
    const b = await mkdtemp(path.join(tmpdir(), "agentisync-fp-b-"));
    await mkdir(path.join(a, "nested"));
    await mkdir(path.join(b, "nested"));
    await writeFile(path.join(a, "SKILL.md"), "hello\n");
    await writeFile(path.join(a, "nested", "ref.txt"), "world\n");
    await writeFile(path.join(b, "nested", "ref.txt"), "world\n");
    await writeFile(path.join(b, "SKILL.md"), "hello\n");

    await expect(fingerprintDirectory(a)).resolves.toBe(await fingerprintDirectory(b));
  });

  it("changes when file content changes", async () => {
    const a = await mkdtemp(path.join(tmpdir(), "agentisync-fp-a-"));
    const b = await mkdtemp(path.join(tmpdir(), "agentisync-fp-b-"));
    await writeFile(path.join(a, "SKILL.md"), "hello\n");
    await writeFile(path.join(b, "SKILL.md"), "changed\n");

    await expect(fingerprintDirectory(a)).resolves.not.toBe(await fingerprintDirectory(b));
  });
});
