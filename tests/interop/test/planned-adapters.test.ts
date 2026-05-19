import { spawnSync } from "node:child_process";
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { clientImplementations, serverImplementations } from "../src/implementations";
import { runClient, startServer, stopServer } from "../src/process";

type RunningServer = Awaited<ReturnType<typeof startServer>>;

const runningServers: RunningServer[] = [];
const challengeServers: http.Server[] = [];

const plannedClientIds = ["python", "go", "ruby"] as const;
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

async function startChallengeServer(): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer((_request, response) => {
    const body = JSON.stringify({ error: "payment_required" });
    response.writeHead(402, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });
    response.end(body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind planned adapter challenge server");
  }

  challengeServers.push(server);
  return { server, url: `http://127.0.0.1:${address.port}/protected` };
}

afterEach(async () => {
  while (challengeServers.length > 0) {
    const server = challengeServers.pop();
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await stopServer(server);
    }
  }
});

describe("planned client adapter process contract", () => {
  for (const id of plannedClientIds) {
    it(`${id} client reports the scaffold failure shape after reading a 402 challenge`, async () => {
      const implementation = clientImplementations.find(client => client.id === id);
      expect(implementation, `missing ${id} client implementation`).toBeDefined();

      if (!implementation) {
        return;
      }

      const command = implementation.command[0];
      const { url } = await startChallengeServer();
      if (!hasCommand(command)) {
        await expect(runClient(implementation, url)).rejects.toThrow(
          new RegExp(`Failed to start adapter command: spawn ${command} ENOENT`),
        );
        return;
      }

      await expect(runClient(implementation, url)).resolves.toMatchObject({
        type: "result",
        implementation: id,
        role: "client",
        ok: false,
        status: 402,
        responseBody: {
          error: `${id}_exact_client_not_implemented`,
          challengeStatus: 402,
          challengeBody: JSON.stringify({ error: "payment_required" }),
        },
        settlement: null,
      });
    });
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
