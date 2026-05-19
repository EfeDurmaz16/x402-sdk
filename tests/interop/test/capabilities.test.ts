import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatCapabilityReport,
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
    expect(formatCapabilityReport()).toContain("intent:session planned native-x402:false");
    expect(formatCapabilityReport()).toContain("intent:subscription planned native-x402:false");
    expect(formatCapabilityReport()).toContain("lua client:missing server:planned");
    expect(formatCapabilityReport()).toContain("php client:missing server:planned");
  });

  it("summarizes implemented, planned, and missing roles for runner diagnostics", () => {
    expect(formatCapabilitySummary()).toEqual([
      "implemented: exact client/server rust,typescript",
      "planned: upto client/server go,python,ruby,rust",
      "experimental: upto server typescript",
      "planned: upto server-only lua,php",
      "missing: upto client lua,php",
      "planned: session client/server go,python,ruby",
      "planned: session server-only lua,php",
      "missing: session client lua,php",
      "planned: subscription client/server go,python,ruby",
      "planned: subscription server-only lua,php",
      "missing: subscription client lua,php",
    ]);
  });

  it("exposes capability diagnostics as a package script", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.capabilities).toBe(
      "tsx src/print-capabilities.ts",
    );
  });
});
