import { describe, expect, it } from "vitest";
import {
  clientImplementations,
  parseSelectedImplementationIds,
  serverImplementations,
  validateImplementationSelection,
  validateSelectedImplementationScaffolds,
} from "../src/implementations";
import { formatCapabilityRoles } from "../src/capabilities";

describe("interop implementation metadata", () => {
  it("marks current runtime adapters as exact-only", () => {
    const implementations = [...clientImplementations, ...serverImplementations].filter(
      implementation => implementation.enabled,
    );

    expect(
      implementations.map(implementation => ({
        id: implementation.id,
        role: implementation.role,
        adapterStatus: implementation.adapterStatus,
        runtimeSchemes: implementation.runtimeSchemes,
        runtimeIntents: implementation.runtimeIntents,
      })),
    ).toEqual([
      {
        id: "typescript",
        role: "client",
        adapterStatus: "implemented",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
      {
        id: "rust",
        role: "client",
        adapterStatus: "implemented",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
      {
        id: "typescript",
        role: "server",
        adapterStatus: "implemented",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
      {
        id: "rust",
        role: "server",
        adapterStatus: "implemented",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
    ]);
  });

  it("does not expose planned or experimental capabilities as runtime-ready adapters", () => {
    expect(
      [...clientImplementations, ...serverImplementations].flatMap(
        implementation => implementation.runtimeSchemes,
      ),
    ).not.toContain("upto");
  });

  it("keeps experimental upto servers out of the runtime adapter matrix", () => {
    expect(formatCapabilityRoles()).toContainEqual({
      domain: "scheme",
      name: "upto",
      language: "rust",
      role: "server",
      status: "experimental",
      runtimeEligible: false,
    });
    expect(formatCapabilityRoles()).toContainEqual({
      domain: "scheme",
      name: "upto",
      language: "typescript",
      role: "server",
      status: "experimental",
      runtimeEligible: false,
    });
    expect(
      serverImplementations.filter(implementation => implementation.enabled).map(implementation => ({
        id: implementation.id,
        runtimeSchemes: implementation.runtimeSchemes,
      })),
    ).toEqual([
      { id: "typescript", runtimeSchemes: ["exact"] },
      { id: "rust", runtimeSchemes: ["exact"] },
    ]);
  });

  it("registers opt-in planned adapter commands without enabling them by default", () => {
    expect(
      clientImplementations.map(implementation => ({
        id: implementation.id,
        adapterStatus: implementation.adapterStatus,
        enabled: implementation.enabled,
        command: implementation.command,
        cwd: implementation.cwd,
        env: implementation.env,
        requiredManifest: implementation.requiredManifest,
      })),
    ).toEqual([
      {
        id: "typescript",
        adapterStatus: "implemented",
        enabled: true,
        command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/client.ts"],
        cwd: undefined,
        env: undefined,
        requiredManifest: undefined,
      },
      {
        id: "rust",
        adapterStatus: "implemented",
        enabled: true,
        command: [
          "cargo",
          "run",
          "--quiet",
          "--manifest-path",
          "../../rust/Cargo.toml",
          "--bin",
          "interop_client",
        ],
        cwd: undefined,
        env: undefined,
        requiredManifest: undefined,
      },
      {
        id: "python",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["python3", "-m", "x402_sdk.interop.client"],
        cwd: "../../python",
        env: { PYTHONPATH: "src" },
        requiredManifest: "../../python/pyproject.toml",
      },
      {
        id: "go",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["go", "run", "./cmd/interop-client"],
        cwd: "../../go",
        env: undefined,
        requiredManifest: "../../go/go.mod",
      },
      {
        id: "ruby",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["ruby", "bin/interop-client"],
        cwd: "../../ruby",
        env: undefined,
        requiredManifest: "../../ruby/Gemfile",
      },
    ]);

    expect(
      serverImplementations.map(implementation => ({
        id: implementation.id,
        adapterStatus: implementation.adapterStatus,
        enabled: implementation.enabled,
        command: implementation.command,
        cwd: implementation.cwd,
        env: implementation.env,
        requiredManifest: implementation.requiredManifest,
      })),
    ).toEqual([
      {
        id: "typescript",
        adapterStatus: "implemented",
        enabled: true,
        command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/server.ts"],
        cwd: undefined,
        env: undefined,
        requiredManifest: undefined,
      },
      {
        id: "rust",
        adapterStatus: "implemented",
        enabled: true,
        command: [
          "cargo",
          "run",
          "--quiet",
          "--manifest-path",
          "../../rust/Cargo.toml",
          "--bin",
          "interop_server",
        ],
        cwd: undefined,
        env: undefined,
        requiredManifest: undefined,
      },
      {
        id: "python",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["python3", "-m", "x402_sdk.interop.server"],
        cwd: "../../python",
        env: { PYTHONPATH: "src" },
        requiredManifest: "../../python/pyproject.toml",
      },
      {
        id: "go",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["go", "run", "./cmd/interop-server"],
        cwd: "../../go",
        env: undefined,
        requiredManifest: "../../go/go.mod",
      },
      {
        id: "ruby",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["ruby", "bin/interop-server"],
        cwd: "../../ruby",
        env: undefined,
        requiredManifest: "../../ruby/Gemfile",
      },
      {
        id: "lua",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["lua", "bin/interop-server.lua"],
        cwd: "../../lua",
        env: undefined,
        requiredManifest: "../../lua/x402-sdk-svm.rockspec",
      },
      {
        id: "php",
        adapterStatus: "scaffold",
        enabled: false,
        command: ["php", "bin/interop-server.php"],
        cwd: "../../php",
        env: undefined,
        requiredManifest: "../../php/composer.json",
      },
    ]);
  });

  it("parses comma-separated implementation filters", () => {
    expect(parseSelectedImplementationIds(" rust, typescript ,,")).toEqual([
      "rust",
      "typescript",
    ]);
    expect(parseSelectedImplementationIds("")).toEqual([]);
    expect(parseSelectedImplementationIds(undefined)).toEqual([]);
  });

  it("rejects unknown selected client or server adapters", () => {
    expect(() =>
      validateImplementationSelection(clientImplementations, "X402_INTEROP_CLIENTS", {
        X402_INTEROP_CLIENTS: "perl",
      }),
    ).toThrowError(/X402_INTEROP_CLIENTS contains unknown adapter id\(s\): perl/);

    expect(() =>
      validateImplementationSelection(serverImplementations, "X402_INTEROP_SERVERS", {
        X402_INTEROP_SERVERS: "perl",
      }),
    ).toThrowError(/X402_INTEROP_SERVERS contains unknown adapter id\(s\): perl/);
  });

  it("does not fail selected planned adapters once their scaffold manifest exists", () => {
    expect(() =>
      validateSelectedImplementationScaffolds(
        [
          {
            id: "lua",
            label: "Lua HTTP server",
            role: "server" as const,
            adapterStatus: "scaffold" as const,
            command: ["lua", "bin/interop-server.lua"],
            cwd: "../../lua",
            requiredManifest: "../../lua/x402-sdk-svm.rockspec",
            enabled: true,
            runtimeSchemes: ["exact" as const],
            runtimeIntents: [],
          },
        ],
        "X402_INTEROP_SERVERS",
      ),
    ).not.toThrow();
  });
});
