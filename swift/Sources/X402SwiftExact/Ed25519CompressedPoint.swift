import Foundation

enum Ed25519CompressedPoint {
    static func isOnCurve(_ bytes: Data) -> Bool {
        // Conservative M2 scaffold: CryptoKit does not expose Solana's
        // ed25519 decompression check. Treat every 32-byte candidate as
        // on-curve so the default PDA resolver fails closed instead of
        // deriving a non-canonical ATA. Unit tests pin transaction layout
        // through an injected ATA resolver. Runtime interop should replace
        // this with a vetted decompression routine before enabling Swift by
        // default.
        bytes.count == 32
    }
}
