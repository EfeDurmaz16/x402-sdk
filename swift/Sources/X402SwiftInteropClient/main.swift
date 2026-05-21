import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import X402SwiftExact

@main
struct InteropClient {
    static func main() async throws {
        let target = try readRequiredURL("X402_INTEROP_TARGET_URL")
        let rpc = try readRequiredURL("X402_INTEROP_RPC_URL")
        let network = ProcessInfo.processInfo.environment["X402_INTEROP_NETWORK"] ?? X402SwiftExact.solanaDevnet
        let secret = try readSecretKey("X402_INTEROP_CLIENT_SECRET_KEY")
        #if canImport(CryptoKit)
        let signer = try MemorySolanaSigner(secretKey: secret)
        #else
        throw X402SwiftExactError.rpc("MemorySolanaSigner requires CryptoKit")
        #endif

        let (challengeData, challengeResponse) = try await URLSession.shared.data(from: target)
        let headers = (challengeResponse as? HTTPURLResponse)?.allHeaderFields.reduce(into: [String: String]()) { partial, entry in
            if let key = entry.key as? String, let value = entry.value as? String {
                partial[key] = value
            }
        } ?? [:]
        guard let requirement = try parseX402Challenge(headers: headers, body: challengeData, selection: ChallengeSelection(network: network)) else {
            throw X402SwiftExactError.missingChallenge
        }

        let builder = ExactTransactionBuilder(
            signer: signer,
            blockhashProvider: JsonRpcBlockhashProvider(rpcURL: rpc)
        )
        let payment = try await builder.buildPaymentHeader(for: requirement)
        var request = URLRequest(url: target)
        request.addValue(payment, forHTTPHeaderField: X402SwiftExact.paymentSignatureHeader)
        let (paidData, paidResponse) = try await URLSession.shared.data(for: request)
        let status = (paidResponse as? HTTPURLResponse)?.statusCode ?? 0
        let paidHeaders = (paidResponse as? HTTPURLResponse)?.allHeaderFields.reduce(into: [String: String]()) { partial, entry in
            if let key = entry.key as? String, let value = entry.value as? CustomStringConvertible {
                partial[key.lowercased()] = value.description
            }
        } ?? [:]
        let body = (try? JSONSerialization.jsonObject(with: paidData)) ?? (String(data: paidData, encoding: .utf8) ?? "")
        let result: [String: Any] = [
            "type": "result",
            "implementation": "swift",
            "role": "client",
            "ok": (200..<300).contains(status),
            "status": status,
            "responseHeaders": paidHeaders,
            "responseBody": body,
            "settlement": paidHeaders["x-fixture-settlement"] as Any,
        ]
        let encoded = try JSONSerialization.data(withJSONObject: result)
        print(String(data: encoded, encoding: .utf8)!)
    }
}

private func readRequiredURL(_ name: String) throws -> URL {
    guard let value = ProcessInfo.processInfo.environment[name], let url = URL(string: value) else {
        throw X402SwiftExactError.rpc("\(name) is required")
    }
    return url
}

private func readSecretKey(_ name: String) throws -> [UInt8] {
    guard let value = ProcessInfo.processInfo.environment[name],
          let data = value.data(using: .utf8),
          let parsed = try JSONSerialization.jsonObject(with: data) as? [Int] else {
        throw X402SwiftExactError.rpc("\(name) is required")
    }
    return try parsed.map {
        guard let byte = UInt8(exactly: $0) else {
            throw X402SwiftExactError.invalidSecretKeyLength($0)
        }
        return byte
    }
}
