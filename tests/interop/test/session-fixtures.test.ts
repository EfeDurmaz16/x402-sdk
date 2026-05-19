import { describe, expect, it } from "vitest";
import {
  sessionIntentFixtures,
  sessionLanguageRoleFixtures,
  validateSessionIntentFixtures,
} from "../src/fixtures/session";
import { interopCapabilities } from "../src/capabilities";

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

  it("validates the experimental session contract without enabling runtime support", () => {
    expect(validateSessionIntentFixtures(sessionIntentFixtures)).toMatchObject({
      ok: true,
      defaultCi: false,
      supportedRuntime: false,
      actions: ["challenge", "open", "voucher", "topUp", "close"],
    });
  });

  it("rejects non-cumulative voucher fixtures", () => {
    expect(
      validateSessionIntentFixtures([
        {
          action: "challenge",
          intent: "session",
          nativeX402Scheme: false,
          expectedOutcome: "unsupported",
          unsupportedReason: "session-intent-not-native-x402-scheme",
        },
        {
          action: "voucher",
          intent: "session",
          nativeX402Scheme: false,
          expectedOutcome: "accepted-shape",
          previousCumulativeAmount: "600",
          cumulativeAmount: "400",
        },
      ]),
    ).toMatchObject({
      ok: false,
      reason: "voucher-cumulative-amount-must-increase",
    });
  });

  it("keeps PHP and Lua server-only while Python, Go, and Ruby plan both roles", () => {
    expect(sessionLanguageRoleFixtures).toEqual([
      { language: "python", clientRole: "planned", serverRole: "planned" },
      { language: "go", clientRole: "planned", serverRole: "planned" },
      { language: "ruby", clientRole: "planned", serverRole: "planned" },
      { language: "lua", clientRole: "missing", serverRole: "planned" },
      { language: "php", clientRole: "missing", serverRole: "planned" },
    ]);
  });

  it("keeps session language role fixtures aligned with capability metadata", () => {
    const byLanguage = (left: { language: string }, right: { language: string }) =>
      left.language.localeCompare(right.language);

    expect(
      sessionLanguageRoleFixtures.map(fixture => ({
        language: fixture.language,
        client: fixture.clientRole,
        server: fixture.serverRole,
      })).sort(byLanguage),
    ).toEqual(
      Object.entries(interopCapabilities.intents.session.languages).map(
        ([language, roles]) => ({
          language,
          client: roles.client,
          server: roles.server,
        }),
      ).sort(byLanguage),
    );
  });
});
