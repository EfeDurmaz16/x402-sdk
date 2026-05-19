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

export type SubscriptionLanguageRoleFixture = {
  language: "python" | "go" | "ruby" | "lua" | "php";
  clientRole: "planned" | "missing";
  serverRole: "planned";
};

export const subscriptionLanguageRoleFixtures: SubscriptionLanguageRoleFixture[] = [
  { language: "python", clientRole: "planned", serverRole: "planned" },
  { language: "go", clientRole: "planned", serverRole: "planned" },
  { language: "ruby", clientRole: "planned", serverRole: "planned" },
  { language: "lua", clientRole: "missing", serverRole: "planned" },
  { language: "php", clientRole: "missing", serverRole: "planned" },
];

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
