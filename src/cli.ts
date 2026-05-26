#!/usr/bin/env node
import { createRequire } from "node:module";
import { cwd } from "node:process";
import { addSkill } from "./add.js";
import { loadConfig } from "./config.js";
import { AgentisyncError } from "./errors.js";
import { formatStatus } from "./format.js";
import { importSkills } from "./importer.js";
import { initProject } from "./init.js";
import { pullSkillFromLibrary, pushSkillToLibrary } from "./library.js";
import { scanWorkspace } from "./scan.js";
import { applySyncPlan, createSyncPlan } from "./sync.js";
import { getStatus } from "./status.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const HELP = `Usage: myskillhub <command> [options]

Commands:
  myskillhub init [--force] [--library <url>] [--branch <name>]
                                   Create .agentisync.yaml and .agents/skills
  myskillhub add <name>           Scaffold a canonical skill
  myskillhub status [--json]      Report canonical, target, and drift state
  myskillhub sync --dry-run       Preview projection changes
  myskillhub sync                 Project canonical skills into targets
  myskillhub sync --force         Replace conflicting target entries
  myskillhub pull <name>          Pull one skill from a configured library
  myskillhub push <name>          Publish one skill to the configured library

Advanced:
  myskillhub scan [--json]        Analyze existing skills without writing
  myskillhub import [--json]      Import scattered skills into canonical

Options:
  --help, -h                      Show this help
  --version, -v                   Show version
`;

async function main(): Promise<number> {
  const command = process.argv[2] ?? "status";
  const rootDir = cwd();
  const homeDir = process.env.HOME ?? rootDir;

  if (command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
    return 0;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    console.log(packageJson.version);
    return 0;
  }

  if (command === "init") {
    const initArgs = process.argv.slice(3);
    await initProject({
      rootDir,
      force: initArgs.includes("--force"),
      library: parseInitLibrary(initArgs)
    });
    console.log("initialized myskillhub");
    return 0;
  }

  if (command === "add") {
    const name = process.argv[3];
    if (!name) {
      throw new AgentisyncError("usage: myskillhub add <name>", 2);
    }
    const config = await loadConfig(rootDir);
    await addSkill({ rootDir, homeDir, config, name });
    console.log(`added ${name}`);
    return 0;
  }

  if (command === "status") {
    const config = await loadConfig(rootDir);
    const status = await getStatus({ rootDir, homeDir, config });
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(formatStatus(status));
    }
    return status.summary.state === "clean" ? 0 : 1;
  }

  if (command === "scan") {
    const config = await loadConfig(rootDir);
    const scan = await scanWorkspace({ rootDir, homeDir, canonical: config.canonical });
    if (process.argv.includes("--json")) {
      console.log(
        JSON.stringify(
          {
            conflicts: scan.conflicts.map((skill) => skill.name),
            skills: [...scan.skills.values()].map((skill) => ({
              name: skill.name,
              state: skill.state
            }))
          },
          null,
          2
        )
      );
    } else {
      console.log(`${scan.conflicts.length} conflicts, ${scan.skills.size} skills scanned`);
    }
    return scan.conflicts.length > 0 ? 1 : 0;
  }

  if (command === "import") {
    const config = await loadConfig(rootDir);
    const result = await importSkills({ rootDir, homeDir, canonical: config.canonical });
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`imported ${result.imported.length} skills, ${result.unchanged.length} unchanged`);
    }
    return 0;
  }

  if (command === "pull") {
    const name = process.argv[3];
    if (!name) {
      throw new AgentisyncError("usage: myskillhub pull <name>", 2);
    }
    const config = await loadConfig(rootDir);
    await pullSkillFromLibrary({
      rootDir,
      homeDir,
      config,
      name,
      force: process.argv.includes("--force")
    });
    console.log(`pulled ${name}`);
    return 0;
  }

  if (command === "push") {
    const name = process.argv[3];
    if (!name) {
      throw new AgentisyncError("usage: myskillhub push <name>", 2);
    }
    const config = await loadConfig(rootDir);
    await pushSkillToLibrary({
      rootDir,
      homeDir,
      config,
      name
    });
    console.log(`pushed ${name}`);
    return 0;
  }

  if (command === "sync") {
    const config = await loadConfig(rootDir);
    const plan = await createSyncPlan({
      rootDir,
      homeDir,
      config,
      force: process.argv.includes("--force")
    });
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(plan, null, 2));
    } else if (process.argv.includes("--dry-run")) {
      for (const action of plan.actions) {
        console.log(`${action.kind} ${action.targetName}/${action.skillName} -> ${action.targetPath}`);
      }
      for (const block of plan.blocked) {
        console.log(`blocked ${block.targetName}/${block.skillName}: ${block.reason}`);
      }
    } else if (plan.blocked.length > 0) {
      for (const block of plan.blocked) {
        console.error(`blocked ${block.targetName}/${block.skillName}: ${block.reason}`);
      }
      return 3;
    } else {
      await applySyncPlan(plan);
      console.log(`applied ${plan.actions.length} sync actions`);
    }
    return plan.blocked.length > 0 ? 3 : 0;
  }

  console.error(`Unsupported command: ${command}`);
  console.error("Run `myskillhub --help` for usage.");
  return 2;
}

function parseInitLibrary(args: string[]): { url: string; branch?: string } | undefined {
  const url = getFlagValue(args, "--library");
  if (!url) {
    return undefined;
  }
  const branch = getFlagValue(args, "--branch");
  return branch ? { url, branch } : { url };
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0 && index < args.length - 1) {
    const value = args[index + 1];
    if (!value.startsWith("--")) {
      return value;
    }
  }
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.slice(flag.length + 1) : undefined;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof AgentisyncError ? error.exitCode : 4;
  });
