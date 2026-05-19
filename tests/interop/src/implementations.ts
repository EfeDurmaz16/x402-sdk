import type { InteropRuntimeScheme } from "./contracts";

export type ImplementationDefinition = {
  id: string;
  label: string;
  role: "client" | "server";
  command: string[];
  enabled: boolean;
  runtimeSchemes: InteropRuntimeScheme[];
  runtimeIntents: string[];
};

function isEnabled(id: string, envName: string, defaultEnabled: boolean): boolean {
  const selected = parseSelectedImplementationIds(process.env[envName]);
  if (selected.length === 0) {
    return defaultEnabled;
  }

  return selected.includes(id);
}

export function parseSelectedImplementationIds(selected?: string): string[] {
  if (!selected || selected.trim() === "") {
    return [];
  }

  return selected
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

export function validateImplementationSelection(
  implementations: ImplementationDefinition[],
  envName: string,
  env: Record<string, string | undefined> = process.env,
): void {
  const selected = parseSelectedImplementationIds(env[envName]);
  if (selected.length === 0) {
    return;
  }

  const knownIds = new Set(implementations.map(implementation => implementation.id));
  const unknownIds = selected.filter(id => !knownIds.has(id));
  if (unknownIds.length > 0) {
    throw new Error(
      `${envName} contains unknown adapter id(s): ${unknownIds.join(",")}. Known adapters: ${[
        ...knownIds,
      ].join(",")}`,
    );
  }
}

export const clientImplementations: ImplementationDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript HTTP client",
    role: "client",
    command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/client.ts"],
    enabled: isEnabled("typescript", "X402_INTEROP_CLIENTS", true),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "rust",
    label: "Rust HTTP client",
    role: "client",
    command: [
      "cargo",
      "run",
      "--quiet",
      "--manifest-path",
      "../../rust/Cargo.toml",
      "--bin",
      "interop_client",
    ],
    enabled: isEnabled("rust", "X402_INTEROP_CLIENTS", true),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
];

export const serverImplementations: ImplementationDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript HTTP server",
    role: "server",
    command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/server.ts"],
    enabled: isEnabled("typescript", "X402_INTEROP_SERVERS", true),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "rust",
    label: "Rust HTTP server",
    role: "server",
    command: [
      "cargo",
      "run",
      "--quiet",
      "--manifest-path",
      "../../rust/Cargo.toml",
      "--bin",
      "interop_server",
    ],
    enabled: isEnabled("rust", "X402_INTEROP_SERVERS", true),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
];

validateImplementationSelection(clientImplementations, "X402_INTEROP_CLIENTS");
validateImplementationSelection(serverImplementations, "X402_INTEROP_SERVERS");
