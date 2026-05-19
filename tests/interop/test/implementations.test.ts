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
        runtimeSchemes: implementation.runtimeSchemes,
        runtimeIntents: implementation.runtimeIntents,
      })),
    ).toEqual([
      {
        id: "typescript",
        role: "client",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
      {
        id: "rust",
        role: "client",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
      {
        id: "typescript",
        role: "server",
        runtimeSchemes: ["exact"],
        runtimeIntents: [],
      },
      {
        id: "rust",
        role: "server",
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

  it("registers opt-in Go, Python, and Lua adapter commands without enabling them by default", () => {
    expect(
      clientImplementations.map(implementation => ({
        id: implementation.id,
        enabled: implementation.enabled,
        command: implementation.command,
        cwd: implementation.cwd,
        requiredManifest: implementation.requiredManifest,
      })),
    ).toEqual([
      {
        id: "typescript",
        enabled: true,
        command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/client.ts"],
        cwd: undefined,
        requiredManifest: undefined,
      },
      {
        id: "rust",
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
        requiredManifest: undefined,
      },
      {
        id: "python",
        enabled: false,
        command: ["python", "-m", "x402_sdk.interop.client"],
        cwd: "../../python",
        requiredManifest: "../../python/pyproject.toml",
      },
      {
        id: "go",
        enabled: false,
        command: ["go", "run", "./cmd/interop-client"],
        cwd: "../../go",
        requiredManifest: "../../go/go.mod",
      },
    ]);

    expect(
      serverImplementations.map(implementation => ({
        id: implementation.id,
        enabled: implementation.enabled,
        command: implementation.command,
        cwd: implementation.cwd,
        requiredManifest: implementation.requiredManifest,
      })),
    ).toEqual([
      {
        id: "typescript",
        enabled: true,
        command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/server.ts"],
        cwd: undefined,
        requiredManifest: undefined,
      },
      {
        id: "rust",
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
        requiredManifest: undefined,
      },
      {
        id: "python",
        enabled: false,
        command: ["python", "-m", "x402_sdk.interop.server"],
        cwd: "../../python",
        requiredManifest: "../../python/pyproject.toml",
      },
      {
        id: "go",
        enabled: false,
        command: ["go", "run", "./cmd/interop-server"],
        cwd: "../../go",
        requiredManifest: "../../go/go.mod",
      },
      {
        id: "lua",
        enabled: false,
        command: ["lua", "bin/interop-server.lua"],
        cwd: "../../lua",
        requiredManifest: "../../lua/x402-sdk-svm.rockspec",
      },
      {
        id: "php",
        enabled: false,
        command: ["php", "bin/interop-server.php"],
        cwd: "../../php",
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

  it("fails selected planned adapters with a scaffold-specific diagnostic", () => {
    expect(() =>
      validateSelectedImplementationScaffolds(
        [
          {
            id: "python",
            label: "Python HTTP client",
            role: "client",
            command: ["python", "-m", "x402_sdk.interop.client"],
            cwd: "../../python",
            requiredManifest: "../../python/pyproject.toml",
            enabled: true,
            runtimeSchemes: ["exact"],
            runtimeIntents: [],
          },
        ],
        "X402_INTEROP_CLIENTS",
      ),
    ).toThrowError(
      /X402_INTEROP_CLIENTS selected adapter\(s\) without SDK scaffold: python missing \.\.\/\.\.\/python\/pyproject\.toml/,
    );
  });
});
