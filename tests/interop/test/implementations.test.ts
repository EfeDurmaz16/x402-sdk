import { describe, expect, it } from "vitest";
import { clientImplementations, serverImplementations } from "../src/implementations";

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
});
