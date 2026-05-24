import { describe, expect, it } from "vitest";
import { buildInteropAcceptsList } from "../src/fixtures/typescript/server";
import { interopScenario } from "../src/contracts";

describe("typescript interop server accepts list", () => {
  it("emits integer extra.decimals on every accept entry, including USDC", () => {
    const accepts = buildInteropAcceptsList({
      network: interopScenario.network,
      payTo: "11111111111111111111111111111111",
      extraOfferedMints: [
        "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD mainnet
        "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", // USDG mainnet
        "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH", // CASH mainnet
      ],
    });

    expect(accepts.length).toBeGreaterThan(1);
    for (const entry of accepts) {
      expect(entry.price.extra).toBeDefined();
      expect(typeof entry.price.extra.decimals).toBe("number");
      expect(Number.isInteger(entry.price.extra.decimals)).toBe(true);
      expect(entry.price.extra.decimals).toBe(6);
    }
  });

  it("uses the canonical scenario asset for the primary entry", () => {
    const [primary] = buildInteropAcceptsList({
      network: interopScenario.network,
      payTo: "11111111111111111111111111111111",
      extraOfferedMints: [],
    });

    expect(primary.price.asset).toBe(interopScenario.asset);
    expect(primary.price.extra.decimals).toBe(6);
  });
});
