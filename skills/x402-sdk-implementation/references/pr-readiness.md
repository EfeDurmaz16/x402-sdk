# PR readiness

Use this checklist before commenting that a language PR is ready for review.
**Green CI is not enough.** Greptile pass without a Codex second-opinion pass
and without verified Greptile-finding fixes is not "ready."

## Required evidence

- Unit tests pass for the language package.
- Coverage is reported in CI.
- Coverage is at least 90 percent for the security-critical entry points
  (instruction allowlist evaluator, fee-payer signer-slot guard, replay-store
  consume path, canonical JSON/credential building). Branch coverage where
  the toolchain supports it.
- Interop includes Rust/TypeScript reference-spine evidence for enabled cells.
  Reference-spine alone is not sufficient for cross-language wire-format
  conformance — run the focused matrix slice for the language under review.
- README or PR capability matrix has no speculative implemented status.
- Greptile comments are fixed (with tests), stale because of later commits,
  or explicitly accepted in-thread with rationale.
- Local Codex review on the latest tip flags zero P1.
- Public APIs have enough comments/docs for useful editor hover text.
- No secrets, raw keys, model signatures, generated-by markers, or unexplained
  broad dependencies are committed.

## Attack regression tests (fee-payer paths)

Any server SDK that co-signs with a managed fee-payer key MUST include
hand-crafted attack-shape transactions the server rejects, with a matching
positive control:

- **DRAIN attack**: valid payment + extra `SystemProgram::Transfer` from the
  fee-payer pubkey to an attacker.
- **SPL token DRAIN**: valid payment + `transferChecked` sourced from the
  fee-payer's ATA for any token it holds.
- **SLOT attack**: fee-payer pubkey at signer slot 1 (not 0) alongside an
  attacker-controlled instruction. Server may inadvertently co-sign for an
  extra required-signer position.
- **Tampered details attack**: client supplies `details.fee_payer = ATTACKER`
  but server signing key is `SERVER_PUBKEY`; the server's drain detection
  MUST use the server-context pubkey, not the client-supplied field.

For each shape, the positive control uses the same envelope minus the attack
mutation. Both reject and accept paths are confirmed in one test pass.

## L8 claim-then-broadcast-then-confirm ordering

Pull-mode settlement MUST follow this order on every server SDK so a crash
between any two steps cannot result in a double-broadcast:

1. `claim_signature` in the durable replay store (write the marker / acquire
   the idempotency slot **before** the network call).
2. `send_raw_transaction` (broadcast).
3. `await_confirmation` (poll until confirmed or timeout).
4. On confirmation failure or timeout: `release_claim` so a legitimate retry
   can proceed once the operator decides the prior attempt was lost.

If broadcast happens before the claim is written and the process crashes
between broadcast and the marker write, a retry will broadcast the same
signature again = double-pay. The Rust spine is the canonical reference.

## Local Codex review (second opinion)

Greptile alone misses real findings (MPP M1 closure §19.3 logged at least one
fee-payer SPL drain hole Greptile passed). Run Codex on every language PR
before claiming ready:

```bash
cd <pr-worktree>
git fetch origin main
git diff origin/main...HEAD > /tmp/pr-<N>.diff
codex exec --skip-git-repo-check \
  "Review this diff for bugs, security issues, missing tests, and protocol
   deviations. Rate confidence 1-5 with reasoning." \
  < /tmp/pr-<N>.diff \
  > notes/codex-review-<lang>/pr-<N>.md 2>&1
```

P1 findings are ship-blockers. Reasoning often disagrees with Greptile; both
are signal, neither is ground truth.

## TLS peer verification (HTTP-RPC paths)

Adapters that talk HTTPS to RPC endpoints MUST verify TLS peers explicitly.
Default-on TLS in some stacks (e.g. luasec) does not actually verify; a hijack
or proxy can forge `getSignatureStatuses` confirmations and trigger
Payment-Receipt for unsettled transactions. Force `verify = peer`, pin to
TLSv1.2 or above, tighten the options struct. Allow `opts.ssl_verify` override
for explicit insecure dev only.

## Process / harness hygiene

The interop harness spawns adapters in their own process group and kills via
`process.kill(-pid, signal)` so SIGTERM reaches `sh -c`-wrapped grandchildren.
Adapters that fork additional helpers must propagate signals or set their own
process groups; otherwise they leak across matrix runs and exhaust RPC pools.

## PR description shape

Keep PRs reviewable but include enough evidence:

1. Summary: what changed.
2. Why: which milestone/capability this unlocks.
3. Implementation notes: important design choices and tradeoffs.
4. Verification: exact commands, coverage numbers, and interop pairs.
5. Skill pass: x402 skill plus language skill(s) from `language-skills.md`,
   with concrete findings each skill resolved.
6. Attack regression tests: list the shapes covered, with link to the test
   file.
7. Known limits: server-only/client-only/planned cells.

## Ready-for-review comment

When all of the above is true, post ONE consolidated final-status comment in
this shape (and minimize earlier evidence/trigger comments per the comment
surface cleanup pass):

```text
@<maintainer> ready for review on <tip SHA>.

Skill pass:
- x402 implementation checklist: <PR or path>
- language skill(s): <name> — applied <specific finding> in <file:line>
- secondary skill: <name> — applied <specific finding>

Greptile: <pass / N threads accepted in-thread with rationale, see <links>>.
Codex local review: P1=0, P2=<n> (notes/codex-review-<lang>/pr-<N>.md).

Verification:
- <unit/coverage command> — <result>
- <attack regression command> — <result>
- <interop command or CI job> — <result>
- focused matrix: <command> — <result>

Known limits:
- <server-only / client-only / planned cells>

Intentional open threads: <none / list with rationale>.
```

## Honest "ready" reporting

If any of the above is missing, the PR is NOT ready, regardless of green CI.
Specifically:

- "All checks pass" without verified Greptile-finding fixes is not ready.
- Coverage gate met but security-critical functions only at line coverage is
  not ready — add branch coverage there.
- Local Codex flags any P1 — not ready.
- Attack regression tests missing on a fee-payer co-signing path — not ready.
- Cross-server portability / idempotent resubmit scenarios skipped without an
  in-thread reason — not ready.
- Manual DX gate not captured against surfpool with a real on-chain signature
  for client/server cells the PR claims as implemented — not ready.
- Untracked artifacts in the commit — not ready.
