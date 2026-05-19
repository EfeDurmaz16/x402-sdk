import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatCapabilityJson,
  formatCapabilityReport,
  formatCapabilityRoles,
  formatCapabilitySummary,
  interopCapabilities,
} from "../src/capabilities";

describe("interop capability roadmap", () => {
  it("keeps usage-based x402 work experimental until end-to-end settlement exists", () => {
    expect(interopCapabilities.schemes.upto).toMatchObject({
      intentBoundary: "x402-scheme",
      settlementSemantics: "maximum-authorization",
      solanaSemantics: "requires-design",
      defaultCi: false,
      status: "planned",
    });

    expect(interopCapabilities.schemes.upto.languages).toMatchObject({
      typescript: { client: "planned", server: "experimental" },
      rust: { client: "planned", server: "experimental" },
      python: { client: "planned", server: "planned" },
      go: { client: "planned", server: "planned" },
      ruby: { client: "planned", server: "planned" },
      lua: { client: "missing", server: "planned" },
      php: { client: "missing", server: "planned" },
    });
  });

  it("keeps session compatibility separate from native x402 schemes", () => {
    expect(interopCapabilities.intents.session).toMatchObject({
      intentBoundary: "compatibility-intent",
      nativeX402Scheme: false,
      defaultCi: false,
      status: "planned",
    });

    expect(interopCapabilities.intents.session.languages).toMatchObject({
      python: { client: "planned", server: "planned" },
      go: { client: "planned", server: "planned" },
      ruby: { client: "planned", server: "planned" },
      lua: { client: "missing", server: "planned" },
      php: { client: "missing", server: "planned" },
    });
  });

  it("keeps batch settlement visible as a native x402 scheme candidate", () => {
    expect(interopCapabilities.schemes["batch-settlement"]).toMatchObject({
      intentBoundary: "x402-scheme",
      settlementSemantics: "batched-voucher",
      solanaSemantics: "requires-design",
      defaultCi: false,
      status: "planned",
    });

    expect(interopCapabilities.schemes["batch-settlement"].languages).toMatchObject({
      typescript: { client: "planned", server: "planned" },
      rust: { client: "planned", server: "planned" },
      python: { client: "planned", server: "planned" },
      go: { client: "planned", server: "planned" },
      ruby: { client: "planned", server: "planned" },
      lua: { client: "missing", server: "planned" },
      php: { client: "missing", server: "planned" },
    });
  });

  it("keeps subscription compatibility visible but outside native x402 schemes", () => {
    expect(interopCapabilities.intents.subscription).toMatchObject({
      intentBoundary: "compatibility-intent",
      nativeX402Scheme: false,
      defaultCi: false,
      status: "planned",
    });

    expect(interopCapabilities.intents.subscription.languages).toMatchObject({
      python: { client: "planned", server: "planned" },
      go: { client: "planned", server: "planned" },
      ruby: { client: "planned", server: "planned" },
      lua: { client: "missing", server: "planned" },
      php: { client: "missing", server: "planned" },
    });
  });

  it("formats planned and server-only capability gaps for maintainer diagnostics", () => {
    expect(formatCapabilityReport()).toContain(
      "scheme:upto planned semantics:maximum-authorization solana:requires-design default-ci:false",
    );
    expect(formatCapabilityReport()).toContain(
      "scheme:batch-settlement planned semantics:batched-voucher solana:requires-design default-ci:false",
    );
    expect(formatCapabilityReport()).toContain("intent:session planned native-x402:false");
    expect(formatCapabilityReport()).toContain("intent:subscription planned native-x402:false");
    expect(formatCapabilityReport()).toContain("lua client:missing server:planned");
    expect(formatCapabilityReport()).toContain("php client:missing server:planned");
  });

  it("summarizes implemented, planned, and missing roles for runner diagnostics", () => {
    expect(formatCapabilitySummary()).toEqual([
      "implemented: exact client/server rust,typescript",
      "planned: upto client/server go,python,ruby",
      "experimental: upto server rust,typescript",
      "planned: upto server-only lua,php",
      "missing: upto client lua,php",
      "planned: batch-settlement client/server go,python,ruby,rust,typescript",
      "planned: batch-settlement server-only lua,php",
      "missing: batch-settlement client lua,php",
      "planned: session client/server go,python,ruby",
      "planned: session server-only lua,php",
      "missing: session client lua,php",
      "planned: subscription client/server go,python,ruby",
      "planned: subscription server-only lua,php",
      "missing: subscription client lua,php",
    ]);
  });

  it("formats a machine-readable capability artifact for CI", () => {
    expect(formatCapabilityJson()).toEqual({
      version: 1,
      summary: formatCapabilitySummary(),
      roles: formatCapabilityRoles(),
      capabilities: interopCapabilities,
    });
  });

  it("flattens role capabilities for CI artifact consumers", () => {
    expect(formatCapabilityRoles()).toContainEqual({
      domain: "scheme",
      name: "exact",
      language: "rust",
      role: "client",
      status: "implemented",
      runtimeEligible: true,
    });
    expect(formatCapabilityRoles()).toContainEqual({
      domain: "scheme",
      name: "upto",
      language: "typescript",
      role: "server",
      status: "experimental",
      runtimeEligible: false,
    });
    expect(formatCapabilityRoles()).toContainEqual({
      domain: "scheme",
      name: "batch-settlement",
      language: "rust",
      role: "client",
      status: "planned",
      runtimeEligible: false,
    });
    expect(formatCapabilityRoles()).toContainEqual({
      domain: "intent",
      name: "session",
      language: "php",
      role: "client",
      status: "missing",
      runtimeEligible: false,
    });
  });

  it("exposes capability diagnostics as a package script", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.capabilities).toBe(
      "tsx src/print-capabilities.ts",
    );
    expect(packageJson.scripts["capabilities:json"]).toBe(
      "tsx src/print-capabilities.ts --json",
    );
    expect(packageJson.scripts.probes).toBe("tsx src/print-probes.ts");
    expect(packageJson.scripts["probes:json"]).toBe("tsx src/print-probes.ts --json");
    expect(packageJson.scripts.promotion).toBe("tsx src/print-promotion.ts");
    expect(packageJson.scripts["promotion:json"]).toBe("tsx src/print-promotion.ts --json");
    expect(packageJson.scripts["reports:artifacts"]).toBe(
      "pnpm --silent capabilities:json > interop-capabilities.json && pnpm --silent scaffold:json > interop-scaffold.json && pnpm --silent probes:json > interop-probes.json && pnpm --silent promotion:json > interop-promotion.json",
    );
    expect(packageJson.scripts["reports:check"]).toBe("tsx src/verify-report-artifacts.ts --keep");
    expect(packageJson.scripts["reports:verify"]).toBe(
      "pnpm reports:artifacts && tsx src/verify-report-artifacts.ts",
    );
    expect(packageJson.scripts["test:experimental"]).toBe(
      "vitest run test/capabilities.test.ts test/contracts.test.ts test/report-cli.test.ts test/scaffold.test.ts test/lua-scaffold.test.ts test/promotion.test.ts test/upto-fixtures.test.ts test/batch-settlement-fixtures.test.ts test/session-fixtures.test.ts test/subscription-fixtures.test.ts test/planned-adapters.test.ts",
    );
    expect(packageJson.scripts["test:ci"]).toBe(
      "pnpm typecheck && X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:smoke && X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:multi-currency && X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:boundaries",
    );
    expect(packageJson.scripts["test:pair:ts-rust"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=rust vitest run test/e2e.test.ts",
    );
    expect(packageJson.scripts["test:pair:rust-ts"]).toBe(
      "X402_INTEROP_CLIENTS=rust X402_INTEROP_SERVERS=typescript vitest run test/e2e.test.ts",
    );
    expect(packageJson.scripts["test:language:typescript"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=typescript vitest run test/e2e.test.ts",
    );
    expect(packageJson.scripts["test:language:rust"]).toBe(
      "X402_INTEROP_CLIENTS=rust X402_INTEROP_SERVERS=rust vitest run test/e2e.test.ts",
    );
    expect(packageJson.scripts["test:multi-currency"]).toBe(
      "vitest run test/e2e.test.ts --testNamePattern \"picks PYUSD|falls back to USDC\"",
    );
    expect(packageJson.scripts["test:planned-adapters"]).toBe(
      "vitest run test/planned-adapters.test.ts",
    );
    expect(packageJson.scripts["test:probe:local"]).toBe(
      "pnpm test:ci && pnpm test:probe:staging && pnpm test:probe:reports",
    );
    expect(packageJson.scripts["test:probe:staging"]).toBe(
      "pnpm test:probe:planned-syntax && pnpm test:probe:lua-static && pnpm test:probe:usage-boundaries && pnpm test:probe:planned-runtime",
    );
    expect(packageJson.scripts["test:probe:reports"]).toBe(
      "pnpm capabilities && pnpm capabilities:json && pnpm scaffold && pnpm scaffold:json && pnpm probes && pnpm probes:json && pnpm promotion && pnpm promotion:json && pnpm reports:verify",
    );
    expect(packageJson.scripts["test:probe:planned-syntax"]).toBe(
      "pnpm test:probe:python-syntax && pnpm test:probe:python-unit && pnpm test:probe:go-build && pnpm test:probe:ruby-syntax && pnpm test:probe:ruby-unit && pnpm test:probe:php-syntax && pnpm test:probe:php-unit && pnpm test:probe:php-composer",
    );
    expect(packageJson.scripts["test:probe:planned-runtime"]).toBe("pnpm test:planned-adapters");
    expect(packageJson.scripts["test:probe:usage-boundaries"]).toBe(
      "pnpm test:probe:upto-fixtures && pnpm test:probe:typescript-upto-server && pnpm test:probe:rust-upto-server && pnpm test:probe:batch-settlement-fixtures && pnpm test:probe:session-fixtures && pnpm test:probe:subscription-fixtures && vitest run test/contracts.test.ts",
    );
    expect(packageJson.scripts["test:probe:multi-currency"]).toBe(
      "X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:multi-currency",
    );
    expect(packageJson.scripts["test:probe:upto-fixtures"]).toBe(
      "vitest run test/upto-fixtures.test.ts",
    );
    expect(packageJson.scripts["test:probe:typescript-upto-server"]).toBe(
      "cd ../../typescript/packages/x402 && pnpm exec vitest run test/unit/upto-server.test.ts test/unit/compatibility.test.ts",
    );
    expect(packageJson.scripts["test:probe:rust-upto-server"]).toBe(
      "cd ../../rust && cargo test upto",
    );
    expect(packageJson.scripts["test:probe:batch-settlement-fixtures"]).toBe(
      "vitest run test/batch-settlement-fixtures.test.ts",
    );
    expect(packageJson.scripts["test:probe:session-fixtures"]).toBe(
      "vitest run test/session-fixtures.test.ts",
    );
    expect(packageJson.scripts["test:probe:subscription-fixtures"]).toBe(
      "vitest run test/subscription-fixtures.test.ts",
    );
    expect(packageJson.scripts["test:probe:upto-boundary"]).toBe(
      "X402_INTEROP_SCHEME=upto pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:session-boundary"]).toBe(
      "X402_INTEROP_INTENT=session pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:python-syntax"]).toBe(
      "cd ../../python && python3 -m compileall -q src",
    );
    expect(packageJson.scripts["test:probe:python-unit"]).toBe(
      "cd ../../python && PYTHONPATH=src python3 -m unittest discover -s tests",
    );
    expect(packageJson.scripts["test:probe:python-client"]).toBe(
      "X402_INTEROP_CLIENTS=python X402_INTEROP_SERVERS=rust pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:python-server"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=python pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:go-build"]).toBe(
      "cd ../../go && go test ./...",
    );
    expect(packageJson.scripts["test:probe:go-client"]).toBe(
      "X402_INTEROP_CLIENTS=go X402_INTEROP_SERVERS=rust pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:go-server"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=go pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:ruby-syntax"]).toBe(
      "cd ../../ruby && ruby -c bin/interop-client && ruby -c bin/interop-server",
    );
    expect(packageJson.scripts["test:probe:ruby-unit"]).toBe(
      "cd ../../ruby && ruby -Ilib:test test/interop_client_test.rb",
    );
    expect(packageJson.scripts["test:probe:ruby-client"]).toBe(
      "X402_INTEROP_CLIENTS=ruby X402_INTEROP_SERVERS=rust pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:ruby-server"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=ruby pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:php-syntax"]).toBe(
      "php -l ../../php/bin/interop-server.php",
    );
    expect(packageJson.scripts["test:probe:php-unit"]).toBe(
      "php ../../php/tests/interop_server_test.php",
    );
    expect(packageJson.scripts["test:probe:php-composer"]).toBe(
      "cd ../../php && composer validate --strict && composer test",
    );
    expect(packageJson.scripts["test:probe:php-server"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=php pnpm test:smoke",
    );
    expect(packageJson.scripts["test:probe:lua-static"]).toBe(
      "vitest run test/lua-scaffold.test.ts",
    );
    expect(packageJson.scripts["test:probe:lua-syntax"]).toBe(
      "cd ../../lua && if command -v luac >/dev/null 2>&1; then luac -p bin/interop-server.lua; elif command -v lua >/dev/null 2>&1; then lua -e 'assert(loadfile(\"bin/interop-server.lua\"))'; else echo 'Lua toolchain not found; install lua or luac to run this probe' >&2; exit 127; fi",
    );
    expect(packageJson.scripts["test:probe:lua-server"]).toBe(
      "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=lua pnpm test:smoke",
    );
  });

  it("keeps interop JSON reports available as CI artifacts", () => {
    const workflow = readFileSync("../../.github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("pnpm reports:artifacts && pnpm reports:check");
    expect(workflow).toContain("name: interop-capabilities");
    expect(workflow).toContain("name: interop-scaffold");
    expect(workflow).toContain("name: interop-probes");
    expect(workflow).toContain("name: interop-promotion");
    expect(workflow).toContain("pnpm test:multi-currency");
    expect(workflow).toContain("pnpm test:boundaries");
    expect(workflow).toContain("vars.X402_INTEROP_EXPERIMENTAL == 'true'");
    expect(workflow).toContain("pnpm test:experimental");
  });

  it("keeps generated interop report artifacts out of source control", () => {
    const gitignore = readFileSync("../../.gitignore", "utf8");

    expect(gitignore).toContain("tests/interop/interop-*.json");
  });
});
