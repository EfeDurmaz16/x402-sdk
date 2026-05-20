import Foundation
import Testing
@testable import X402SwiftExact

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
