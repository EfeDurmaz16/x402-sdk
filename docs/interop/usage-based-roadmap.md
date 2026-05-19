# Usage-Based Interop Roadmap

This roadmap defines the staged boundary for `upto`, `session`, and
`subscription` interop work. It starts with planning and harness capability
metadata, then moves runtime support forward only when the semantics are
explicit and locally verified.

## Current baseline

The interop harness currently validates Solana `exact` payments across the
TypeScript and Rust adapters. The stable matrix covers:

- TypeScript client to TypeScript server
- Rust client to TypeScript server
- TypeScript client to Rust server
- Rust client to Rust server
- USDC and PYUSD selection/fallback cases
- negative boundary cases for network mismatch and missing recipient ATA

This baseline must remain green while usage-based support is added.

## x402 scheme boundary

x402 usage-based work should start with native x402 scheme boundaries:

- `exact`: one request, fixed amount, immediate settlement.
- `upto`: one request, maximum authorization, settlement for actual usage.
- `batch-settlement`: repeated low-value requests, off-chain vouchers, batched
  on-chain redemption.

Current public x402 references describe `upto` as maximum-authorization
semantics and currently document it for EVM. Solana `exact` payments are signed
SPL transfer transactions with a fixed amount, so Solana `upto` must not be
treated as a simple scheme rename over `exact`. The staging harness tracks
Solana `upto` as `requires-design` until the authorization and settlement model
is explicit.

Reference check on 2026-05-19:

- x402 seller docs describe Solana examples for `exact`, while the `upto`
  examples use EVM schemes.
- the same docs state `upto` is currently available on EVM networks only in
  TypeScript, Go, and Python SDKs.
- network docs describe Solana transfer support as SPL or Token-2022 transfer,
  while EVM supports EIP-3009 or Permit2.
- batch settlement is documented separately from `upto` as a channel or escrow
  style scheme for high-frequency flows, currently centered on EVM.

`session` is not treated as a native x402 scheme in this repository unless the
upstream x402 standard defines one. Until then, session-shaped flows belong to
an explicit compatibility intent path, not the native scheme registry.

## Planned `upto` coverage

`upto` is planned for:

- Rust client and server
- TypeScript client and server
- Python client and server
- Go client and server
- Ruby client and server
- Lua server only
- PHP server only

The first `upto` test contract should cover:

- maximum-authorization semantics distinct from fixed-amount `exact`
- maximum amount advertised by the server
- actual settlement amount chosen by the server
- zero settlement
- over-maximum rejection
- missing settlement override
- wrong scheme rejection

No adapter should be marked default-CI eligible for `upto` until it passes the
shared scenario contract locally and in CI.

Solana `upto` runtime support also needs explicit decisions for the
authorization primitive, single-use replay model, actual settlement authority,
zero-settlement behavior, recipient ATA policy, and over-maximum enforcement.
The interop fixtures also lock the planned language roles so PHP and Lua stay
server-only while Rust, TypeScript, Python, Go, and Ruby track both client and
server support.

## Session compatibility boundary

MPP-style `session` is a metered lifecycle, not the same thing as x402 `upto`:

- open a channel or escrow-like state
- submit cumulative vouchers as service is consumed
- optionally top up
- close or force-close
- persist latest voucher/state before delivering more service

Session compatibility is planned for:

- Python client and server
- Go client and server
- Ruby client and server
- Lua server only
- PHP server only

Session support should remain experimental until the target spec is stable
enough and durable server-state requirements are tested.

The session fixture contract locks Python, Go, and Ruby as planned client/server
roles while Lua and PHP remain planned server-only roles.

## PHP and Lua policy

PHP and Lua are server-side only for the initial roadmap. The harness should
represent their client role as `missing`, not silently skip it.

`SolDapper/solana-php` is a candidate dependency for future PHP Solana
transaction construction. It should be evaluated in the PHP implementation PR
before adding Composer metadata.

## Candidate PR stack

Status reflects the current staging branch, not necessarily merged upstream
PRs.

| # | Slice | Status |
| --- | --- | --- |
| 1 | Scheme and intent boundary docs plus capability metadata tests. | staged |
| 2 | Interop capability matrix surfaced in runner diagnostics. | staged |
| 3 | `upto` scenario fixtures and negative cases. | staged |
| 4 | TypeScript `upto` server support. | staged as experimental |
| 5 | TypeScript `upto` client support. | next |
| 6 | Rust `upto` server support. | staged as experimental |
| 7 | Rust `upto` client support. | planned |
| 8 | Python `upto` adapter support. | planned |
| 9 | Go `upto` adapter support. | planned |
| 10 | Ruby `upto` adapter support. | planned |
| 11 | Lua `upto` server adapter support. | planned |
| 12 | PHP `upto` server adapter support. | planned |
| 13 | Session detection fixtures. | staged |
| 14 | Session experimental scenario contract. | staged |
| 15 | Python session adapter support. | planned |
| 16 | Go session adapter support. | planned |
| 17 | Ruby session adapter support. | planned |
| 18 | Lua session server adapter support. | planned |
| 19 | PHP session server adapter support. | planned |
| 20 | Subscription boundary docs and detection fixtures. | staged |
| 21 | Subscription experimental diagnostics. | staged |
| 22 | Matrix report artifacts. | staged |
| 23 | Maintainer runbook for one language, one pair, and one scheme. | staged |
| 24 | Experimental CI opt-in flags. | staged |
| 25 | Final cleanup of planned/missing capability reporting. | staged |

## Current staging guardrails

- Runtime interop is still `exact` only.
- `X402_INTEROP_SCHEME=upto` fails fast with capability diagnostics instead of
  silently running `exact`.
- `X402_INTEROP_INTENT=session` and `X402_INTEROP_INTENT=subscription` fail
  fast until runtime scenarios exist.
- TypeScript and Rust `upto` server support are marked `experimental` because Solana
  maximum-authorization settlement still requires an explicit design.
- Planned and server-only roles are visible through `pnpm capabilities`.
- CI uploads the JSON capability report and can run experimental contract tests
  by setting `X402_INTEROP_EXPERIMENTAL=true`.
- The JSON capability report includes a flat `roles` list so CI and reviewers
  can inspect each language/role status without parsing summary text.
- `pnpm scaffold` reports planned SDK roots, expected package manifests, and
  current runtime adapter availability for monorepo readiness checks.
- Split-payment semantics are not modeled in the current exact SVM contract;
  keep them out of runtime claims until an x402 requirements shape exists.

## Current staging non-goals

- Do not mark `upto` default-CI eligible yet.
- Do not claim Solana `upto` client/facilitator settlement is implemented.
- Do not add PHP, Ruby, Lua, Python, or Go runtime adapters without dedicated
  adapter PRs and local interop verification.
- Do not make session or subscription scenarios block CI before their specs and
  state requirements stabilize.
