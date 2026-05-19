import { describe, expect, it } from "vitest";
import {
  exactCoverageGapFixtures,
  exactNegativeFixtures,
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
} from "../src/fixtures/exact";

describe("exact negative fixtures", () => {
  it("tracks the current rejection cases requested for interop coverage", () => {
    expect(exactNegativeFixtures.map(fixture => fixture.id)).toEqual([
      "rejects-network-mismatch",
      "rejects-unsupported-scheme",
      "rejects-missing-fee-payer",
      "rejects-missing-recipient-ata",
    ]);
  });

  it("keeps network mismatch explicit and pre-transaction", () => {
    const fixture = exactNegativeFixtures.find(
      candidate => candidate.id === "rejects-network-mismatch",
    );

    expect(fixture).toMatchObject({
      scheme: "exact",
      acceptedNetwork: SOLANA_MAINNET_CAIP2,
      requiredNetwork: SOLANA_DEVNET_CAIP2,
      expectedReason: "network_mismatch",
      requiresSignedTransaction: false,
    });
  });

  it("does not require generated transactions for early facilitator rejections", () => {
    const earlyRejections = exactNegativeFixtures.filter(
      fixture => fixture.id !== "rejects-missing-recipient-ata",
    );

    expect(earlyRejections.every(fixture => !fixture.requiresSignedTransaction)).toBe(true);
  });

  it("tracks missing recipient ATA as a settlement-time rejection", () => {
    const fixture = exactNegativeFixtures.find(
      candidate => candidate.id === "rejects-missing-recipient-ata",
    );

    expect(fixture).toMatchObject({
      scheme: "exact",
      acceptedNetwork: SOLANA_DEVNET_CAIP2,
      requiredNetwork: SOLANA_DEVNET_CAIP2,
      expectedReason: "missing_recipient_ata",
      requiresSignedTransaction: true,
    });
  });

  it("keeps maintainer-requested coverage gaps visible before runtime support lands", () => {
    expect(exactCoverageGapFixtures).toEqual([
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
    ]);
  });
});
