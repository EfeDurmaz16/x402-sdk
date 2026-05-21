# PR readiness

Use this checklist before commenting that a language PR is ready for review.

## Required evidence

- Unit tests pass for the language package.
- Coverage is reported in CI.
- Coverage is at least 90 percent, or the PR states a concrete tooling
  exception and compensating evidence.
- Interop includes Rust/TypeScript reference-spine evidence for enabled cells.
- README or PR capability matrix has no speculative implemented status.
- Greptile comments are fixed, stale because of later commits, or explicitly
  documented as non-actionable.
- Public APIs have enough comments/docs for useful editor hover text.
- No secrets, raw keys, model signatures, generated-by markers, or unexplained
  broad dependencies are committed.

## PR description shape

Keep PRs reviewable but include enough evidence:

1. Summary: what changed.
2. Why: which milestone/capability this unlocks.
3. Implementation notes: important design choices and tradeoffs.
4. Verification: exact commands, coverage numbers, and interop pairs.
5. Skill pass: x402 skill plus language skill or guide used.
6. Known limits: server-only/client-only/planned cells.

## Ready-for-review comment

When Greptile feedback is addressed, comment in this shape:

```text
@<maintainer> Greptile feedback is addressed here and I think this is ready for review.

Skill pass:
- x402 implementation checklist: <PR or path>
- language skill/guide: <name>

Addressed points:
- <what changed>

Verification:
- <unit/coverage command>
- <interop command or CI job>

Known limits:
- <server-only/client-only/planned cells, if any>
```
