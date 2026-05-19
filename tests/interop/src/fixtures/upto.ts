export type UptoScenarioFixture = {
  id:
    | "settles-actual-below-maximum"
    | "allows-zero-settlement"
    | "rejects-over-maximum-settlement"
    | "rejects-missing-settlement-override"
    | "rejects-wrong-scheme";
  scheme: "upto" | "exact";
  maximumAmount: string;
  settlementAmount?: string;
  expectedOutcome: "success" | "reject";
  rejectionReason?:
    | "settlement-exceeds-maximum"
    | "missing-settlement-override"
    | "wrong-scheme";
};

export const uptoScenarioFixtures: UptoScenarioFixture[] = [
  {
    id: "settles-actual-below-maximum",
    scheme: "upto",
    maximumAmount: "1000",
    settlementAmount: "600",
    expectedOutcome: "success",
  },
  {
    id: "allows-zero-settlement",
    scheme: "upto",
    maximumAmount: "1000",
    settlementAmount: "0",
    expectedOutcome: "success",
  },
  {
    id: "rejects-over-maximum-settlement",
    scheme: "upto",
    maximumAmount: "1000",
    settlementAmount: "1001",
    expectedOutcome: "reject",
    rejectionReason: "settlement-exceeds-maximum",
  },
  {
    id: "rejects-missing-settlement-override",
    scheme: "upto",
    maximumAmount: "1000",
    expectedOutcome: "reject",
    rejectionReason: "missing-settlement-override",
  },
  {
    id: "rejects-wrong-scheme",
    scheme: "exact",
    maximumAmount: "1000",
    settlementAmount: "600",
    expectedOutcome: "reject",
    rejectionReason: "wrong-scheme",
  },
];
