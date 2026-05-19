export type ExactNegativeFixture = {
  id:
    | "rejects-network-mismatch"
    | "rejects-unsupported-scheme"
    | "rejects-missing-fee-payer"
    | "rejects-missing-recipient-ata";
  scheme: "exact" | "unsupported";
  acceptedNetwork: string;
  requiredNetwork: string;
  expectedReason:
    | "network_mismatch"
    | "unsupported_scheme"
    | "missing_fee_payer"
    | "missing_recipient_ata";
  requiresSignedTransaction: boolean;
};

export type ExactCoverageGapFixture = {
  id: "tracks-split-payments" | "tracks-ata-creation-required";
  requestedBy: "maintainer";
  currentStatus: "missing-runtime-contract" | "covered-by-runtime-boundary";
  expectedHarnessAction: "add-fixture-before-runtime" | "promote-existing-boundary";
  notes: string;
};

export const SOLANA_DEVNET_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

export const exactNegativeFixtures: ExactNegativeFixture[] = [
  {
    id: "rejects-network-mismatch",
    scheme: "exact",
    acceptedNetwork: SOLANA_MAINNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "network_mismatch",
    requiresSignedTransaction: false,
  },
  {
    id: "rejects-unsupported-scheme",
    scheme: "unsupported",
    acceptedNetwork: SOLANA_DEVNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "unsupported_scheme",
    requiresSignedTransaction: false,
  },
  {
    id: "rejects-missing-fee-payer",
    scheme: "exact",
    acceptedNetwork: SOLANA_DEVNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "missing_fee_payer",
    requiresSignedTransaction: false,
  },
  {
    id: "rejects-missing-recipient-ata",
    scheme: "exact",
    acceptedNetwork: SOLANA_DEVNET_CAIP2,
    requiredNetwork: SOLANA_DEVNET_CAIP2,
    expectedReason: "missing_recipient_ata",
    requiresSignedTransaction: true,
  },
];

export const exactCoverageGapFixtures: ExactCoverageGapFixture[] = [
  {
    id: "tracks-split-payments",
    requestedBy: "maintainer",
    currentStatus: "missing-runtime-contract",
    expectedHarnessAction: "add-fixture-before-runtime",
    notes:
      "No SVM exact split-payment wire contract is exposed yet; keep this visible before adding runtime assertions.",
  },
  {
    id: "tracks-ata-creation-required",
    requestedBy: "maintainer",
    currentStatus: "covered-by-runtime-boundary",
    expectedHarnessAction: "promote-existing-boundary",
    notes:
      "Missing recipient ATA is already covered as a settlement-time rejection; promote to an explicit ataCreationRequired contract once the field is defined.",
  },
];
