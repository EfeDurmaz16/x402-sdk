import { describe, expect, it } from "vitest";
import { uptoScenarioFixtures, uptoSolanaDesignGate } from "../src/fixtures/upto";

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
});
