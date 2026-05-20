import Foundation
#if canImport(CryptoKit)
import CryptoKit
#endif

public protocol SolanaSigner {
    var address: SolanaPublicKey { get }
    func sign(message: Data) async throws -> Data
}

#if canImport(CryptoKit)
public struct MemorySolanaSigner: SolanaSigner {
    private let privateKey: Curve25519.Signing.PrivateKey
    public let address: SolanaPublicKey

    public init(secretKey: [UInt8]) throws {
        guard secretKey.count == 64 else {
            throw X402SwiftExactError.invalidSecretKeyLength(secretKey.count)
        }
        let seed = Data(secretKey.prefix(32))
        let publicBytes = Data(secretKey.suffix(32))
        self.privateKey = try Curve25519.Signing.PrivateKey(rawRepresentation: seed)
        self.address = try SolanaPublicKey(bytes: publicBytes)
    }

    public func sign(message: Data) async throws -> Data {
        try privateKey.signature(for: message)
    }
}
#endif
