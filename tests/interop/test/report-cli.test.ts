import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runJsonReport(script: string): unknown {
  const output = execFileSync("pnpm", ["exec", "tsx", script, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  return JSON.parse(output);
}

describe("interop report CLIs", () => {
  it("prints clean machine-readable capability JSON", () => {
    expect(runJsonReport("src/print-capabilities.ts")).toMatchObject({
      version: 1,
      summary: expect.any(Array),
      roles: expect.any(Array),
      capabilities: expect.any(Object),
    });
  });

  it("prints clean machine-readable scaffold JSON", () => {
    expect(runJsonReport("src/print-scaffold.ts")).toMatchObject({
      version: 1,
      sdks: expect.arrayContaining([
        expect.objectContaining({
          language: "rust",
          rootExists: true,
          manifestExists: true,
          runtimeClientAdapter: true,
          runtimeServerAdapter: true,
        }),
        expect.objectContaining({
          language: "php",
          serverOnly: true,
          runtimeClientAdapter: false,
        }),
      ]),
    });
  });
});
