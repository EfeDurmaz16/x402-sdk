import { readFileSync, rmSync } from "node:fs";

const artifactFiles = [
  "interop-capabilities.json",
  "interop-scaffold.json",
  "interop-probes.json",
  "interop-promotion.json",
] as const;

const keepArtifacts = process.argv.includes("--keep");

try {
  for (const file of artifactFiles) {
    const artifact = JSON.parse(readFileSync(file, "utf8")) as { version?: unknown };
    if (artifact.version !== 1) {
      throw new Error(`${file} is missing version 1`);
    }
  }
} finally {
  if (!keepArtifacts) {
    for (const file of artifactFiles) {
      rmSync(file, { force: true });
    }
  }
}
