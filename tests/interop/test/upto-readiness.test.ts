import { describe, expect, it } from "vitest";
import {
  formatUptoReadinessReport,
  isUptoRuntimeReadyForNetwork,
  uptoLocalReadinessGaps,
  uptoSourceTruth,
} from "../src/upto-readiness";

describe("upto readiness", () => {
  it("pins the official upto availability before Solana runtime work", () => {
    expect(uptoSourceTruth).toMatchObject({
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
    });
  });

  it("does not mark Solana networks as runtime-ready for upto", () => {
    expect(isUptoRuntimeReadyForNetwork("eip155:84532")).toBe(true);
    expect(isUptoRuntimeReadyForNetwork("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(false);
    expect(isUptoRuntimeReadyForNetwork("solana:mainnet")).toBe(false);
  });

  it("keeps local Solana gaps explicit and blocking", () => {
    expect(uptoLocalReadinessGaps.map(gap => gap.id)).toEqual([
      "no-official-svm-upto",
      "no-client-authorization-envelope",
      "no-facilitator-settlement-authority",
      "no-zero-settlement-proof",
      "no-over-maximum-enforcement",
    ]);
    expect(uptoLocalReadinessGaps.every(gap => gap.blocksRuntime)).toBe(true);
  });

  it("prints a concise report for PR review", () => {
    expect(formatUptoReadinessReport()).toContain("availability: evm-only");
    expect(formatUptoReadinessReport()).toContain("svm-runtime: blocked");
    expect(formatUptoReadinessReport()).toContain("gap:no-official-svm-upto");
  });
});
