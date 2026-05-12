import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function fingerprintDirectory(directory: string): Promise<string> {
  const files = await listFiles(directory, directory);
  const hash = createHash("sha256");

  for (const file of files.sort((a, b) => a.relative.localeCompare(b.relative))) {
    hash.update(file.relative);
    hash.update("\0");
    hash.update(await readFile(file.absolute));
    hash.update("\0");
  }

  return `sha256:${hash.digest("hex")}`;
}

async function listFiles(root: string, current: string): Promise<Array<{ absolute: string; relative: string }>> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: Array<{ absolute: string; relative: string }> = [];

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const entryStat = await stat(absolute);
    if (entryStat.isDirectory()) {
      files.push(...(await listFiles(root, absolute)));
      continue;
    }
    if (entryStat.isFile()) {
      files.push({
        absolute,
        relative: path.relative(root, absolute).replaceAll(path.sep, "/")
      });
    }
  }

  return files;
}
