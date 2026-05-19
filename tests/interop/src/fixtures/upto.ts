export type UptoScenarioFixture = {
  id:
    | "settles-actual-below-maximum"
    | "allows-zero-settlement"
    | "rejects-over-maximum-settlement"
    | "rejects-missing-settlement-override"
    | "rejects-wrong-scheme";
  scheme: "upto" | "exact";
  settlementSemantics: "maximum-authorization";
  maximumAmount: string;
  settlementAmount?: string;
  expectedOutcome: "success" | "reject";
  rejectionReason?:
    | "settlement-exceeds-maximum"
    | "missing-settlement-override"
    | "wrong-scheme";
};

export type UptoSolanaDesignGate = {
  runtimeEligible: false;
  requiredDecisions: Array<
    | "authorization-primitive"
    | "single-use-replay-model"
    | "actual-settlement-authority"
    | "zero-settlement-behavior"
    | "recipient-ata-policy"
    | "over-maximum-enforcement"
  >;
};

export type UptoLanguageRoleFixture = {
  language: "rust" | "typescript" | "python" | "go" | "ruby" | "lua" | "php";
  clientRole: "planned" | "missing";
  serverRole: "planned" | "experimental";
};

export const uptoLanguageRoleFixtures: UptoLanguageRoleFixture[] = [
  { language: "rust", clientRole: "planned", serverRole: "experimental" },
  { language: "typescript", clientRole: "planned", serverRole: "experimental" },
  { language: "python", clientRole: "planned", serverRole: "planned" },
  { language: "go", clientRole: "planned", serverRole: "planned" },
  { language: "ruby", clientRole: "planned", serverRole: "planned" },
  { language: "lua", clientRole: "missing", serverRole: "planned" },
  { language: "php", clientRole: "missing", serverRole: "planned" },
];

export const uptoSolanaDesignGate: UptoSolanaDesignGate = {
  runtimeEligible: false,
  requiredDecisions: [
    "authorization-primitive",
    "single-use-replay-model",
    "actual-settlement-authority",
    "zero-settlement-behavior",
    "recipient-ata-policy",
    "over-maximum-enforcement",
  ],
};

export const uptoScenarioFixtures: UptoScenarioFixture[] = [
  {
    id: "settles-actual-below-maximum",
    scheme: "upto",
    settlementSemantics: "maximum-authorization",
    maximumAmount: "1000",
    settlementAmount: "600",
    expectedOutcome: "success",
  },
  {
    id: "allows-zero-settlement",
    scheme: "upto",
    settlementSemantics: "maximum-authorization",
    maximumAmount: "1000",
    settlementAmount: "0",
    expectedOutcome: "success",
  },
  {
    id: "rejects-over-maximum-settlement",
    scheme: "upto",
    settlementSemantics: "maximum-authorization",
    maximumAmount: "1000",
    settlementAmount: "1001",
    expectedOutcome: "reject",
    rejectionReason: "settlement-exceeds-maximum",
  },
  {
    id: "rejects-missing-settlement-override",
    scheme: "upto",
    settlementSemantics: "maximum-authorization",
    maximumAmount: "1000",
    expectedOutcome: "reject",
    rejectionReason: "missing-settlement-override",
  },
  {
    id: "rejects-wrong-scheme",
    scheme: "exact",
    settlementSemantics: "maximum-authorization",
    maximumAmount: "1000",
    settlementAmount: "600",
    expectedOutcome: "reject",
    rejectionReason: "wrong-scheme",
  },
];
