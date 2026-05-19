import { describe, expect, it } from "vitest";
import { resolveInteropScenario } from "../src/contracts";

describe("interop scenario selection", () => {
  it("defaults to the exact runtime scenario", () => {
    expect(resolveInteropScenario({}).scheme).toBe("exact");
  });

  it("rejects unsupported runtime schemes with capability diagnostics", () => {
    expect(() =>
      resolveInteropScenario({
        X402_INTEROP_SCHEME: "upto",
      }),
    ).toThrowError(/X402_INTEROP_SCHEME=upto is not enabled for runtime interop yet/);

    expect(() =>
      resolveInteropScenario({
        X402_INTEROP_SCHEME: "upto",
      }),
    ).toThrowError(/experimental: upto server rust,typescript/);
  });

  it("rejects compatibility intents until runtime scenarios exist", () => {
    expect(() =>
      resolveInteropScenario({
        X402_INTEROP_INTENT: "session",
      }),
    ).toThrowError(/X402_INTEROP_INTENT=session is not enabled for runtime interop yet/);

    expect(() =>
      resolveInteropScenario({
        X402_INTEROP_INTENT: "subscription",
      }),
    ).toThrowError(/planned: subscription client\/server go,python,ruby/);
  });
});
