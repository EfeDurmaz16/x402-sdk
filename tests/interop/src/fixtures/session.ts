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

export type SessionSafetyRequirement = {
  id:
    | "durable-write-before-delivery"
    | "cumulative-voucher-monotonicity"
    | "top-up-without-channel-reset"
    | "cooperative-and-forced-close";
  required: true;
  failureMode:
    | "unpaid-service-after-crash"
    | "voucher-replay-or-regression"
    | "unnecessary-channel-close"
    | "locked-funds-without-exit";
};

export type SessionLanguageRoleFixture = {
  language: "python" | "go" | "ruby" | "lua" | "php";
  clientRole: "planned" | "missing";
  serverRole: "planned";
};

export const sessionLanguageRoleFixtures: SessionLanguageRoleFixture[] = [
  { language: "python", clientRole: "planned", serverRole: "planned" },
  { language: "go", clientRole: "planned", serverRole: "planned" },
  { language: "ruby", clientRole: "planned", serverRole: "planned" },
  { language: "lua", clientRole: "missing", serverRole: "planned" },
  { language: "php", clientRole: "missing", serverRole: "planned" },
];

export const sessionSafetyRequirements: SessionSafetyRequirement[] = [
  {
    id: "durable-write-before-delivery",
    required: true,
    failureMode: "unpaid-service-after-crash",
  },
  {
    id: "cumulative-voucher-monotonicity",
    required: true,
    failureMode: "voucher-replay-or-regression",
  },
  {
    id: "top-up-without-channel-reset",
    required: true,
    failureMode: "unnecessary-channel-close",
  },
  {
    id: "cooperative-and-forced-close",
    required: true,
    failureMode: "locked-funds-without-exit",
  },
];

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
