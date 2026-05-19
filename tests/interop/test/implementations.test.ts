import { describe, expect, it } from "vitest";
import {
  clientImplementations,
  parseSelectedImplementationIds,
  serverImplementations,
  validateImplementationSelection,
} from "../src/implementations";
import { formatCapabilityRoles } from "../src/capabilities";

describe("interop implementation metadata", () => {
  it("marks current runtime adapters as exact-only", () => {
    const implementations = [...clientImplementations, ...serverImplementations];

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
      serverImplementations.map(implementation => ({
        id: implementation.id,
        runtimeSchemes: implementation.runtimeSchemes,
      })),
    ).toEqual([
      { id: "typescript", runtimeSchemes: ["exact"] },
      { id: "rust", runtimeSchemes: ["exact"] },
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
        X402_INTEROP_CLIENTS: "python",
      }),
    ).toThrowError(/X402_INTEROP_CLIENTS contains unknown adapter id\(s\): python/);

    expect(() =>
      validateImplementationSelection(serverImplementations, "X402_INTEROP_SERVERS", {
        X402_INTEROP_SERVERS: "php",
      }),
    ).toThrowError(/X402_INTEROP_SERVERS contains unknown adapter id\(s\): php/);
  });
});
