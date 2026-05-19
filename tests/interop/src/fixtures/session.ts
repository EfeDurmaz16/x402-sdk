export type SessionIntentFixture = {
  action: "challenge" | "open" | "voucher" | "topUp" | "close";
  intent: "session";
  nativeX402Scheme: false;
  expectedOutcome: "unsupported" | "accepted-shape";
  unsupportedReason?: "session-intent-not-native-x402-scheme";
  cumulativeAmount?: string;
  previousCumulativeAmount?: string;
};

export const sessionIntentFixtures: SessionIntentFixture[] = [
  {
    action: "challenge",
    intent: "session",
    nativeX402Scheme: false,
    expectedOutcome: "unsupported",
    unsupportedReason: "session-intent-not-native-x402-scheme",
  },
  {
    action: "open",
    intent: "session",
    nativeX402Scheme: false,
    expectedOutcome: "accepted-shape",
    cumulativeAmount: "0",
  },
  {
    action: "voucher",
    intent: "session",
    nativeX402Scheme: false,
    expectedOutcome: "accepted-shape",
    previousCumulativeAmount: "400",
    cumulativeAmount: "600",
  },
  {
    action: "topUp",
    intent: "session",
    nativeX402Scheme: false,
    expectedOutcome: "accepted-shape",
  },
  {
    action: "close",
    intent: "session",
    nativeX402Scheme: false,
    expectedOutcome: "accepted-shape",
    cumulativeAmount: "600",
  },
];

export type SessionFixtureValidationResult =
  | {
      ok: true;
      defaultCi: false;
      supportedRuntime: false;
      actions: SessionIntentFixture["action"][];
    }
  | {
      ok: false;
      reason:
        | "missing-session-challenge"
        | "session-must-remain-compatibility-intent"
        | "voucher-cumulative-amount-must-increase";
    };

export function validateSessionIntentFixtures(
  fixtures: SessionIntentFixture[],
): SessionFixtureValidationResult {
  const challenge = fixtures.find(fixture => fixture.action === "challenge");
  if (!challenge) {
    return { ok: false, reason: "missing-session-challenge" };
  }

  if (fixtures.some(fixture => fixture.nativeX402Scheme !== false)) {
    return { ok: false, reason: "session-must-remain-compatibility-intent" };
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
