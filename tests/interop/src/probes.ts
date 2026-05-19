export type ProbeStatus = "green" | "expected-red";

export type ProbeDefinition = {
  script: string;
  command: string;
  status: ProbeStatus;
  reason: string;
};

export const interopProbes: ProbeDefinition[] = [
  {
    script: "test:probe:local",
    command: "pnpm test:ci && pnpm test:probe:staging && pnpm test:probe:reports",
    status: "green",
    reason: "Full local gate for default CI, staging contracts, and report output.",
  },
  {
    script: "test:probe:staging",
    command: "pnpm test:probe:planned-syntax && pnpm test:probe:usage-boundaries && pnpm test:planned-adapters",
    status: "green",
    reason: "Green staging gate for planned scaffold syntax and non-runtime contracts.",
  },
  {
    script: "test:probe:planned-syntax",
    command: "pnpm test:probe:python-syntax && pnpm test:probe:go-build && pnpm test:probe:ruby-syntax && pnpm test:probe:php-syntax",
    status: "green",
    reason: "Python, Go, Ruby, and PHP scaffold syntax/build health.",
  },
  {
    script: "test:probe:usage-boundaries",
    command: "vitest run test/contracts.test.ts test/upto-fixtures.test.ts test/session-fixtures.test.ts",
    status: "green",
    reason: "Green aggregate for disabled runtime boundaries and usage-based fixtures.",
  },
  {
    script: "test:probe:reports",
    command: "pnpm capabilities && pnpm capabilities:json && pnpm scaffold && pnpm scaffold:json && pnpm probes && pnpm probes:json",
    status: "green",
    reason: "Capability, scaffold, and probe-plan output stays readable and machine-readable.",
  },
  {
    script: "test:probe:python-syntax",
    command: "cd ../../python && python3 -m compileall -q src",
    status: "green",
    reason: "Python scaffold syntax check.",
  },
  {
    script: "test:probe:go-build",
    command: "cd ../../go && go test ./...",
    status: "green",
    reason: "Go scaffold build check.",
  },
  {
    script: "test:probe:ruby-syntax",
    command: "cd ../../ruby && ruby -c bin/interop-client && ruby -c bin/interop-server",
    status: "green",
    reason: "Ruby scaffold syntax check.",
  },
  {
    script: "test:probe:php-syntax",
    command: "php -l ../../php/bin/interop-server.php",
    status: "green",
    reason: "PHP server-only scaffold syntax check.",
  },
  {
    script: "test:probe:upto-boundary",
    command: "X402_INTEROP_SCHEME=upto pnpm test:smoke",
    status: "expected-red",
    reason: "Solana upto runtime remains disabled until maximum-authorization settlement is designed.",
  },
  {
    script: "test:probe:session-boundary",
    command: "X402_INTEROP_INTENT=session pnpm test:smoke",
    status: "expected-red",
    reason: "Session runtime remains disabled until the compatibility intent contract stabilizes.",
  },
  {
    script: "test:probe:python-client",
    command: "X402_INTEROP_CLIENTS=python X402_INTEROP_SERVERS=rust pnpm test:smoke",
    status: "expected-red",
    reason: "Python client scaffold is registered but exact payment construction is not implemented yet.",
  },
  {
    script: "test:probe:python-server",
    command: "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=python pnpm test:smoke",
    status: "expected-red",
    reason: "Python server scaffold is registered but exact payment settlement is not implemented yet.",
  },
  {
    script: "test:probe:go-client",
    command: "X402_INTEROP_CLIENTS=go X402_INTEROP_SERVERS=rust pnpm test:smoke",
    status: "expected-red",
    reason: "Go client scaffold is registered but exact payment construction is not implemented yet.",
  },
  {
    script: "test:probe:go-server",
    command: "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=go pnpm test:smoke",
    status: "expected-red",
    reason: "Go server scaffold is registered but exact payment settlement is not implemented yet.",
  },
  {
    script: "test:probe:ruby-client",
    command: "X402_INTEROP_CLIENTS=ruby X402_INTEROP_SERVERS=rust pnpm test:smoke",
    status: "expected-red",
    reason: "Ruby client scaffold is registered but exact payment construction is not implemented yet.",
  },
  {
    script: "test:probe:ruby-server",
    command: "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=ruby pnpm test:smoke",
    status: "expected-red",
    reason: "Ruby server scaffold is registered but exact payment settlement is not implemented yet.",
  },
  {
    script: "test:probe:php-server",
    command: "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=php pnpm test:smoke",
    status: "expected-red",
    reason: "PHP server scaffold is registered but exact payment settlement is not implemented yet.",
  },
  {
    script: "test:probe:lua-syntax",
    command: "cd ../../lua && if command -v luac >/dev/null 2>&1; then luac -p bin/interop-server.lua; elif command -v lua >/dev/null 2>&1; then lua -e 'assert(loadfile(\"bin/interop-server.lua\"))'; else echo 'Lua toolchain not found; install lua or luac to run this probe' >&2; exit 127; fi",
    status: "expected-red",
    reason: "Lua syntax depends on an optional local Lua toolchain.",
  },
  {
    script: "test:probe:lua-server",
    command: "X402_INTEROP_CLIENTS=typescript X402_INTEROP_SERVERS=lua pnpm test:smoke",
    status: "expected-red",
    reason: "Lua server scaffold is registered but exact payment settlement is not implemented yet.",
  },
];

export function getInteropProbePlan() {
  return {
    version: 1,
    green: interopProbes.filter(probe => probe.status === "green"),
    expectedRed: interopProbes.filter(probe => probe.status === "expected-red"),
  };
}

export function formatInteropProbeReport(): string {
  return interopProbes
    .map(probe => `${probe.status}:${probe.script} ${probe.command} reason:${probe.reason}`)
    .join("\n");
}
