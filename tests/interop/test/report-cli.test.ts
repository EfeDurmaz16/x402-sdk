import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { interopProbes } from "../src/probes";

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
          implementedClientAdapter: true,
          implementedServerAdapter: true,
        }),
        expect.objectContaining({
          language: "lua",
          serverOnly: true,
          runtimeClientAdapter: false,
          runtimeServerAdapter: true,
          implementedClientAdapter: false,
          implementedServerAdapter: false,
        }),
        expect.objectContaining({
          language: "php",
          serverOnly: true,
          runtimeClientAdapter: false,
          runtimeServerAdapter: true,
          implementedClientAdapter: false,
          implementedServerAdapter: false,
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
          command: "pnpm capabilities && pnpm capabilities:json && pnpm scaffold && pnpm scaffold:json && pnpm probes && pnpm probes:json && pnpm promotion && pnpm promotion:json",
        }),
        expect.objectContaining({
          script: "test:probe:multi-currency",
          command: "X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:multi-currency",
        }),
        expect.objectContaining({
          script: "test:probe:php-syntax",
          command: "php -l ../../php/bin/interop-server.php",
        }),
        expect.objectContaining({
          script: "test:probe:php-unit",
          command: "php ../../php/tests/interop_server_test.php",
        }),
        expect.objectContaining({
          script: "test:probe:php-composer",
          command: "cd ../../php && composer validate --strict && composer test",
        }),
        expect.objectContaining({
          script: "test:probe:upto-fixtures",
          command: "vitest run test/upto-fixtures.test.ts",
        }),
        expect.objectContaining({
          script: "test:probe:session-fixtures",
          command: "vitest run test/session-fixtures.test.ts",
        }),
        expect.objectContaining({
          script: "test:probe:lua-static",
          command: "vitest run test/lua-scaffold.test.ts",
        }),
        expect.objectContaining({
          script: "test:probe:python-unit",
          command: "cd ../../python && PYTHONPATH=src python3 -m unittest discover -s tests",
        }),
        expect.objectContaining({
          script: "test:probe:ruby-unit",
          command: "cd ../../ruby && ruby -Ilib:test test/interop_client_test.rb",
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

  it("keeps expected-red probes out of green aggregate probes", () => {
    const byScript = new Map(interopProbes.map(probe => [probe.script, probe]));
    const expectedRedScripts = interopProbes
      .filter(probe => probe.status === "expected-red")
      .map(probe => probe.script);

    for (const aggregateScript of [
      "test:probe:local",
      "test:probe:staging",
      "test:probe:planned-syntax",
      "test:probe:usage-boundaries",
      "test:probe:reports",
    ]) {
      const aggregate = byScript.get(aggregateScript);
      expect(aggregate?.status).toBe("green");

      for (const expectedRedScript of expectedRedScripts) {
        expect(aggregate?.command).not.toContain(expectedRedScript);
      }
    }
  });

  it("prints clean machine-readable promotion JSON", () => {
    expect(runJsonReport("src/print-promotion.ts")).toMatchObject({
      version: 1,
      slices: expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          status: "staged",
        }),
        expect.objectContaining({
          id: "15-19",
          status: "planned",
        }),
      ]),
    });
  });
});
