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
  },
  {
    language: "typescript",
    root: "../../typescript",
    manifest: "package.json",
    serverOnly: false,
    planned: true,
  },
  {
    language: "python",
    root: "../../python",
    manifest: "pyproject.toml",
    serverOnly: false,
    planned: true,
  },
  {
    language: "go",
    root: "../../go",
    manifest: "go.mod",
    serverOnly: false,
    planned: true,
  },
  {
    language: "ruby",
    root: "../../ruby",
    manifest: "Gemfile",
    serverOnly: false,
    planned: true,
  },
  {
    language: "lua",
    root: "../../lua",
    manifest: "x402-sdk-svm.rockspec",
    serverOnly: true,
    planned: true,
  },
  {
    language: "php",
    root: "../../php",
    manifest: "composer.json",
    serverOnly: true,
    planned: true,
  },
];

export function getSdkScaffoldStatus(
  cwd: string = process.cwd(),
): SdkScaffoldStatus[] {
  return sdkScaffoldDefinitions.map(definition => {
    const runtimeClientAdapter = clientImplementations.some(
      implementation => implementation.id === definition.language,
    );
    const runtimeServerAdapter = serverImplementations.some(
      implementation => implementation.id === definition.language,
    );
    const rootPath = join(cwd, definition.root);

    return {
      ...definition,
      rootExists: existsSync(rootPath),
      manifestExists: existsSync(join(rootPath, definition.manifest)),
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
      ].join(" ");
    })
    .join("\n");
}
