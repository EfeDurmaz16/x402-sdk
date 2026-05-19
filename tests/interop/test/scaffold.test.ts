import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatSdkScaffoldReport,
  getSdkScaffoldStatus,
  sdkScaffoldDefinitions,
} from "../src/scaffold";

describe("SDK scaffold diagnostics", () => {
  it("tracks the planned language roots and manifests", () => {
    expect(sdkScaffoldDefinitions).toEqual([
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
    ]);
  });

  it("reports current runtime adapter and scaffold state", () => {
    expect(getSdkScaffoldStatus()).toContainEqual(
      expect.objectContaining({
        language: "rust",
        rootExists: true,
        manifestExists: true,
        runtimeClientAdapter: true,
        runtimeServerAdapter: true,
      }),
    );
    expect(getSdkScaffoldStatus()).toContainEqual(
      expect.objectContaining({
        language: "php",
        rootExists: false,
        manifestExists: false,
        serverOnly: true,
        runtimeClientAdapter: false,
        runtimeServerAdapter: false,
      }),
    );
  });

  it("formats maintainer-readable scaffold diagnostics", () => {
    expect(formatSdkScaffoldReport()).toContain(
      "language:typescript root:present manifest:present(package.json)",
    );
    expect(formatSdkScaffoldReport()).toContain(
      "language:lua root:missing manifest:missing(x402-sdk-svm.rockspec) server-only:true",
    );
  });

  it("exposes scaffold diagnostics as package scripts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.scaffold).toBe("tsx src/print-scaffold.ts");
    expect(packageJson.scripts["scaffold:json"]).toBe("tsx src/print-scaffold.ts --json");
  });
});
