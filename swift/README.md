# x402 Swift exact client scaffold

This directory contains an experimental SwiftPM package for the Solana x402
`exact` client path. It is intentionally client-only and does not add package
publishing metadata.

## Scope

- Parse canonical x402 v2 `accepts` challenges from `PAYMENT-REQUIRED` or JSON
  response bodies.
- Select Solana `exact` offers by preferred network and optional currency list.
- Build a v0 Solana transaction with compute budget, SPL `transferChecked`, and
  memo instructions.
- Sign through an injected `SolanaSigner` abstraction.
- Provide a `MemorySolanaSigner` for 64-byte Solana secret-key fixtures on
  Apple platforms with CryptoKit.
- Emit a base64 x402 `PAYMENT-SIGNATURE` envelope.
- Provide an opt-in interop client executable:

```bash
cd tests/interop
X402_INTEROP_CLIENTS=swift X402_INTEROP_SERVERS=typescript pnpm test -- --run
```

## Current PR readiness

This is not ready to enable by default in the interop matrix. The associated
token account resolver has the right injection point, but the default PDA path
currently fails closed until a vetted Ed25519 compressed-point check is added.
Runtime interop should not be treated as canonical before that lands.

The unit tests use an injected ATA resolver to pin the x402 challenge selection,
signer abstraction, blockhash injection, transaction serialization, and payment
header envelope without depending on live RPC.

## Verification

```bash
cd swift
swift test
```
