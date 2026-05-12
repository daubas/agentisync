import path from "node:path";

export function resolveProjectPath(rootDir: string, value: string, homeDir: string): string {
  if (value === "~") {
    return homeDir;
  }
  if (value.startsWith("~/")) {
    return path.join(homeDir, value.slice(2));
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.join(rootDir, value);
}

export function toRelativeDisplay(rootDir: string, absolutePath: string): string {
  const relative = path.relative(rootDir, absolutePath);
  return relative.startsWith("..") ? absolutePath : relative || ".";
}

export function normalizePath(value: string): string {
  return path.normalize(value).replaceAll(path.sep, "/");
}
