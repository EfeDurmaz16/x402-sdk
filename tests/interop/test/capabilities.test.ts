import { describe, expect, it } from "vitest";
import { formatCapabilityReport, interopCapabilities } from "../src/capabilities";

describe("interop capability roadmap", () => {
  it("keeps usage-based x402 work planned before implementation starts", () => {
    expect(interopCapabilities.schemes.upto).toMatchObject({
      intentBoundary: "x402-scheme",
      settlementSemantics: "maximum-authorization",
      solanaSemantics: "requires-design",
      defaultCi: false,
      status: "planned",
    });

    expect(interopCapabilities.schemes.upto.languages).toMatchObject({
      typescript: { client: "planned", server: "planned" },
      rust: { client: "planned", server: "planned" },
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

  it("formats planned and server-only capability gaps for maintainer diagnostics", () => {
    expect(formatCapabilityReport()).toContain(
      "scheme:upto planned semantics:maximum-authorization solana:requires-design default-ci:false",
    );
    expect(formatCapabilityReport()).toContain("intent:session planned native-x402:false");
    expect(formatCapabilityReport()).toContain("lua client:missing server:planned");
    expect(formatCapabilityReport()).toContain("php client:missing server:planned");
  });
});
