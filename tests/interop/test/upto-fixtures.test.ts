import { describe, expect, it } from "vitest";
import { uptoScenarioFixtures } from "../src/fixtures/upto";

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
      maximumAmount: "1000",
      settlementAmount: "1001",
      expectedOutcome: "reject",
      rejectionReason: "settlement-exceeds-maximum",
    });
  });
});
