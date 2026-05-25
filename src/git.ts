import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitCommandOptions {
  env?: NodeJS.ProcessEnv;
}

export async function git(args: string[], cwd: string, options: GitCommandOptions = {}): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      ...options.env
    }
  });
}
