import { describe, expect, it } from "vitest";
import {
  uptoAuthorizationCandidates,
  uptoLanguageRoleFixtures,
  uptoScenarioFixtures,
  uptoSolanaDesignGate,
} from "../src/fixtures/upto";
import { interopCapabilities } from "../src/capabilities";

describe("upto scenario fixtures", () => {
  it("defines the planned positive and negative cases before implementation", () => {
    expect(uptoScenarioFixtures.map(fixture => fixture.id)).toEqual([
      "settles-actual-below-maximum",
      "allows-zero-settlement",
      "rejects-over-maximum-settlement",
      "rejects-missing-settlement-override",
      "rejects-wrong-scheme",
    ]);
  });

  it("keeps maximum authorization and actual settlement amounts explicit", () => {
    const fixture = uptoScenarioFixtures.find(
      candidate => candidate.id === "settles-actual-below-maximum",
    );

    expect(fixture).toMatchObject({
      scheme: "upto",
      settlementSemantics: "maximum-authorization",
      maximumAmount: "1000",
      settlementAmount: "600",
      expectedOutcome: "success",
    });
  });

  it("marks over-maximum settlement as a harness-level rejection", () => {
    const fixture = uptoScenarioFixtures.find(
      candidate => candidate.id === "rejects-over-maximum-settlement",
    );

    expect(fixture).toMatchObject({
      scheme: "upto",
      settlementSemantics: "maximum-authorization",
      maximumAmount: "1000",
      settlementAmount: "1001",
      expectedOutcome: "reject",
      rejectionReason: "settlement-exceeds-maximum",
    });
  });

  it("does not let upto fixtures collapse into exact fixed-amount semantics", () => {
    expect(
      uptoScenarioFixtures.every(
        fixture => fixture.settlementSemantics === "maximum-authorization",
      ),
    ).toBe(true);
  });

  it("keeps Solana upto runtime behind explicit protocol decisions", () => {
    expect(uptoSolanaDesignGate).toEqual({
      runtimeEligible: false,
      requiredDecisions: [
        "authorization-primitive",
        "single-use-replay-model",
        "actual-settlement-authority",
        "zero-settlement-behavior",
        "recipient-ata-policy",
        "over-maximum-enforcement",
      ],
    });
  });

  it("defines non-runtime authorization candidates before client implementation", () => {
    expect(uptoAuthorizationCandidates).toEqual([
      {
        id: "signed-message-authorization",
        runtimeEligible: false,
        authorizationPrimitive: "signed-message",
        settlementModel: "facilitator-built-transfer",
        requiredFields: [
          "payer",
          "payee",
          "mint",
          "maximumAmount",
          "resource",
          "paymentId",
          "expiration",
          "nonce",
        ],
        blocker: "missing-delegated-token-authority",
      },
      {
        id: "escrow-channel-authorization",
        runtimeEligible: false,
        authorizationPrimitive: "escrow-channel",
        settlementModel: "escrow-redemption",
        requiredFields: [
          "payer",
          "payee",
          "mint",
          "depositAmount",
          "channelId",
          "cumulativeAmount",
          "expiration",
          "nonce",
        ],
        blocker: "requires-escrow-program-design",
      },
    ]);
  });

  it("keeps fixed signed transfers out of Solana upto authorization candidates", () => {
    expect(
      uptoAuthorizationCandidates.some(
        candidate => candidate.authorizationPrimitive === "signed-message",
      ),
    ).toBe(true);
    expect(
      uptoAuthorizationCandidates.every(
        candidate => candidate.authorizationPrimitive !== "signed-transfer",
      ),
    ).toBe(true);
  });

  it("keeps PHP and Lua server-only for upto while other planned SDKs track both roles", () => {
    expect(uptoLanguageRoleFixtures).toEqual([
      { language: "rust", clientRole: "planned", serverRole: "experimental" },
      { language: "typescript", clientRole: "planned", serverRole: "experimental" },
      { language: "python", clientRole: "planned", serverRole: "planned" },
      { language: "go", clientRole: "planned", serverRole: "planned" },
      { language: "ruby", clientRole: "planned", serverRole: "planned" },
      { language: "lua", clientRole: "missing", serverRole: "planned" },
      { language: "php", clientRole: "missing", serverRole: "planned" },
    ]);
  });

  it("keeps upto language role fixtures aligned with capability metadata", () => {
    const byLanguage = (left: { language: string }, right: { language: string }) =>
      left.language.localeCompare(right.language);

    expect(
      uptoLanguageRoleFixtures.map(fixture => ({
        language: fixture.language,
        client: fixture.clientRole,
        server: fixture.serverRole,
      })).sort(byLanguage),
    ).toEqual(
      Object.entries(interopCapabilities.schemes.upto.languages).map(
        ([language, roles]) => ({
          language,
          client: roles.client,
          server: roles.server,
        }),
      ).sort(byLanguage),
    );
  });
});
