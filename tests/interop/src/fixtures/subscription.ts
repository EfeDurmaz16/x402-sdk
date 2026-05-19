export type SubscriptionIntentFixture = {
  action: "challenge" | "activate" | "renewal" | "cancel";
  intent: "subscription";
  nativeX402Scheme: false;
  billingModel: "recurring-fixed-amount";
  expectedOutcome: "unsupported" | "accepted-shape";
  unsupportedReason?: "subscription-intent-not-native-x402-scheme";
  periodUnit?: "day" | "week";
  periodCount?: string;
  amountPerPeriod?: string;
};

export const subscriptionIntentFixtures: SubscriptionIntentFixture[] = [
  {
    action: "challenge",
    intent: "subscription",
    nativeX402Scheme: false,
    billingModel: "recurring-fixed-amount",
    expectedOutcome: "unsupported",
    unsupportedReason: "subscription-intent-not-native-x402-scheme",
    periodUnit: "week",
    periodCount: "1",
    amountPerPeriod: "1000",
  },
  {
    action: "activate",
    intent: "subscription",
    nativeX402Scheme: false,
    billingModel: "recurring-fixed-amount",
    expectedOutcome: "accepted-shape",
    periodUnit: "week",
    periodCount: "1",
    amountPerPeriod: "1000",
  },
  {
    action: "renewal",
    intent: "subscription",
    nativeX402Scheme: false,
    billingModel: "recurring-fixed-amount",
    expectedOutcome: "accepted-shape",
    periodUnit: "week",
    periodCount: "1",
    amountPerPeriod: "1000",
  },
  {
    action: "cancel",
    intent: "subscription",
    nativeX402Scheme: false,
    billingModel: "recurring-fixed-amount",
    expectedOutcome: "accepted-shape",
  },
];
