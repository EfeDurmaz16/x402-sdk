import { describe, expect, it } from "vitest";
import {
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
});
