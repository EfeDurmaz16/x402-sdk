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
    command: "pnpm test:probe:planned-syntax && pnpm test:probe:lua-static && pnpm test:probe:usage-boundaries && pnpm test:probe:planned-runtime",
    status: "green",
    reason: "Green staging gate for planned scaffold syntax and non-runtime contracts.",
  },
  {
    script: "test:probe:planned-syntax",
    command: "pnpm test:probe:python-syntax && pnpm test:probe:python-unit && pnpm test:probe:go-build && pnpm test:probe:ruby-syntax && pnpm test:probe:ruby-unit && pnpm test:probe:php-syntax && pnpm test:probe:php-unit && pnpm test:probe:php-composer",
    status: "green",
    reason: "Python, Go, Ruby, and PHP scaffold syntax/build plus Python/Ruby parser and PHP package health.",
  },
  {
    script: "test:probe:planned-runtime",
    command: "pnpm test:planned-adapters",
    status: "green",
    reason: "Process-level planned adapter contracts that prove opt-in runtimes fail with explicit not-implemented shapes.",
  },
  {
    script: "test:probe:usage-boundaries",
    command: "pnpm test:probe:upto-fixtures && pnpm test:probe:batch-settlement-fixtures && pnpm test:probe:session-fixtures && pnpm test:probe:subscription-fixtures && vitest run test/contracts.test.ts",
    status: "green",
    reason: "Green aggregate for disabled runtime boundaries and usage-based fixtures.",
  },
  {
    script: "test:probe:multi-currency",
    command: "X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:multi-currency",
    status: "green",
    reason: "Reference-spine runtime coverage for multi-currency offer selection and fallback.",
  },
  {
    script: "test:probe:upto-fixtures",
    command: "vitest run test/upto-fixtures.test.ts",
    status: "green",
    reason: "Solana upto maximum-authorization fixture contract without runtime settlement.",
  },
  {
    script: "test:probe:batch-settlement-fixtures",
    command: "vitest run test/batch-settlement-fixtures.test.ts",
    status: "green",
    reason: "Batch-settlement voucher fixture contract without runtime settlement.",
  },
  {
    script: "test:probe:session-fixtures",
    command: "vitest run test/session-fixtures.test.ts",
    status: "green",
    reason: "Session compatibility lifecycle fixture contract without runtime support.",
  },
  {
    script: "test:probe:subscription-fixtures",
    command: "vitest run test/subscription-fixtures.test.ts",
    status: "green",
    reason: "Subscription compatibility fixture contract without runtime support.",
  },
  {
    script: "test:probe:reports",
    command: "pnpm capabilities && pnpm capabilities:json && pnpm scaffold && pnpm scaffold:json && pnpm probes && pnpm probes:json && pnpm promotion && pnpm promotion:json && pnpm reports:verify",
    status: "green",
    reason: "Capability, scaffold, probe-plan, promotion-plan, and generated CI artifacts stay readable and machine-readable.",
  },
  {
    script: "test:probe:python-syntax",
    command: "cd ../../python && python3 -m compileall -q src",
    status: "green",
    reason: "Python scaffold syntax check.",
  },
  {
    script: "test:probe:python-unit",
    command: "cd ../../python && PYTHONPATH=src python3 -m unittest discover -s tests",
    status: "green",
    reason: "Python interop parser unit tests.",
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
    script: "test:probe:ruby-unit",
    command: "cd ../../ruby && ruby -Ilib:test test/interop_client_test.rb",
    status: "green",
    reason: "Ruby interop parser unit tests.",
  },
  {
    script: "test:probe:php-syntax",
    command: "php -l ../../php/bin/interop-server.php",
    status: "green",
    reason: "PHP server-only scaffold syntax check.",
  },
  {
    script: "test:probe:php-unit",
    command: "php ../../php/tests/interop_server_test.php",
    status: "green",
    reason: "PHP server-only scaffold readiness and HTTP response contract.",
  },
  {
    script: "test:probe:php-composer",
    command: "cd ../../php && composer validate --strict && composer test",
    status: "green",
    reason: "PHP Composer metadata validation and package-level server-only test script.",
  },
  {
    script: "test:probe:lua-static",
    command: "vitest run test/lua-scaffold.test.ts",
    status: "green",
    reason: "Lua server-only scaffold contract without requiring a local Lua toolchain.",
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
