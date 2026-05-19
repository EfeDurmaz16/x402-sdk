//! Solana server-side boundary for the x402 `upto` scheme.
//!
//! This module intentionally exposes only the scheme identifier today. Solana
//! client payload construction and facilitator settlement require an explicit
//! authorization design before runtime support is enabled.

/// Upto payment scheme identifier.
pub const UPTO_SCHEME: &str = "upto";
