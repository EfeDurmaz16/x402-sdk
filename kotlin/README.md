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
- Validate the selected Solana exact requirement before signing:
  `payTo`, `extra.feePayer`, unsigned integer `amount`, and SPL memo byte
  limits.
- Build the canonical x402 v2 `PAYMENT-SIGNATURE` envelope when an injected
  transaction builder and signer provide serialized transaction bytes.
- Expose a disabled interop client command for harness registration.

## Client signing boundary

The core Kotlin scaffold intentionally uses injected interfaces instead of
depending on Android Mobile Wallet Adapter:

- `SolanaExactTransactionBuilder` owns Solana transaction construction.
- `SolanaTransactionSigner` owns wallet/key signing.
- `ExactPaymentClient` validates the selected requirement, calls the builder,
  calls the signer, base64 encodes the signed transaction, and wraps it as:

```json
{
  "x402Version": 2,
  "accepted": { "scheme": "exact", "network": "solana:...", "...": "..." },
  "resource": { "url": "..." },
  "payload": { "transaction": "<base64 serialized signed transaction>" }
}
```

That JSON is itself base64 encoded as the `PAYMENT-SIGNATURE` header value.
This mirrors the Rust and TypeScript v2 wire contract while keeping wallet UI
integration outside the core SDK.

## Not implemented yet / runtime blocker

The scaffold is not runtime-interoperable until it can construct and sign the
canonical Solana exact payment payload:

1. Add a production `SolanaExactTransactionBuilder` using official Solana
   Kotlin primitives such as `com.solanamobile:web3-solana` plus lightweight
   RPC support.
2. Fetch the selected mint account and derive the token program.
3. Derive source and destination associated token accounts.
4. Build a versioned Solana transaction with compute-budget, SPL
   `transferChecked`, and memo instructions.
5. Connect a production signer. Android MWA can satisfy this at the app layer,
   but should stay isolated from this core scaffold because it is wallet UI and
   activity/session plumbing, not generic SDK transaction logic.

The interop CLI exits successfully and emits a machine-readable `result`
payload, but reports `ok: false` once it reaches the missing production
transaction-builder boundary.

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
