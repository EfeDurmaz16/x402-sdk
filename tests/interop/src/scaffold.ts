import { existsSync } from "node:fs";
import { join } from "node:path";
import { clientImplementations, serverImplementations } from "./implementations";

export type SdkLanguage =
  | "rust"
  | "typescript"
  | "python"
  | "go"
  | "ruby"
  | "lua"
  | "php";

export type SdkScaffoldDefinition = {
  language: SdkLanguage;
  root: string;
  manifest: string;
  serverOnly: boolean;
  planned: boolean;
  plannedClientBoundaries?: string[];
  plannedServerBoundaries: string[];
  expectedClientCommand?: string[];
  expectedServerCommand: string[];
};

export type SdkScaffoldStatus = SdkScaffoldDefinition & {
  rootExists: boolean;
  manifestExists: boolean;
  runtimeClientAdapter: boolean;
  runtimeServerAdapter: boolean;
  implementedClientAdapter: boolean;
  implementedServerAdapter: boolean;
};

export const sdkScaffoldDefinitions: SdkScaffoldDefinition[] = [
  {
    language: "rust",
    root: "../../rust",
    manifest: "Cargo.toml",
    serverOnly: false,
    planned: true,
    plannedClientBoundaries: ["exact"],
    plannedServerBoundaries: ["exact", "upto"],
    expectedClientCommand: [
      "cargo",
      "run",
      "--quiet",
      "--manifest-path",
      "../../rust/Cargo.toml",
      "--bin",
      "interop_client",
    ],
    expectedServerCommand: [
      "cargo",
      "run",
      "--quiet",
      "--manifest-path",
      "../../rust/Cargo.toml",
      "--bin",
      "interop_server",
    ],
  },
  {
    language: "typescript",
    root: "../../typescript",
    manifest: "package.json",
    serverOnly: false,
    planned: true,
    plannedClientBoundaries: ["exact"],
    plannedServerBoundaries: ["exact", "upto"],
    expectedClientCommand: [
      "pnpm",
      "exec",
      "node",
      "--import",
      "tsx",
      "src/fixtures/typescript/client.ts",
    ],
    expectedServerCommand: [
      "pnpm",
      "exec",
      "node",
      "--import",
      "tsx",
      "src/fixtures/typescript/server.ts",
    ],
  },
  {
    language: "python",
    root: "../../python",
    manifest: "pyproject.toml",
    serverOnly: false,
    planned: true,
    plannedClientBoundaries: ["exact", "upto", "session"],
    plannedServerBoundaries: ["exact", "upto", "session"],
    expectedClientCommand: ["python3", "-m", "x402_sdk.interop.client"],
    expectedServerCommand: ["python3", "-m", "x402_sdk.interop.server"],
  },
  {
    language: "go",
    root: "../../go",
    manifest: "go.mod",
    serverOnly: false,
    planned: true,
    plannedClientBoundaries: ["exact", "upto", "session"],
    plannedServerBoundaries: ["exact", "upto", "session"],
    expectedClientCommand: ["go", "run", "./cmd/interop-client"],
    expectedServerCommand: ["go", "run", "./cmd/interop-server"],
  },
  {
    language: "ruby",
    root: "../../ruby",
    manifest: "Gemfile",
    serverOnly: false,
    planned: true,
    plannedClientBoundaries: ["exact", "upto", "session"],
    plannedServerBoundaries: ["exact", "upto", "session"],
    expectedClientCommand: ["ruby", "bin/interop-client"],
    expectedServerCommand: ["ruby", "bin/interop-server"],
  },
  {
    language: "lua",
    root: "../../lua",
    manifest: "x402-sdk-svm.rockspec",
    serverOnly: true,
    planned: true,
    plannedServerBoundaries: ["exact", "upto", "session"],
    expectedServerCommand: ["lua", "bin/interop-server.lua"],
  },
  {
    language: "php",
    root: "../../php",
    manifest: "composer.json",
    serverOnly: true,
    planned: true,
    plannedServerBoundaries: ["exact", "upto", "session"],
    expectedServerCommand: ["php", "bin/interop-server.php"],
  },
];

export function getSdkScaffoldStatus(
  cwd: string = process.cwd(),
): SdkScaffoldStatus[] {
  return sdkScaffoldDefinitions.map(definition => {
    const rootPath = join(cwd, definition.root);
    const manifestExists = existsSync(join(rootPath, definition.manifest));
    const runtimeClientAdapter =
      manifestExists &&
      clientImplementations.some(implementation => implementation.id === definition.language);
    const runtimeServerAdapter =
      manifestExists &&
      serverImplementations.some(implementation => implementation.id === definition.language);
    const implementedClientAdapter =
      manifestExists &&
      clientImplementations.some(
        implementation =>
          implementation.id === definition.language &&
          implementation.adapterStatus === "implemented",
      );
    const implementedServerAdapter =
      manifestExists &&
      serverImplementations.some(
        implementation =>
          implementation.id === definition.language &&
          implementation.adapterStatus === "implemented",
      );

    return {
      ...definition,
      rootExists: existsSync(rootPath),
      manifestExists,
      runtimeClientAdapter,
      runtimeServerAdapter,
      implementedClientAdapter,
      implementedServerAdapter,
    };
  });
}

export function formatSdkScaffoldReport(statuses = getSdkScaffoldStatus()): string {
  return statuses
    .map(status => {
      return [
        `language:${status.language}`,
        `root:${status.rootExists ? "present" : "missing"}`,
        `manifest:${status.manifestExists ? "present" : "missing"}(${status.manifest})`,
        `server-only:${status.serverOnly}`,
        `runtime-client:${status.runtimeClientAdapter}`,
        `runtime-server:${status.runtimeServerAdapter}`,
        `implemented-client:${status.implementedClientAdapter}`,
        `implemented-server:${status.implementedServerAdapter}`,
        `planned-client-boundaries:${status.plannedClientBoundaries?.join(",") ?? "none"}`,
        `planned-server-boundaries:${status.plannedServerBoundaries.join(",")}`,
        `expected-client:${status.expectedClientCommand?.join(" ") ?? "none"}`,
        `expected-server:${status.expectedServerCommand.join(" ")}`,
      ].join(" ");
    })
    .join("\n");
}
