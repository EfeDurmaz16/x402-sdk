# Language skill pairing

Use the x402 skill for protocol and PR readiness. Pair it with one language
skill only for idioms, tests, and maintainability. Language skills are not
protocol authority.

| Language | Suggested skill or guide | Confidence |
|---|---|---|
| TypeScript | `0xbigboss/claude-code/typescript-best-practices` | Strong style checklist; high installs and audit pass. Still follow local TypeScript package patterns. |
| Rust | Local Rust reference plus `cargo fmt`, `cargo clippy`, `cargo test` | Strongest local authority. Generic Rust skills are optional only. |
| Go | `0xbigboss/claude-code/go-best-practices` | Useful type-first/table-test checklist. Adoption is lower than TS/PHP, so treat as advisory. |
| Python | `0xbigboss/claude-code/python-best-practices` | Useful type-first guidance. Verify audit/status before relying on it. |
| Ruby | `mindrally/skills/ruby` | Broad Ruby checklist. Do not force RSpec if the repo uses a lighter standard-library stack. |
| PHP | `asyrafhussin/agent-skills/php-best-practices` | Strong PHP 8.x fit: strict types, PSR, version-aware rules, security checks. |
| Lua | `mindrally/skills/lua` | Useful Lua idiom checklist. Ignore game-development-specific guidance. |
| Swift | Local SwiftPM tests plus `solana-foundation/solana-keychain` signer-abstraction pattern | Do not use SwiftUI skills for SDK core. Keep signer injectable and wallet-agnostic. |
| Kotlin | Kotlin/JVM library conventions, Gradle tests, injected signer abstraction | Do not assume Android wallet APIs for SDK core. |

Before marking a PR ready, add a short PR comment:

- x402 skill/checklist used
- language skill or guide used
- Greptile feedback state
- local and CI verification
- capability matrix cells proven by tests/interop

Do not install weak or unrelated skills just to satisfy process. If no high
quality skill exists for a language, state that and use official language
tooling plus the local x402 skill.
