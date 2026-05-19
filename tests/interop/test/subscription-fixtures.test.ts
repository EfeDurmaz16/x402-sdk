import { describe, expect, it } from "vitest";
import {
  subscriptionIntentFixtures,
  subscriptionLanguageRoleFixtures,
} from "../src/fixtures/subscription";
import { interopCapabilities } from "../src/capabilities";

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

  it("keeps PHP and Lua server-only while Python, Go, and Ruby plan both roles", () => {
    expect(subscriptionLanguageRoleFixtures).toEqual([
      { language: "python", clientRole: "planned", serverRole: "planned" },
      { language: "go", clientRole: "planned", serverRole: "planned" },
      { language: "ruby", clientRole: "planned", serverRole: "planned" },
      { language: "lua", clientRole: "missing", serverRole: "planned" },
      { language: "php", clientRole: "missing", serverRole: "planned" },
    ]);
  });

  it("keeps subscription language role fixtures aligned with capability metadata", () => {
    const byLanguage = (left: { language: string }, right: { language: string }) =>
      left.language.localeCompare(right.language);

    expect(
      subscriptionLanguageRoleFixtures.map(fixture => ({
        language: fixture.language,
        client: fixture.clientRole,
        server: fixture.serverRole,
      })).sort(byLanguage),
    ).toEqual(
      Object.entries(interopCapabilities.intents.subscription.languages).map(
        ([language, roles]) => ({
          language,
          client: roles.client,
          server: roles.server,
        }),
      ).sort(byLanguage),
    );
  });
});
