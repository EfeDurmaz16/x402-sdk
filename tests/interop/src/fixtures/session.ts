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
