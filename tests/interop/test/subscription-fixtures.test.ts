import { describe, expect, it } from "vitest";
import { subscriptionIntentFixtures } from "../src/fixtures/subscription";

describe("subscription intent fixtures", () => {
  it("defines subscription as recurring billing rather than metered session usage", () => {
    const challenge = subscriptionIntentFixtures.find(fixture => fixture.action === "challenge");

    expect(challenge).toMatchObject({
      intent: "subscription",
      nativeX402Scheme: false,
      billingModel: "recurring-fixed-amount",
      expectedOutcome: "unsupported",
      unsupportedReason: "subscription-intent-not-native-x402-scheme",
    });
  });

  it("keeps activation, renewal, and cancellation shapes separate", () => {
    expect(subscriptionIntentFixtures.map(fixture => fixture.action)).toEqual([
      "challenge",
      "activate",
      "renewal",
      "cancel",
    ]);
  });

  it("does not use cumulative voucher semantics", () => {
    expect(subscriptionIntentFixtures).not.toContainEqual(
      expect.objectContaining({
        cumulativeAmount: expect.any(String),
      }),
    );
  });
});
