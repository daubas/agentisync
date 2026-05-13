#!/usr/bin/env node
import { createRequire } from "node:module";
import { cwd } from "node:process";
import { addSkill } from "./add.js";
import { loadConfig } from "./config.js";
import { AgentisyncError } from "./errors.js";
import { formatStatus } from "./format.js";
import { importSkills } from "./importer.js";
import { initProject } from "./init.js";
import { scanWorkspace } from "./scan.js";
import { applySyncPlan, createSyncPlan } from "./sync.js";
import { getStatus } from "./status.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const HELP = `Usage: agentisync <command> [options]

Commands:
  agentisync init [--force]       Create .agentisync.yaml and .agents/skills
  agentisync add <name>           Scaffold a canonical skill
  agentisync scan [--json]        Analyze existing skills without writing
  agentisync status [--json]      Report canonical, target, and drift state
  agentisync sync --dry-run       Preview projection changes
  agentisync sync                 Project canonical skills into targets
  agentisync sync --force         Replace conflicting target entries
  agentisync import [--json]      Import scattered skills into canonical

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
    await initProject({ rootDir, force: process.argv.includes("--force") });
    console.log("initialized agentisync");
    return 0;
  }

  if (command === "add") {
    const name = process.argv[3];
    if (!name) {
      throw new AgentisyncError("usage: agentisync add <name>", 2);
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
  console.error("Run `agentisync --help` for usage.");
  return 2;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof AgentisyncError ? error.exitCode : 4;
  });
