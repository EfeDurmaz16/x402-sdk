import { describe, expect, it } from "vitest";
import { sessionIntentFixtures } from "../src/fixtures/session";

describe("session intent fixtures", () => {
  it("defines the planned session lifecycle shapes before implementation", () => {
    expect(sessionIntentFixtures.map(fixture => fixture.action)).toEqual([
      "challenge",
      "open",
      "voucher",
      "topUp",
      "close",
    ]);
  });

  it("marks session as a compatibility intent instead of a native x402 scheme", () => {
    const challenge = sessionIntentFixtures.find(fixture => fixture.action === "challenge");

    expect(challenge).toMatchObject({
      intent: "session",
      nativeX402Scheme: false,
      expectedOutcome: "unsupported",
      unsupportedReason: "session-intent-not-native-x402-scheme",
    });
  });

  it("keeps vouchers cumulative for session compatibility planning", () => {
    const voucher = sessionIntentFixtures.find(fixture => fixture.action === "voucher");

    expect(voucher).toMatchObject({
      intent: "session",
      cumulativeAmount: "600",
      previousCumulativeAmount: "400",
    });
  });
});
