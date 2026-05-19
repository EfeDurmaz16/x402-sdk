import { formatCapabilitySummary } from "./capabilities";

export type AdapterKind = "client" | "server";

export type InteropRuntimeScheme = "exact";

export type InteropScenario = {
  scheme: InteropRuntimeScheme;
  network: string;
  price: string;
  asset: string;
  resourcePath: string;
  settlementHeader: string;
};

export type ReadyMessage = {
  type: "ready";
  implementation: string;
  role: AdapterKind;
  port?: number;
  capabilities?: string[];
};

export type ClientRunResult = {
  type: "result";
  implementation: string;
  role: "client";
  ok: boolean;
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  settlement?: unknown;
};

export type AdapterMessage = ReadyMessage | ClientRunResult;

export const interopScenario: InteropScenario = {
  scheme: "exact",
  network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  price: "$0.001",
  asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  resourcePath: "/protected",
  settlementHeader: "x-fixture-settlement",
};

export function resolveInteropScenario(
  env: Record<string, string | undefined> = process.env,
): InteropScenario {
  const requestedScheme = env.X402_INTEROP_SCHEME?.trim() || "exact";
  if (requestedScheme === "exact") {
    return interopScenario;
  }

  throw new Error(
    [
      `X402_INTEROP_SCHEME=${requestedScheme} is not enabled for runtime interop yet.`,
      "Capability summary:",
      ...formatCapabilitySummary(),
    ].join("\n"),
  );
}
