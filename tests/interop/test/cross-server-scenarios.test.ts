import { describe, it } from "vitest";

// Skeleton suite for the cross-server portability and idempotent resubmit
// scenarios called out in MPP M1 closure §19.6. These tests need at least two
// independent server implementations (different language adapters) to be
// meaningful, so they are disabled by default and gated on the
// X402_INTEROP_CROSS_SERVER env flag.
//
// Activation: set X402_INTEROP_CROSS_SERVER=1 once a non-reference server
// adapter (php/lua/ruby/python/go) joins the matrix and exposes the canonical
// L6 error codes referenced below.

const ENABLED = process.env.X402_INTEROP_CROSS_SERVER === "1";
const suite = ENABLED ? describe : describe.skip;

suite("x402 cross-server scenarios", () => {
  it.todo(
    "rejects a credential submitted to a different server with challenge_verification_failed",
  );
  it.todo("rejects a duplicate submission to the same server with signature_consumed");
});
