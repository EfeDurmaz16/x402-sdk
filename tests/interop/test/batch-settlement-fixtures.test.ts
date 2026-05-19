import { describe, expect, it } from "vitest";
import { interopCapabilities } from "../src/capabilities";
import {
  batchSettlementLanguageRoleFixtures,
  batchSettlementSchemeFixtures,
  validateBatchSettlementSchemeFixtures,
} from "../src/fixtures/batch-settlement";

describe("batch-settlement scheme fixtures", () => {
  it("defines the planned batch settlement lifecycle shapes before implementation", () => {
    expect(batchSettlementSchemeFixtures.map(fixture => fixture.action)).toEqual([
      "challenge",
      "deposit",
      "voucher",
      "redeem",
      "close",
    ]);
  });

  it("marks batch settlement as a native scheme that is not runtime-ready on Solana", () => {
    const challenge = batchSettlementSchemeFixtures.find(
      fixture => fixture.action === "challenge",
    );

    expect(challenge).toMatchObject({
      scheme: "batch-settlement",
      nativeX402Scheme: true,
      settlementSemantics: "batched-voucher",
      expectedOutcome: "unsupported",
      unsupportedReason: "solana-batch-settlement-requires-design",
      maximumAmount: "1000",
    });
  });

  it("keeps batch vouchers cumulative like session vouchers", () => {
    const voucher = batchSettlementSchemeFixtures.find(fixture => fixture.action === "voucher");

    expect(voucher).toMatchObject({
      scheme: "batch-settlement",
      previousCumulativeAmount: "400",
      cumulativeAmount: "600",
    });
  });

  it("validates the experimental batch-settlement contract without enabling runtime support", () => {
    expect(validateBatchSettlementSchemeFixtures(batchSettlementSchemeFixtures)).toMatchObject({
      ok: true,
      defaultCi: false,
      supportedRuntime: false,
      actions: ["challenge", "deposit", "voucher", "redeem", "close"],
    });
  });

  it("rejects non-cumulative batch voucher fixtures", () => {
    expect(
      validateBatchSettlementSchemeFixtures([
        {
          action: "challenge",
          scheme: "batch-settlement",
          nativeX402Scheme: true,
          settlementSemantics: "batched-voucher",
          expectedOutcome: "unsupported",
          unsupportedReason: "solana-batch-settlement-requires-design",
        },
        {
          action: "voucher",
          scheme: "batch-settlement",
          nativeX402Scheme: true,
          settlementSemantics: "batched-voucher",
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

  it("keeps PHP and Lua server-only for batch settlement while other SDKs track both roles", () => {
    expect(batchSettlementLanguageRoleFixtures).toEqual([
      { language: "rust", clientRole: "planned", serverRole: "planned" },
      { language: "typescript", clientRole: "planned", serverRole: "planned" },
      { language: "python", clientRole: "planned", serverRole: "planned" },
      { language: "go", clientRole: "planned", serverRole: "planned" },
      { language: "ruby", clientRole: "planned", serverRole: "planned" },
      { language: "lua", clientRole: "missing", serverRole: "planned" },
      { language: "php", clientRole: "missing", serverRole: "planned" },
    ]);
  });

  it("keeps batch-settlement language roles aligned with capability metadata", () => {
    const byLanguage = (left: { language: string }, right: { language: string }) =>
      left.language.localeCompare(right.language);

    expect(
      batchSettlementLanguageRoleFixtures.map(fixture => ({
        language: fixture.language,
        client: fixture.clientRole,
        server: fixture.serverRole,
      })).sort(byLanguage),
    ).toEqual(
      Object.entries(interopCapabilities.schemes["batch-settlement"].languages).map(
        ([language, roles]) => ({
          language,
          client: roles.client,
          server: roles.server,
        }),
      ).sort(byLanguage),
    );
  });
});
