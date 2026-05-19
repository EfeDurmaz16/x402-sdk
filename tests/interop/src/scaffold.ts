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
  expectedClientCommand?: string[];
  expectedServerCommand: string[];
};

export type SdkScaffoldStatus = SdkScaffoldDefinition & {
  rootExists: boolean;
  manifestExists: boolean;
  runtimeClientAdapter: boolean;
  runtimeServerAdapter: boolean;
};

export const sdkScaffoldDefinitions: SdkScaffoldDefinition[] = [
  {
    language: "rust",
    root: "../../rust",
    manifest: "Cargo.toml",
    serverOnly: false,
    planned: true,
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
    expectedClientCommand: ["python3", "-m", "x402_sdk.interop.client"],
    expectedServerCommand: ["python3", "-m", "x402_sdk.interop.server"],
  },
  {
    language: "go",
    root: "../../go",
    manifest: "go.mod",
    serverOnly: false,
    planned: true,
    expectedClientCommand: ["go", "run", "./cmd/interop-client"],
    expectedServerCommand: ["go", "run", "./cmd/interop-server"],
  },
  {
    language: "ruby",
    root: "../../ruby",
    manifest: "Gemfile",
    serverOnly: false,
    planned: true,
    expectedClientCommand: ["bundle", "exec", "ruby", "bin/interop-client"],
    expectedServerCommand: ["bundle", "exec", "ruby", "bin/interop-server"],
  },
  {
    language: "lua",
    root: "../../lua",
    manifest: "x402-sdk-svm.rockspec",
    serverOnly: true,
    planned: true,
    expectedServerCommand: ["lua", "bin/interop-server.lua"],
  },
  {
    language: "php",
    root: "../../php",
    manifest: "composer.json",
    serverOnly: true,
    planned: true,
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

    return {
      ...definition,
      rootExists: existsSync(rootPath),
      manifestExists,
      runtimeClientAdapter,
      runtimeServerAdapter,
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
        `expected-client:${status.expectedClientCommand?.join(" ") ?? "none"}`,
        `expected-server:${status.expectedServerCommand.join(" ")}`,
      ].join(" ");
    })
    .join("\n");
}
