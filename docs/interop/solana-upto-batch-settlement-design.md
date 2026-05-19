# Solana `upto` and Batch Settlement Design Notes

This note records the current design boundary before adding Solana runtime
client or facilitator support for `upto`.

## Current Reference State

As of 2026-05-19, the public x402 docs describe:

- `exact` as the fixed-price scheme that works across EVM, SVM, Stellar, and
  Aptos.
- `upto` as maximum authorization with actual usage settlement, currently
  available on EVM networks only through Permit2 in TypeScript, Go, and Python.
- `batch-settlement` as an EVM-focused channel or escrow model where the buyer
  deposits once, signs off-chain vouchers, and sellers redeem in batches.

Relevant public references:

- https://docs.x402.org/getting-started/quickstart-for-sellers
- https://docs.x402.org/faq
- https://docs.x402.org/core-concepts/http-402
- https://docs.x402.org/core-concepts/network-and-token-support

## Why Solana `upto` Is Design-Gated

The existing Solana `exact` client signs a concrete SPL or Token-2022 transfer
transaction. That transaction includes the transfer amount. If a Solana client
signs the maximum amount and the server later settles it, the server charges the
maximum, not actual usage.

That means Solana `upto` cannot be implemented safely as:

1. Change `scheme` from `exact` to `upto`.
2. Reuse the exact client transaction builder.
3. Let the server choose a lower final amount after the response.

The signature would not authorize a mutable lower transfer amount. Rewriting the
amount would invalidate the signed transaction, while submitting the original
transaction would overcharge relative to actual usage.

## Required Decisions

Before runtime support is enabled, Solana `upto` needs explicit answers for:

- Authorization primitive: signed transfer, signed message, nonce account,
  durable nonce transaction, escrow deposit, delegated spend, or another model.
- Replay model: single-use authorization, cumulative voucher, nonce, payment
  identifier, or facilitator cache.
- Settlement authority: who can turn the authorization into an on-chain payment.
- Actual amount binding: how the final amount is proven to be less than or
  equal to the authorized maximum.
- Zero-settlement behavior: how no-charge requests expire without chain writes.
- ATA policy: whether recipient ATA creation is required up front, sponsored by
  the facilitator, or rejected as a precondition.
- Over-maximum enforcement: whether it is enforced by signature domain,
  contract/program logic, facilitator verification, or server-side checks.

## Candidate Shapes

### 1. Keep `upto` EVM-only for now

This matches the current public x402 docs. Solana SDKs would keep server-side
challenge scaffolding experimental but not expose runtime client or facilitator
settlement.

This is the safest default for CI.

### 2. Solana signed-message authorization

The client signs an off-chain authorization containing:

- payer
- payee
- mint
- maximum amount
- resource or payment identifier
- expiration
- nonce

The facilitator verifies the signed authorization, computes or receives the
actual amount, and builds the final transfer transaction.

This needs a real settlement authority model. Without delegated token authority,
the facilitator cannot move SPL funds only from an off-chain message.

### 3. Solana escrow or channel model

The client funds an escrow or channel once, then signs off-chain vouchers for
actual usage. Settlement redeems from escrow and can support many small
payments.

This is closer to x402 `batch-settlement` and MPP session semantics than to EVM
Permit2 `upto`.

This likely gives the cleanest Solana answer for variable usage, but it is a new
runtime primitive and should not be hidden behind a simple `upto` rename.

## Harness Implication

The current staging branch should keep:

- `exact` as the only default runtime interop scheme.
- TypeScript and Rust `upto` server support as experimental challenge
  scaffolding.
- `X402_INTEROP_SCHEME=upto` failing fast with capability diagnostics.
- `upto` fixtures covering maximum, actual, zero, over-maximum, missing
  override, and wrong-scheme cases without enabling runtime settlement.
- Non-runtime authorization candidate fixtures for signed-message and
  escrow/channel shapes, including exact required field names and blockers.
- Session and batch-settlement shaped fixtures separate from native `upto`
  runtime until the target protocol surface is stable.

## Recommended Next PR Slice

Add a small protocol design PR before adding any Solana `upto` client:

1. Keep the current server-only experimental `upto` support.
2. Add a signed-message or escrow/channel design sketch with exact field names.
3. Add non-runtime fixtures for the chosen authorization envelope.
4. Only then add TypeScript client/facilitator code behind explicit
   experimental selectors.
