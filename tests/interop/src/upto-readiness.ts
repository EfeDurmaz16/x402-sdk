export type UptoSourceTruth = {
  scheme: "upto";
  availability: {
    networks: "evm-only";
    sdkLanguages: Array<"typescript" | "go" | "python">;
  };
  authorization: {
    evmPrimitive: "permit2";
    unsupportedForUpto: Array<"eip3009">;
  };
  settlement: {
    paymentRequirementsAmountAtVerification: "maximum";
    paymentRequirementsAmountAtSettlement: "actual";
    actualAmountMustBeLessThanOrEqualMaximum: true;
    zeroSettlementRequiresChainWrite: false;
    singleUseAuthorization: true;
  };
  docs: {
    sellerQuickstart: string;
    schemeSpec: string;
    evmSchemeSpec: string;
  };
};

export type UptoLocalReadinessGap = {
  id:
    | "no-official-svm-upto"
    | "no-client-authorization-envelope"
    | "no-facilitator-settlement-authority"
    | "no-zero-settlement-proof"
    | "no-over-maximum-enforcement";
  blocksRuntime: true;
  evidenceRequired: string;
};

export const uptoSourceTruth: UptoSourceTruth = {
  scheme: "upto",
  availability: {
    networks: "evm-only",
    sdkLanguages: ["typescript", "go", "python"],
  },
  authorization: {
    evmPrimitive: "permit2",
    unsupportedForUpto: ["eip3009"],
  },
  settlement: {
    paymentRequirementsAmountAtVerification: "maximum",
    paymentRequirementsAmountAtSettlement: "actual",
    actualAmountMustBeLessThanOrEqualMaximum: true,
    zeroSettlementRequiresChainWrite: false,
    singleUseAuthorization: true,
  },
  docs: {
    sellerQuickstart: "https://docs.cdp.coinbase.com/x402/quickstart-for-sellers",
    schemeSpec:
      "https://github.com/coinbase/x402/blob/main/specs/schemes/upto/scheme_upto.md",
    evmSchemeSpec:
      "https://github.com/coinbase/x402/blob/main/specs/schemes/upto/scheme_upto_evm.md",
  },
};

export const uptoLocalReadinessGaps: UptoLocalReadinessGap[] = [
  {
    id: "no-official-svm-upto",
    blocksRuntime: true,
    evidenceRequired: "official x402 SVM upto scheme document or maintainer-approved design",
  },
  {
    id: "no-client-authorization-envelope",
    blocksRuntime: true,
    evidenceRequired: "single-use client authorization that permits charging less than the cap",
  },
  {
    id: "no-facilitator-settlement-authority",
    blocksRuntime: true,
    evidenceRequired: "facilitator path that can settle the actual amount without rewriting a signed transfer",
  },
  {
    id: "no-zero-settlement-proof",
    blocksRuntime: true,
    evidenceRequired: "zero-settlement test proving no on-chain transaction is required",
  },
  {
    id: "no-over-maximum-enforcement",
    blocksRuntime: true,
    evidenceRequired: "shared rejection test for settlement amounts above the authorized maximum",
  },
];

export function isUptoRuntimeReadyForNetwork(network: string): boolean {
  return network.startsWith("eip155:");
}

export function formatUptoReadinessReport(): string {
  const lines = [
    "x402 upto readiness",
    `availability: ${uptoSourceTruth.availability.networks}`,
    `authorization: ${uptoSourceTruth.authorization.evmPrimitive}`,
    `sdk-languages: ${uptoSourceTruth.availability.sdkLanguages.join(",")}`,
    "svm-runtime: blocked",
  ];

  for (const gap of uptoLocalReadinessGaps) {
    lines.push(`gap:${gap.id} evidence:${gap.evidenceRequired}`);
  }

  return lines.join("\n");
}
