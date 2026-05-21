---
name: x402-sdk-implementation
description: Implement or review Solana x402 SDK language support, interop adapters, coverage gates, and PR readiness for x402 exact, upto, and batch-settlement. Use when adding x402 support for Go, Python, Ruby, PHP, Lua, Swift, Kotlin, Rust, or TypeScript, or when preparing an x402 language PR for review.
---

# x402 SDK implementation

Use this skill for Solana Foundation `x402-sdk` work. It keeps protocol
semantics grounded in current source-of-truth references and keeps language
ports PR-ready with tests, coverage, interop, and honest capability matrices.

## Source of truth

Prefer these sources in order. Do not invent protocol behavior when the
source-of-truth layer is silent.

1. Local `solana-foundation/x402-sdk` Rust and TypeScript code, tests, and
   `tests/interop` harness.
2. x402 Foundation docs and specs:
   - <https://docs.x402.org/introduction>
   - <https://docs.x402.org/core-concepts/http-402>
   - <https://docs.x402.org/core-concepts/network-and-token-support>
   - <https://github.com/x402-foundation/x402>
   - `specs/schemes/` in `x402-foundation/x402`
3. Solana protocol references for SVM exact payments:
   - SPL Token, Token-2022, associated token accounts, and Solana transaction
     semantics.
   - Signer abstractions can follow the `solana-foundation/solana-keychain`
     Memory-driver pattern when implementing Swift/Kotlin client-only SDKs.
4. Coinbase/CDP x402 docs and SDK examples are useful comparison material, not
   the canonical source when they conflict with Foundation docs or local
   Solana x402 code.

## Capability matrix rules

Every language README and PR description must use explicit capability status.
Never mark a cell `implemented` or `yes` unless unit tests, coverage, and interop
evidence prove it.

| Cell | Current x402-sdk rule |
|---|---|
| `x402/exact` | Canonical Rust/TypeScript behavior first. Go/Python/Ruby can be client+server. PHP/Lua are server-only unless explicitly scoped otherwise. Swift/Kotlin are client-only. |
| `x402/upto` | Official x402 docs describe usage-based `upto`; EVM Permit2 support exists upstream. Solana runtime semantics must stay blocked/planned until an SVM binding exists. Readiness fixtures are allowed. |
| `x402/batch-settlement` | Official docs describe EVM escrow/voucher batching. Solana runtime semantics must stay blocked/planned until an SVM binding exists. Readiness fixtures are allowed. |
| `x402/session` | Do not treat this as a separate x402 cell unless maintainers explicitly confirm naming. If the requested work is session-like, map it to `batch-settlement` discussion and ask only if architecture is ambiguous. |

Use `not implemented`, `planned`, `blocked: missing SVM binding`, or `server-only` instead
of optimistic checkmarks.

## Language skill pairing

Use this x402 skill for protocol and PR-readiness rules. Pair it with one
language skill for idioms only; language skills are not protocol authority.

| Language | Suggested skills.sh skill | Use level |
|---|---|---|
| TypeScript | `0xbigboss/claude-code/typescript-best-practices` | Strong style checklist; still follow local TypeScript patterns. |
| Rust | Prefer local Rust code and `cargo` tooling; generic Rust skills are optional. | Local reference is stronger than external style advice. |
| Go | `0xbigboss/claude-code/go-best-practices` | Useful for type-first Go and table tests; lower adoption than TS/PHP, so treat as checklist. |
| Python | `0xbigboss/claude-code/python-best-practices` | Useful type-first guidance; verify security/audit status before relying on it. |
| Ruby | `mindrally/skills/ruby` | Broad Ruby style checklist; do not force RSpec if repo uses a lighter test stack. |
| PHP | `asyrafhussin/agent-skills/php-best-practices` | Strong fit for PHP 8.x, strict types, PSR, security, and version-aware review. |
| Lua | `mindrally/skills/lua` | Useful Lua idiom checklist; ignore game-specific guidance. |
| Swift | Use Swift package tests plus signer abstraction guidance from `solana-keychain`; SwiftUI skills are not relevant for SDK core. | Keep signer injectable and wallet-agnostic. |
| Kotlin | Prefer Kotlin/JVM library patterns, Gradle tests, and injected signer abstractions. | Do not assume Android wallet APIs for SDK core. |

Before marking a PR ready, mention the paired skill in the PR comment, then
state what changed after the skill pass.

## Workflow

1. **Confirm cell and role.** Identify language, `client`, `server`,
   `client+server`, `server-only`, or `client-only`, and the exact x402 cell.
2. **Read local reference behavior.** For `exact`, compare Rust and
   TypeScript tests before touching the target language. For `upto` and
   `batch-settlement`, inspect Foundation docs/specs first and avoid Solana
   runtime implementation unless an SVM binding exists.
3. **Wire quality gates early.** Add or verify formatter, unit tests, coverage,
   and CI job before expanding runtime behavior. Target 90%+ coverage unless a
   language/tooling exception is documented in the PR.
4. **Mirror canonical test coverage.** Port Rust/TypeScript exact behavior into
   language tests, including happy path, split payments, ATA creation required,
   network mismatch, token program mismatch, route binding, replay/duplicate
   settlement, malformed payloads, and server-only negative paths.
5. **Implement the missing behavior.** Prefer small modules and explicit error
   types. Do not add broad dependencies unless they materially improve signing,
   transaction construction, HTTP interop, or coverage.
6. **Turn on interop carefully.** Register the adapter in `tests/interop`,
   then run focused Rust-reference spine checks before enabling default CI.
7. **Update docs last.** README capability matrices must reflect the evidence,
   not intent. Include install, example, coverage command, interop command, and
   known limitations.
8. **Prepare PR evidence.** PR description must include what/why/how, exact
   verification commands, coverage numbers, interop pairs, Greptile status, and
   the language skill used.

## Security and correctness invariants

- Bind exact payments to network, asset, token program, destination, amount,
  route/resource, and payment identity. A valid payment for one route must not
  satisfy a different route.
- Token-program mismatches must fail closed. SPL Token and Token-2022 are not
  interchangeable unless the payment requirements explicitly match the decoded
  transaction.
- ATA creation must be explicit and tested. If creation is required, the decoded
  transaction must prove the expected ATA path.
- Managed fee payer must never become transfer source or token authority.
- Duplicate settlement prevention must use stable decoded transaction bytes or
  an equivalently collision-resistant identity, not loose JSON strings.
- Malformed `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE`
  payloads must fail with deterministic 402/error behavior, not hangs.
- Never log private keys, raw secrets, bearer tokens, or full wallet material.

## PR ready checklist

A language PR is ready only when all relevant items are true:

- Unit tests pass for the language package.
- Coverage is reported in CI; 90%+ is met or the exception is explicit.
- Interop has at least TypeScript/Rust reference-spine evidence for the enabled
  cells and language role.
- README matrix has no speculative `yes`.
- Greptile comments are addressed or explicitly documented as stale/non-action.
- PR comment says the skill pass is complete and identifies the external
  language skill used.
- Public APIs have enough comments/docs for useful editor hover text.
- No model signatures, generated-by markers, emojis, or unexplained broad
  dependencies are committed.
