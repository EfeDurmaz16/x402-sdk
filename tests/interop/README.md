# Interop tests

This package hosts the cross-language x402 conformance harness.

## Design

- The harness itself lives in `tests/interop`.
- Each implementation is exposed through a small adapter command.
- The harness spawns server adapters, waits for a JSON `ready` message, then runs client adapters against them.
- The harness starts an embedded Surfpool simnet via `surfpool-sdk`, funds test accounts, and passes the same RPC and signer environment into every adapter.
- The default matrix runs TypeScript and Rust clients against TypeScript and Rust servers.
- Future Go, Python, and Lua adapters can plug into the same process contract without changing the test runner.

## Current scope

The current reference flow is chain-backed and CI-friendly:

- the TypeScript reference server uses `@x402/core` HTTP server wrappers, `@solana/x402/server`, and `@solana/x402/facilitator`
- the TypeScript reference client uses `@x402/core` HTTP client wrappers and `@solana/x402/client`
- the Rust reference server uses the Rust crate's exact verifier, facilitator fee-payer co-signing, Surfpool RPC simulation, and transaction submission
- the Rust reference client uses the Rust crate's exact challenge parser and v2 `PAYMENT-SIGNATURE` builder
- the suite starts an embedded Surfpool simnet, funds a client signer with devnet USDC, pays a protected endpoint, and verifies the recipient ATA balance increases on-chain

That means the harness now validates end-to-end HTTP x402 interoperability, real Solana transaction construction, facilitator co-signing, settlement, and on-chain balance changes.

## Commands

```bash
cd typescript
pnpm install
pnpm --filter @solana/x402 build

cd ../tests/interop
pnpm install
pnpm test
```

For the CI-style exact-payment smoke suite:

```bash
X402_INTEROP_PROFILE=reference-spine X402_INTEROP_REFERENCE=rust pnpm test:smoke
```

To mirror the default interop CI job locally:

```bash
pnpm test:ci
```

`reference-spine` runs every active client against the reference server and the
reference client against every active server. The default reference is `rust`,
but it can be changed with `X402_INTEROP_REFERENCE=<implementation>`.

To run the full Cartesian client/server smoke matrix:

```bash
X402_INTEROP_PROFILE=full pnpm test:smoke
```

Boundary and negative vectors are kept outside the default CI smoke profile:

```bash
pnpm test:boundaries
```

CI runs this suite after the reference-spine smoke profile. The first boundary
suite mutates the client payment envelope's
`accepted.network` after a valid payment is built. Servers must reject that
payment and must not emit a settlement header.

It also exercises the current recipient ATA precondition. Exact SVM clients
derive the recipient associated token account but do not create it in the
payment transaction, so servers must not report settlement success when the
recipient ATA is missing.

Experimental usage-based contracts can be checked without running runtime
interop:

```bash
pnpm test:experimental
```

CI keeps this experimental suite opt-in so unstable usage-based semantics do
not block the exact-payment smoke path. Set the repository variable
`X402_INTEROP_EXPERIMENTAL=true` to run `pnpm test:experimental` in Actions.

For one-pair debugging:

```bash
pnpm run test:pair:ts-rust
pnpm run test:pair:rust-ts
```

For one-language debugging:

```bash
pnpm run test:language:typescript
pnpm run test:language:rust
pnpm run test:planned-adapters
```

To inspect planned, experimental, server-only, and missing capability gaps:

```bash
pnpm capabilities
pnpm capabilities:json
pnpm probes
pnpm probes:json
pnpm run test:probe:reports
```

To inspect planned SDK roots, expected package manifests, and current runtime
adapter availability:

```bash
pnpm scaffold
pnpm scaffold:json
```

The scaffold report also records the expected future adapter commands. Lua and
PHP intentionally omit client commands because they are server-side only in the
current roadmap.

Domain-specific scenarios can stay selectable through Vitest filters. For
example, the current smoke script selects the exact-payment tests by matching
`client pays`, while the multi-currency vectors remain available in the full
test suite.

If the TypeScript adapter cannot resolve `@solana/x402/...` subpaths, rebuild
the local package and refresh the interop package install:

```bash
cd typescript
pnpm --filter @solana/x402 build

cd ../tests/interop
pnpm install --force --frozen-lockfile
pnpm test
```

`@solana/x402` is installed from a local `file:` dependency, so `tests/interop`
needs to install after the TypeScript package has produced its `dist` files.

## Adapter contract

Adapters are ordinary process commands registered in
`tests/interop/src/implementations.ts`. They communicate with the harness by
writing one JSON object per line to stdout. Diagnostics, logs, and progress
messages should go to stderr so stdout remains machine-readable.

Server adapters must:

- bind an HTTP server on `127.0.0.1`
- emit exactly one `ready` message after the server is listening
- keep running until the harness sends `SIGTERM` or `SIGINT`
- protect `GET /protected` with x402 and return `{ "ok": true, "paid": true }`
  after settlement succeeds
- include a non-empty settlement value in the `x-fixture-settlement` response
  header on successful paid responses

The `ready` message shape is:

```json
{
  "type": "ready",
  "implementation": "typescript",
  "role": "server",
  "port": 3000,
  "capabilities": ["exact"]
}
```

Client adapters must:

- read `X402_INTEROP_TARGET_URL`
- request the target URL once to receive payment requirements
- build and submit an x402 payment for the supported Solana exact requirement
- emit exactly one `result` message before exiting
- exit with code `0` when the adapter completed the protocol attempt, even if
  the paid response itself is non-2xx; reserve non-zero exits for adapter
  crashes or invalid harness configuration

The `result` message shape is:

```json
{
  "type": "result",
  "implementation": "typescript",
  "role": "client",
  "ok": true,
  "status": 200,
  "responseHeaders": {
    "content-type": "application/json"
  },
  "responseBody": {
    "ok": true,
    "paid": true
  },
  "settlement": "5N..."
}
```

## Shared environment

The harness provides these variables to every adapter:

- `X402_INTEROP_RPC_URL`: Surfpool RPC URL.
- `X402_INTEROP_NETWORK`: Solana CAIP-2 network used by the scenario.
- `X402_INTEROP_MINT`: primary mint address funded by the harness.
- `X402_INTEROP_PRICE`: display price used by reference server adapters.
- `X402_INTEROP_PAY_TO`: recipient account funded and checked by the harness.
- `X402_INTEROP_CLIENT_SECRET_KEY`: JSON byte array for the client signer.
- `X402_INTEROP_FACILITATOR_SECRET_KEY`: JSON byte array for the facilitator
  fee-payer signer.

Optional variables:

- `X402_INTEROP_CLIENTS`: comma-separated client adapter IDs to run.
- `X402_INTEROP_SERVERS`: comma-separated server adapter IDs to run.
- `X402_INTEROP_TARGET_URL`: set by the harness for client adapters.
- `X402_INTEROP_EXTRA_OFFERED_MINTS`: comma-separated additional mints that
  server adapters may advertise alongside the primary mint.
- `X402_INTEROP_PREFER_CURRENCIES`: comma-separated symbols or mint addresses
  that client adapters may use to choose among offered requirements.

## CI selection

Use these environment variables to filter the active matrix:

- `X402_INTEROP_CLIENTS=typescript,rust`
- `X402_INTEROP_SERVERS=typescript,rust`
- `X402_INTEROP_PROFILE=reference-spine|full`
- `X402_INTEROP_REFERENCE=rust`

Unknown client or server adapter IDs fail fast instead of producing an empty
matrix.

If no filter is set, all stable adapters are enabled by default:

- clients: `typescript,rust`
- servers: `typescript,rust`

Planned adapters are registered but disabled by default:

- clients: `python,go,ruby`
- servers: `python,go,ruby,lua,php`

Selecting one of these before its SDK scaffold exists fails fast with a
manifest-specific diagnostic instead of silently falling back to the stable
Rust/TypeScript matrix. For example:

```bash
X402_INTEROP_CLIENTS=python pnpm test:smoke
X402_INTEROP_SERVERS=php pnpm test:smoke
```

The current Python, Go, Ruby, Lua, and PHP scaffolds are intentionally not
green payment implementations yet. Use these green aggregate probes to verify
the planned scaffold surface while keeping default CI green:

```bash
pnpm run test:probe:local
pnpm run test:probe:staging
pnpm run test:probe:planned-syntax
pnpm run test:probe:usage-boundaries
pnpm run test:probe:python-syntax
pnpm run test:probe:python-unit
pnpm run test:probe:go-build
pnpm run test:probe:ruby-syntax
pnpm run test:probe:ruby-unit
pnpm run test:probe:php-syntax
pnpm run test:probe:php-unit
pnpm run test:probe:lua-static
pnpm run test:probe:upto-fixtures
pnpm run test:probe:batch-settlement-fixtures
pnpm run test:probe:session-fixtures
pnpm run test:probe:subscription-fixtures
```

The PHP scaffold also exposes the same server-only checks from its package
root:

```bash
cd ../../php
composer test
```

Use these runtime smoke probes to reproduce the expected-red boundary before a
planned adapter is implemented:

```bash
pnpm run test:probe:upto-boundary
pnpm run test:probe:session-boundary
pnpm run test:probe:python-client
pnpm run test:probe:python-server
pnpm run test:probe:go-client
pnpm run test:probe:go-server
pnpm run test:probe:ruby-client
pnpm run test:probe:ruby-server
pnpm run test:probe:php-server
pnpm run test:probe:lua-syntax
pnpm run test:probe:lua-server
```

`test:probe:lua-syntax` and `test:probe:lua-server` currently fail at the
scaffold/toolchain boundary on machines without Lua. Syntax/build probes run
before runtime probes when a language has a local scaffold but is not a green
payment implementation yet.

`test:probe:upto-boundary` and `test:probe:session-boundary` are expected to
fail until those runtime scenarios are enabled; they exercise the fail-fast
capability diagnostics rather than payment settlement.
Use `test:probe:usage-boundaries` for a green aggregate check of the same
disabled-runtime contract plus the `upto` and `session` fixture gates.

The suite performs a local socket-bind preflight. If the current environment forbids opening loopback ports, the e2e test is skipped instead of failing. In CI, where loopback sockets are available, the matrix runs normally.
