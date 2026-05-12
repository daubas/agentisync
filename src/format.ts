import type { StatusResult, StatusSkill } from "./types.js";

export function formatStatus(status: StatusResult): string {
  const lines: string[] = [];
  lines.push(`state      ${status.summary.state}`);
  lines.push(`canonical  ${status.canonical.path}  ${status.canonical.skillCount} skills`);
  lines.push("");

  if (status.targets.length > 0) {
    lines.push("target     path             mode      state");
    for (const target of status.targets) {
      lines.push(`${pad(target.name, 10)} ${pad(target.path, 16)} ${pad(target.mode, 9)} ${target.state}`);
    }
    lines.push("");
  }

  if (status.consumers.length > 0) {
    lines.push("consumer   path             state");
    for (const consumer of status.consumers) {
      lines.push(`${pad(consumer.name, 10)} ${pad(consumer.path, 16)} ${consumer.state}`);
    }
    lines.push("");
  }

  const drift = status.targets.flatMap((target) =>
    target.skills
      .filter((skill) => skill.state !== "clean" && skill.state !== "skipped")
      .map((skill) => formatDrift(target.name, skill))
  );
  if (drift.length > 0) {
    lines.push("drift");
    lines.push(...drift);
  }

  return lines.join("\n").trimEnd();
}

function formatDrift(targetName: string, skill: StatusSkill): string {
  return `  ${targetName}/${skill.name}  ${skill.state}`;
}

function pad(value: string, length: number): string {
  return value.padEnd(length, " ");
}
