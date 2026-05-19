import { describe, expect, it } from "vitest";
import { runClient, startServer } from "../src/process";
import type { ImplementationDefinition } from "../src/implementations";

function implementation(command: string[], role: "client" | "server"): ImplementationDefinition {
  return {
    id: "expected",
    label: "Expected adapter",
    role,
    command,
    enabled: true,
  };
}

describe("interop process harness", () => {
  it("rejects a server adapter that reports a different implementation id", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'ready',",
        "implementation: 'other',",
        "role: 'server',",
        "port: 1234",
        "}));",
        "setInterval(() => {}, 1000);",
      ].join(""),
    ];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      "Server adapter expected reported implementation other",
    );
  });

  it("includes the server adapter id when readiness output is invalid JSON", async () => {
    const command = [process.execPath, "-e", "console.log('not json')"];

    await expect(startServer(implementation(command, "server"))).rejects.toThrow(
      "server adapter expected wrote invalid JSON while waiting for server readiness: not json",
    );
  });

  it("rejects a client adapter that reports a different implementation id", async () => {
    const command = [
      process.execPath,
      "-e",
      [
        "console.log(JSON.stringify({",
        "type: 'result',",
        "implementation: 'other',",
        "role: 'client',",
        "ok: true,",
        "status: 200,",
        "responseHeaders: {},",
        "responseBody: {}",
        "}));",
      ].join(""),
    ];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      "Client adapter expected reported implementation other",
    );
  });

  it("includes the client adapter id when result output is invalid JSON", async () => {
    const command = [process.execPath, "-e", "console.log('not json')"];

    await expect(runClient(implementation(command, "client"), "http://127.0.0.1")).rejects.toThrow(
      "client adapter expected wrote invalid JSON while waiting for client result: not json",
    );
  });
});
