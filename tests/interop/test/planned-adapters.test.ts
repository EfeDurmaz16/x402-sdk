import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { serverImplementations } from "../src/implementations";
import { startServer, stopServer } from "../src/process";

type RunningServer = Awaited<ReturnType<typeof startServer>>;

const runningServers: RunningServer[] = [];

const plannedServerIds = ["python", "go", "ruby", "lua", "php"] as const;

function hasCommand(command: string): boolean {
  const result = spawnSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
  return result.status === 0;
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url);
  const body = await response.json();
  return { status: response.status, body };
}

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await stopServer(server);
    }
  }
});

describe("planned server adapter process contract", () => {
  for (const id of plannedServerIds) {
    it(`${id} server exposes readiness, health, and scaffold failure shape`, async () => {
      const implementation = serverImplementations.find(server => server.id === id);
      expect(implementation, `missing ${id} server implementation`).toBeDefined();

      if (!implementation) {
        return;
      }

      const command = implementation.command[0];
      if (!hasCommand(command)) {
        await expect(startServer(implementation)).rejects.toThrow(
          new RegExp(`Failed to start adapter command: spawn ${command} ENOENT`),
        );
        return;
      }

      const server = await startServer(implementation);
      runningServers.push(server);

      expect(server.ready).toMatchObject({
        type: "ready",
        implementation: id,
        role: "server",
        capabilities: ["exact"],
      });

      const baseUrl = `http://127.0.0.1:${server.ready.port}`;
      await expect(getJson(`${baseUrl}/health`)).resolves.toEqual({
        status: 200,
        body: { ok: true },
      });

      await expect(getJson(`${baseUrl}/protected`)).resolves.toEqual({
        status: 501,
        body: {
          ok: false,
          paid: false,
          error: `${id}_exact_server_not_implemented`,
        },
      });
    });
  }
});
