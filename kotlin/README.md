# x402 Kotlin client scaffold

This directory is a client-only Kotlin/JVM scaffold for Solana x402 `exact`.
It is intentionally not a published package and does not add Maven Central,
Gradle publishing, Android, or multiplatform packaging.

## Current scope

- Parse x402 v2 `PAYMENT-REQUIRED` header envelopes.
- Parse x402 v2 JSON response body envelopes.
- Select a Solana `exact` requirement by CAIP-2 network.
- Prefer stablecoin offers by symbol or mint address for USDC, PYUSD, USDG,
  USDT, and CASH.
- Expose a disabled interop client command for harness registration.

## Not implemented yet

The scaffold is not runtime-interoperable until it can construct and sign the
canonical Solana exact payment payload:

1. Fetch the selected mint account and derive the token program.
2. Derive source and destination associated token accounts.
3. Build a versioned Solana transaction with compute-budget, SPL
   `transferChecked`, and memo instructions.
4. Sign the serialized message with the client Ed25519 key.
5. Base64 encode the transaction in the x402 v2 `PAYMENT-SIGNATURE` envelope.

The interop CLI exits successfully and emits a machine-readable `result`
payload, but reports `ok: false` once it reaches the missing signing boundary.

## Local checks

```bash
cd kotlin
gradle test
```

The broader interop harness should keep Kotlin disabled by default until the
transaction/signing boundary above is implemented:

```bash
cd tests/interop
X402_INTEROP_CLIENTS=kotlin X402_INTEROP_SERVERS=rust pnpm test:smoke
```

