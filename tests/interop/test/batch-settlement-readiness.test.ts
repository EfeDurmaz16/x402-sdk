import { describe, expect, it } from "vitest";
import {
  assertSvmBatchSettlementRuntimeReady,
  batchSettlementScheme,
  batchSettlementSourceTruth,
  currentBatchSettlementBindings,
  formatBatchSettlementReadinessReport,
  getBatchSettlementBinding,
  requiredSvmBindingDecisions,
} from "../src/batch-settlement-readiness";

describe("batch-settlement readiness", () => {
  it("tracks the official scheme name and source truth", () => {
    expect(batchSettlementScheme).toBe("batch-settlement");
    expect(batchSettlementSourceTruth.docs).toContain("/schemes/batch-settlement");
    expect(batchSettlementSourceTruth.evmSpec).toContain("scheme_batch_settlement_evm.md");
  });

  it("marks EVM as implemented and Solana as blocked until an SVM binding exists", () => {
    expect(getBatchSettlementBinding("eip155:84532")).toMatchObject({ status: "implemented" });
    expect(getBatchSettlementBinding("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z")).toMatchObject({
      status: "blocked",
    });
  });

  it("keeps the SVM decision gate explicit", () => {
    expect(requiredSvmBindingDecisions).toContain("voucher-commitment-format");
    expect(requiredSvmBindingDecisions).toContain("claim-settle-refund-timeout-transactions");
    expect(() => assertSvmBatchSettlementRuntimeReady([])).toThrow(/missing: channel-or-escrow-account-model/);
    expect(() => assertSvmBatchSettlementRuntimeReady(requiredSvmBindingDecisions)).not.toThrow();
  });

  it("does not accidentally advertise Solana runtime support", () => {
    const solanaBindings = currentBatchSettlementBindings.filter((binding) => binding.network.startsWith("solana:"));

    expect(solanaBindings).toHaveLength(1);
    expect(solanaBindings[0]?.status).toBe("blocked");
  });

  it("prints a maintainer-readable readiness report", () => {
    const report = formatBatchSettlementReadinessReport();

    expect(report).toContain("x402 batch-settlement readiness");
    expect(report).toContain("- solana:*: blocked");
    expect(report).toContain("required SVM decisions:");
  });
});
