export type BatchSettlementSchemeFixture = {
  action: "challenge" | "deposit" | "voucher" | "redeem" | "close";
  scheme: "batch-settlement";
  nativeX402Scheme: true;
  settlementSemantics: "batched-voucher";
  expectedOutcome: "unsupported" | "accepted-shape";
  unsupportedReason?: "solana-batch-settlement-requires-design";
  maximumAmount?: string;
  cumulativeAmount?: string;
  previousCumulativeAmount?: string;
};

export type BatchSettlementLanguageRoleFixture = {
  language: "rust" | "typescript" | "python" | "go" | "ruby" | "lua" | "php";
  clientRole: "planned" | "missing";
  serverRole: "planned";
};

export const batchSettlementLanguageRoleFixtures: BatchSettlementLanguageRoleFixture[] = [
  { language: "rust", clientRole: "planned", serverRole: "planned" },
  { language: "typescript", clientRole: "planned", serverRole: "planned" },
  { language: "python", clientRole: "planned", serverRole: "planned" },
  { language: "go", clientRole: "planned", serverRole: "planned" },
  { language: "ruby", clientRole: "planned", serverRole: "planned" },
  { language: "lua", clientRole: "missing", serverRole: "planned" },
  { language: "php", clientRole: "missing", serverRole: "planned" },
];

export const batchSettlementSchemeFixtures: BatchSettlementSchemeFixture[] = [
  {
    action: "challenge",
    scheme: "batch-settlement",
    nativeX402Scheme: true,
    settlementSemantics: "batched-voucher",
    expectedOutcome: "unsupported",
    unsupportedReason: "solana-batch-settlement-requires-design",
    maximumAmount: "1000",
  },
  {
    action: "deposit",
    scheme: "batch-settlement",
    nativeX402Scheme: true,
    settlementSemantics: "batched-voucher",
    expectedOutcome: "accepted-shape",
    maximumAmount: "5000",
  },
  {
    action: "voucher",
    scheme: "batch-settlement",
    nativeX402Scheme: true,
    settlementSemantics: "batched-voucher",
    expectedOutcome: "accepted-shape",
    previousCumulativeAmount: "400",
    cumulativeAmount: "600",
  },
  {
    action: "redeem",
    scheme: "batch-settlement",
    nativeX402Scheme: true,
    settlementSemantics: "batched-voucher",
    expectedOutcome: "accepted-shape",
    cumulativeAmount: "600",
  },
  {
    action: "close",
    scheme: "batch-settlement",
    nativeX402Scheme: true,
    settlementSemantics: "batched-voucher",
    expectedOutcome: "accepted-shape",
    cumulativeAmount: "600",
  },
];

export type BatchSettlementFixtureValidationResult =
  | {
      ok: true;
      defaultCi: false;
      supportedRuntime: false;
      actions: BatchSettlementSchemeFixture["action"][];
    }
  | {
      ok: false;
      reason:
        | "missing-batch-settlement-challenge"
        | "batch-settlement-must-remain-native-x402-scheme"
        | "voucher-cumulative-amount-must-increase";
    };

export function validateBatchSettlementSchemeFixtures(
  fixtures: BatchSettlementSchemeFixture[],
): BatchSettlementFixtureValidationResult {
  const challenge = fixtures.find(fixture => fixture.action === "challenge");
  if (!challenge) {
    return { ok: false, reason: "missing-batch-settlement-challenge" };
  }

  if (fixtures.some(fixture => fixture.nativeX402Scheme !== true)) {
    return { ok: false, reason: "batch-settlement-must-remain-native-x402-scheme" };
  }

  for (const fixture of fixtures) {
    if (fixture.action !== "voucher") {
      continue;
    }

    const previous = BigInt(fixture.previousCumulativeAmount ?? "0");
    const current = BigInt(fixture.cumulativeAmount ?? "0");
    if (current <= previous) {
      return { ok: false, reason: "voucher-cumulative-amount-must-increase" };
    }
  }

  return {
    ok: true,
    defaultCi: false,
    supportedRuntime: false,
    actions: fixtures.map(fixture => fixture.action),
  };
}
