import Foundation

public struct ChallengeSelection: Sendable {
    public var network: String?
    public var currencies: [String]?

    public init(network: String? = nil, currencies: [String]? = nil) {
        self.network = network
        self.currencies = currencies
    }
}

public struct PaymentRequirement: Equatable, Codable {
    public let scheme: String
    public let network: String
    public let amount: String
    public let asset: String
    public let payTo: String
    public let maxTimeoutSeconds: Int?
    public let extra: [String: JSONValue]?

    public var feePayer: String? {
        extra?["feePayer"]?.string ?? extra?["feePayerKey"]?.string
    }

    public var memo: String? {
        extra?["memo"]?.string
    }

    public var tokenProgram: String {
        extra?["tokenProgram"]?.string ?? X402SwiftExact.tokenProgram
    }

    public var decimals: UInt8 {
        if case .number(let value) = extra?["decimals"] {
            return UInt8(value)
        }
        return 6
    }
}

struct PaymentRequiredEnvelope: Codable {
    let x402Version: Int?
    let accepts: [PaymentRequirement]
}

public func parseX402Challenge(
    headers: [String: String],
    body: Data?,
    selection: ChallengeSelection = ChallengeSelection()
) throws -> PaymentRequirement? {
    if let header = headers.first(where: { $0.key.lowercased() == X402SwiftExact.paymentRequiredHeader.lowercased() })?.value,
       let decoded = Data(base64Encoded: header),
       let requirement = try selectRequirement(from: decoded, selection: selection) {
        return requirement
    }
    if let body, let requirement = try selectRequirement(from: body, selection: selection) {
        return requirement
    }
    return nil
}

private func selectRequirement(from data: Data, selection: ChallengeSelection) throws -> PaymentRequirement? {
    let envelope = try JSONDecoder().decode(PaymentRequiredEnvelope.self, from: data)
    let preferredNetwork = canonicalNetwork(selection.network ?? X402SwiftExact.solanaMainnet)
    let solana = envelope.accepts.filter { requirement in
        requirement.scheme == X402SwiftExact.exactScheme && requirement.network.starts(with: "solana:")
    }
    let onNetwork = solana.filter { canonicalNetwork($0.network) == preferredNetwork }
    let candidates = onNetwork.isEmpty ? solana : onNetwork
    if let currencies = selection.currencies, !currencies.isEmpty {
        for currency in currencies {
            if let match = candidates.first(where: { currencyMatches(offered: $0.asset, accepted: currency) }) {
                return match
            }
        }
        return nil
    }
    return candidates.min { lhs, rhs in
        (UInt64(lhs.amount) ?? UInt64.max) < (UInt64(rhs.amount) ?? UInt64.max)
    }
}

private func canonicalNetwork(_ network: String) -> String {
    switch network {
    case "devnet", "solana-devnet", X402SwiftExact.solanaDevnet:
        return X402SwiftExact.solanaDevnet
    case "mainnet", "mainnet-beta", X402SwiftExact.solanaMainnet:
        return X402SwiftExact.solanaMainnet
    default:
        return network
    }
}

private func currencyMatches(offered: String, accepted: String) -> Bool {
    if offered == accepted { return true }
    if accepted.uppercased() == "USDC" {
        return offered == "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
            || offered == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
    return false
}
