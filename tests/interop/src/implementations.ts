import { existsSync } from "node:fs";
import { join } from "node:path";
import type { InteropRuntimeScheme } from "./contracts";

export type ImplementationDefinition = {
  id: string;
  label: string;
  role: "client" | "server";
  adapterStatus: "implemented" | "scaffold";
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  requiredManifest?: string;
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

export function validateSelectedImplementationScaffolds(
  implementations: ImplementationDefinition[],
  envName: string,
  cwd: string = process.cwd(),
): void {
  const missing = implementations.filter(implementation => {
    if (!implementation.enabled || !implementation.requiredManifest) {
      return false;
    }

    return !existsSync(join(cwd, implementation.requiredManifest));
  });

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `${envName} selected adapter(s) without SDK scaffold: ${missing
      .map(implementation => `${implementation.id} missing ${implementation.requiredManifest}`)
      .join("; ")}`,
  );
}

export const clientImplementations: ImplementationDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript HTTP client",
    role: "client",
    adapterStatus: "implemented",
    command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/client.ts"],
    enabled: isEnabled("typescript", "X402_INTEROP_CLIENTS", true),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "rust",
    label: "Rust HTTP client",
    role: "client",
    adapterStatus: "implemented",
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
  {
    id: "python",
    label: "Python HTTP client",
    role: "client",
    adapterStatus: "scaffold",
    command: ["python3", "-m", "x402_sdk.interop.client"],
    cwd: "../../python",
    env: { PYTHONPATH: "src" },
    requiredManifest: "../../python/pyproject.toml",
    enabled: isEnabled("python", "X402_INTEROP_CLIENTS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "go",
    label: "Go HTTP client",
    role: "client",
    adapterStatus: "scaffold",
    command: ["go", "run", "./cmd/interop-client"],
    cwd: "../../go",
    requiredManifest: "../../go/go.mod",
    enabled: isEnabled("go", "X402_INTEROP_CLIENTS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "ruby",
    label: "Ruby HTTP client",
    role: "client",
    adapterStatus: "scaffold",
    command: ["ruby", "bin/interop-client"],
    cwd: "../../ruby",
    requiredManifest: "../../ruby/Gemfile",
    enabled: isEnabled("ruby", "X402_INTEROP_CLIENTS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
];

export const serverImplementations: ImplementationDefinition[] = [
  {
    id: "typescript",
    label: "TypeScript HTTP server",
    role: "server",
    adapterStatus: "implemented",
    command: ["pnpm", "exec", "node", "--import", "tsx", "src/fixtures/typescript/server.ts"],
    enabled: isEnabled("typescript", "X402_INTEROP_SERVERS", true),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "rust",
    label: "Rust HTTP server",
    role: "server",
    adapterStatus: "implemented",
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
  {
    id: "python",
    label: "Python HTTP server",
    role: "server",
    adapterStatus: "scaffold",
    command: ["python3", "-m", "x402_sdk.interop.server"],
    cwd: "../../python",
    env: { PYTHONPATH: "src" },
    requiredManifest: "../../python/pyproject.toml",
    enabled: isEnabled("python", "X402_INTEROP_SERVERS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "go",
    label: "Go HTTP server",
    role: "server",
    adapterStatus: "scaffold",
    command: ["go", "run", "./cmd/interop-server"],
    cwd: "../../go",
    requiredManifest: "../../go/go.mod",
    enabled: isEnabled("go", "X402_INTEROP_SERVERS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "ruby",
    label: "Ruby HTTP server",
    role: "server",
    adapterStatus: "scaffold",
    command: ["ruby", "bin/interop-server"],
    cwd: "../../ruby",
    requiredManifest: "../../ruby/Gemfile",
    enabled: isEnabled("ruby", "X402_INTEROP_SERVERS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "lua",
    label: "Lua HTTP server",
    role: "server",
    adapterStatus: "scaffold",
    command: ["lua", "bin/interop-server.lua"],
    cwd: "../../lua",
    requiredManifest: "../../lua/x402-sdk-svm.rockspec",
    enabled: isEnabled("lua", "X402_INTEROP_SERVERS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
  {
    id: "php",
    label: "PHP HTTP server",
    role: "server",
    adapterStatus: "scaffold",
    command: ["php", "bin/interop-server.php"],
    cwd: "../../php",
    requiredManifest: "../../php/composer.json",
    enabled: isEnabled("php", "X402_INTEROP_SERVERS", false),
    runtimeSchemes: ["exact"],
    runtimeIntents: [],
  },
];

validateImplementationSelection(clientImplementations, "X402_INTEROP_CLIENTS");
validateImplementationSelection(serverImplementations, "X402_INTEROP_SERVERS");
validateSelectedImplementationScaffolds(clientImplementations, "X402_INTEROP_CLIENTS");
validateSelectedImplementationScaffolds(serverImplementations, "X402_INTEROP_SERVERS");
