import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatSdkScaffoldReport,
  getSdkScaffoldStatus,
  sdkScaffoldDefinitions,
} from "../src/scaffold";
import { interopCapabilities } from "../src/capabilities";

describe("SDK scaffold diagnostics", () => {
  it("tracks the planned language roots and manifests", () => {
    expect(sdkScaffoldDefinitions).toEqual([
      {
        language: "rust",
        root: "../../rust",
        manifest: "Cargo.toml",
        serverOnly: false,
        planned: true,
        expectedClientCommand: [
          "cargo",
          "run",
          "--quiet",
          "--manifest-path",
          "../../rust/Cargo.toml",
          "--bin",
          "interop_client",
        ],
        expectedServerCommand: [
          "cargo",
          "run",
          "--quiet",
          "--manifest-path",
          "../../rust/Cargo.toml",
          "--bin",
          "interop_server",
        ],
      },
      {
        language: "typescript",
        root: "../../typescript",
        manifest: "package.json",
        serverOnly: false,
        planned: true,
        expectedClientCommand: [
          "pnpm",
          "exec",
          "node",
          "--import",
          "tsx",
          "src/fixtures/typescript/client.ts",
        ],
        expectedServerCommand: [
          "pnpm",
          "exec",
          "node",
          "--import",
          "tsx",
          "src/fixtures/typescript/server.ts",
        ],
      },
      {
        language: "python",
        root: "../../python",
        manifest: "pyproject.toml",
        serverOnly: false,
        planned: true,
        expectedClientCommand: ["python3", "-m", "x402_sdk.interop.client"],
        expectedServerCommand: ["python3", "-m", "x402_sdk.interop.server"],
      },
      {
        language: "go",
        root: "../../go",
        manifest: "go.mod",
        serverOnly: false,
        planned: true,
        expectedClientCommand: ["go", "run", "./cmd/interop-client"],
        expectedServerCommand: ["go", "run", "./cmd/interop-server"],
      },
      {
        language: "ruby",
        root: "../../ruby",
        manifest: "Gemfile",
        serverOnly: false,
        planned: true,
        expectedClientCommand: ["bundle", "exec", "ruby", "bin/interop-client"],
        expectedServerCommand: ["bundle", "exec", "ruby", "bin/interop-server"],
      },
      {
        language: "lua",
        root: "../../lua",
        manifest: "x402-sdk-svm.rockspec",
        serverOnly: true,
        planned: true,
        expectedServerCommand: ["lua", "bin/interop-server.lua"],
      },
      {
        language: "php",
        root: "../../php",
        manifest: "composer.json",
        serverOnly: true,
        planned: true,
        expectedServerCommand: ["php", "bin/interop-server.php"],
      },
    ]);
  });

  it("reports current runtime adapter and scaffold state", () => {
    expect(getSdkScaffoldStatus()).toContainEqual(
      expect.objectContaining({
        language: "rust",
        rootExists: true,
        manifestExists: true,
        runtimeClientAdapter: true,
        runtimeServerAdapter: true,
      }),
    );
    expect(getSdkScaffoldStatus()).toContainEqual(
      expect.objectContaining({
        language: "php",
        rootExists: false,
        manifestExists: false,
        serverOnly: true,
        runtimeClientAdapter: false,
        runtimeServerAdapter: false,
      }),
    );
  });

  it("formats maintainer-readable scaffold diagnostics", () => {
    expect(formatSdkScaffoldReport()).toContain(
      "language:typescript root:present manifest:present(package.json)",
    );
    expect(formatSdkScaffoldReport()).toContain(
      "language:lua root:missing manifest:missing(x402-sdk-svm.rockspec) server-only:true",
    );
    expect(formatSdkScaffoldReport()).toContain("expected-client:none");
    expect(formatSdkScaffoldReport()).toContain("expected-server:php bin/interop-server.php");
  });

  it("exposes scaffold diagnostics as package scripts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.scaffold).toBe("tsx src/print-scaffold.ts");
    expect(packageJson.scripts["scaffold:json"]).toBe("tsx src/print-scaffold.ts --json");
  });

  it("reports registered scaffold adapters without promoting them to implemented exact", () => {
    const runtimeReady = getSdkScaffoldStatus()
      .filter(status => status.runtimeClientAdapter || status.runtimeServerAdapter)
      .map(status => ({
        language: status.language,
        client: status.runtimeClientAdapter,
        server: status.runtimeServerAdapter,
      }))
      .sort((left, right) => left.language.localeCompare(right.language));

    expect(runtimeReady).toEqual([
      { language: "go", client: true, server: true },
      { language: "python", client: true, server: true },
      { language: "rust", client: true, server: true },
      { language: "typescript", client: true, server: true },
    ]);

    expect(interopCapabilities.schemes.exact.languages).toEqual({
      rust: { client: "implemented", server: "implemented" },
      typescript: { client: "implemented", server: "implemented" },
    });
  });

  it("keeps server-only scaffold policy aligned with usage-based capability gaps", () => {
    const serverOnlyLanguages = getSdkScaffoldStatus()
      .filter(status => status.serverOnly)
      .map(status => status.language)
      .sort();

    for (const capability of [
      interopCapabilities.schemes.upto,
      interopCapabilities.intents.session,
      interopCapabilities.intents.subscription,
    ]) {
      const missingClients = Object.entries(capability.languages)
        .filter(([, roles]) => roles.client === "missing" && roles.server === "planned")
        .map(([language]) => language)
        .sort();

      expect(missingClients).toEqual(serverOnlyLanguages);
    }
  });
});
