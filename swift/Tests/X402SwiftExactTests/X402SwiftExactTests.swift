import Foundation
import Testing
@testable import X402SwiftExact
#if canImport(CryptoKit)
import CryptoKit
#endif

private struct FixedSigner: SolanaSigner {
    let address: SolanaPublicKey
    let signature: Data

    func sign(message: Data) async throws -> Data {
        signature
    }
}

private struct FixedBlockhashProvider: RecentBlockhashProvider {
    let blockhash: String
    func getLatestBlockhash() async throws -> String { blockhash }
}

private struct FixedATAResolver: AssociatedTokenAddressResolver {
    let source: SolanaPublicKey
    let destination: SolanaPublicKey

    func associatedTokenAddress(owner: SolanaPublicKey, mint: SolanaPublicKey, tokenProgram: SolanaPublicKey) throws -> SolanaPublicKey {
        owner.base58 == "11111111111111111111111111111112" ? source : destination
    }
}

@Test func ed25519CurveCheckAcceptsBasepointAndRejectsNonCanonicalY() throws {
    let basepoint = try Data(hex: "5866666666666666666666666666666666666666666666666666666666666666")
    #expect(Ed25519CompressedPoint.isOnCurve(basepoint))

    // y = p = 2^255 - 19, the smallest non-canonical y-coordinate encoding.
    // Little-endian: 0xed, 30×0xff, 0x7f (sign bit clear). Exactly 32 bytes.
    let fieldModulus = try Data(hex: "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
    #expect(fieldModulus.count == 32)
    #expect(!Ed25519CompressedPoint.isOnCurve(fieldModulus))

    // y = p + 1, also >= p and therefore non-canonical.
    let fieldModulusPlusOne = try Data(hex: "eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
    #expect(fieldModulusPlusOne.count == 32)
    #expect(!Ed25519CompressedPoint.isOnCurve(fieldModulusPlusOne))
}

@Test func challengeRejectsInvalidDecimalsAndDefaultsWhenAbsent() throws {
    // Out-of-range decimals must throw, not crash via UInt8(value) trap.
    let bad = PaymentRequirement(
        scheme: "exact",
        network: X402SwiftExact.solanaDevnet,
        amount: "1000",
        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        payTo: "11111111111111111111111111111115",
        maxTimeoutSeconds: nil,
        extra: ["decimals": .number(999)]
    )
    #expect(throws: X402SwiftExactError.self) {
        _ = try bad.decimals()
    }

    let fractional = PaymentRequirement(
        scheme: "exact",
        network: X402SwiftExact.solanaDevnet,
        amount: "1000",
        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        payTo: "11111111111111111111111111111115",
        maxTimeoutSeconds: nil,
        extra: ["decimals": .number(6.5)]
    )
    #expect(throws: X402SwiftExactError.self) {
        _ = try fractional.decimals()
    }

    let negative = PaymentRequirement(
        scheme: "exact",
        network: X402SwiftExact.solanaDevnet,
        amount: "1000",
        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        payTo: "11111111111111111111111111111115",
        maxTimeoutSeconds: nil,
        extra: ["decimals": .number(-1)]
    )
    #expect(throws: X402SwiftExactError.self) {
        _ = try negative.decimals()
    }

    let absent = PaymentRequirement(
        scheme: "exact",
        network: X402SwiftExact.solanaDevnet,
        amount: "1000",
        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        payTo: "11111111111111111111111111111115",
        maxTimeoutSeconds: nil,
        extra: nil
    )
    #expect(try absent.decimals() == 6)
}

@Test func defaultATAResolverDerivesCanonicalAssociatedTokenAccounts() throws {
    let resolver = DefaultAssociatedTokenAddressResolver()
    let mint = try SolanaPublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    let tokenProgram = try SolanaPublicKey(X402SwiftExact.tokenProgram)

    let source = try resolver.associatedTokenAddress(
        owner: try SolanaPublicKey("11111111111111111111111111111112"),
        mint: mint,
        tokenProgram: tokenProgram
    )
    let destination = try resolver.associatedTokenAddress(
        owner: try SolanaPublicKey("11111111111111111111111111111115"),
        mint: mint,
        tokenProgram: tokenProgram
    )

    #expect(source.base58 == "4tRapEGgJZKuGoeeMRrpHsxAEuvo5YnDCzTXykqDhrK9")
    #expect(destination.base58 == "CFGbKktYnf4cVvvkVYXPCFfHKq6TE7zc9XdBKxqS5P4q")
}

@Test func parsesSolanaExactChallengeFromBody() throws {
    let json = """
    {"x402Version":2,"accepts":[
      {"scheme":"exact","network":"eip155:8453","amount":"1000","asset":"0x0","payTo":"0x0"},
      {"scheme":"exact","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","amount":"1000","asset":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","payTo":"11111111111111111111111111111111","extra":{"feePayer":"11111111111111111111111111111111","decimals":6}}
    ]}
    """
    let parsed = try parseX402Challenge(headers: [:], body: Data(json.utf8), selection: ChallengeSelection(network: "devnet"))
    let requirement = try #require(parsed)
    #expect(requirement.network == X402SwiftExact.solanaDevnet)
    #expect(requirement.asset == "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    #expect(requirement.feePayer == "11111111111111111111111111111111")
}

@Test func buildsBase64PaymentHeaderWithInjectedSignerAndBlockhash() async throws {
    let signer = FixedSigner(
        address: try SolanaPublicKey("11111111111111111111111111111112"),
        signature: Data(repeating: 7, count: 64)
    )
    let builder = ExactTransactionBuilder(
        signer: signer,
        blockhashProvider: FixedBlockhashProvider(blockhash: "11111111111111111111111111111111"),
        ataResolver: FixedATAResolver(
            source: try SolanaPublicKey("11111111111111111111111111111113"),
            destination: try SolanaPublicKey("11111111111111111111111111111114")
        )
    )
    let requirement = PaymentRequirement(
        scheme: "exact",
        network: X402SwiftExact.solanaDevnet,
        amount: "1000",
        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        payTo: "11111111111111111111111111111115",
        maxTimeoutSeconds: 300,
        extra: [
            "feePayer": .string("11111111111111111111111111111111"),
            "decimals": .number(6),
            "memo": .string("x402-swift-test"),
        ]
    )
    let header = try await builder.buildPaymentHeader(for: requirement)
    let decoded = try #require(Data(base64Encoded: header))
    let object = try #require(JSONSerialization.jsonObject(with: decoded) as? [String: Any])
    #expect(object["x402Version"] as? Int == 2)
    let payload = try #require(object["payload"] as? [String: Any])
    let tx = try #require(payload["transaction"] as? String)
    #expect(Data(base64Encoded: tx) != nil)
}

@Test func buildsPaymentHeaderWithDefaultATAResolver() async throws {
    let signer = FixedSigner(
        address: try SolanaPublicKey("11111111111111111111111111111112"),
        signature: Data(repeating: 9, count: 64)
    )
    let builder = ExactTransactionBuilder(
        signer: signer,
        blockhashProvider: FixedBlockhashProvider(blockhash: "11111111111111111111111111111111")
    )
    let requirement = PaymentRequirement(
        scheme: "exact",
        network: X402SwiftExact.solanaDevnet,
        amount: "1000",
        asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        payTo: "11111111111111111111111111111115",
        maxTimeoutSeconds: 300,
        extra: [
            "feePayer": .string("11111111111111111111111111111111"),
            "decimals": .number(6),
            "memo": .string("x402-swift-default-ata-test"),
        ]
    )

    let header = try await builder.buildPaymentHeader(for: requirement)
    let decoded = try #require(Data(base64Encoded: header))
    let object = try #require(JSONSerialization.jsonObject(with: decoded) as? [String: Any])
    let payload = try #require(object["payload"] as? [String: Any])
    let tx = try #require(payload["transaction"] as? String)
    #expect(Data(base64Encoded: tx) != nil)
}

#if canImport(CryptoKit)
@Test func memorySignerRejectsMismatchedEmbeddedPublicKey() throws {
    let privateKey = Curve25519.Signing.PrivateKey()
    let seed = [UInt8](privateKey.rawRepresentation)
    let derivedPublic = [UInt8](privateKey.publicKey.rawRepresentation)
    // Valid 64-byte construction first: must succeed.
    let valid = try MemorySolanaSigner(secretKey: seed + derivedPublic)
    #expect(valid.address.bytes.count == 32)

    // Now tamper the embedded public-key suffix: signer construction MUST reject.
    var tampered = derivedPublic
    tampered[0] ^= 0x01
    #expect(throws: X402SwiftExactError.self) {
        _ = try MemorySolanaSigner(secretKey: seed + tampered)
    }
}
#endif

private extension Data {
    init(hex: String) throws {
        guard hex.count.isMultiple(of: 2) else {
            throw X402SwiftExactError.invalidBase58(hex)
        }

        var bytes = [UInt8]()
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<next], radix: 16) else {
                throw X402SwiftExactError.invalidBase58(hex)
            }
            bytes.append(byte)
            index = next
        }
        self = Data(bytes)
    }
}
