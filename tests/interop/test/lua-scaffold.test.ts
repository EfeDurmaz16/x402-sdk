import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Lua server-only scaffold", () => {
  const server = readFileSync("../../lua/bin/interop-server.lua", "utf8");
  const rockspec = readFileSync("../../lua/x402-sdk-svm.rockspec", "utf8");

  it("publishes a server-only readiness contract", () => {
    expect(server).toContain('{ "implementation", "lua" }');
    expect(server).toContain('{ "role", "server" }');
    expect(server).toContain('{ "capabilities", { "exact" } }');
  });

  it("keeps health and planned exact settlement behavior explicit", () => {
    expect(server).toContain('path == "/health"');
    expect(server).toContain("lua_exact_server_not_implemented");
  });

  it("keeps planned upto server behavior explicit", () => {
    expect(server).toContain('path == "/upto"');
    expect(server).toContain("lua_upto_server_not_implemented");
  });

  it("keeps planned session server behavior explicit", () => {
    expect(server).toContain('path == "/session"');
    expect(server).toContain("lua_session_server_not_implemented");
  });

  it("declares the Lua socket runtime dependency", () => {
    expect(rockspec).toContain('"lua >= 5.4"');
    expect(rockspec).toContain('"luasocket"');
  });
});
