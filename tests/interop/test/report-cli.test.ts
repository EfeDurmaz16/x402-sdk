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

  it("prints clean machine-readable probe JSON", () => {
    expect(runJsonReport("src/print-probes.ts")).toMatchObject({
      version: 1,
      green: expect.arrayContaining([
        expect.objectContaining({
          script: "test:probe:local",
          command: "pnpm test:ci && pnpm test:probe:staging && pnpm test:probe:reports",
        }),
        expect.objectContaining({
          script: "test:probe:reports",
          command: "pnpm capabilities && pnpm capabilities:json && pnpm scaffold && pnpm scaffold:json && pnpm probes && pnpm probes:json",
        }),
        expect.objectContaining({
          script: "test:probe:php-syntax",
          command: "php -l ../../php/bin/interop-server.php",
        }),
        expect.objectContaining({
          script: "test:probe:python-unit",
          command: "cd ../../python && PYTHONPATH=src python3 -m unittest discover -s tests",
        }),
      ]),
      expectedRed: expect.arrayContaining([
        expect.objectContaining({
          script: "test:probe:php-server",
          reason: "PHP server scaffold is registered but exact payment settlement is not implemented yet.",
        }),
        expect.objectContaining({
          script: "test:probe:upto-boundary",
          reason: "Solana upto runtime remains disabled until maximum-authorization settlement is designed.",
        }),
      ]),
    });
  });
});
