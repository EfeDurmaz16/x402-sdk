package org.x402.sdk.interop

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.util.Base64

data class PaymentRequirement(
    val scheme: String,
    val network: String,
    val asset: String,
    val amount: String,
    val payTo: String? = null,
    val maxTimeoutSeconds: Int? = null,
    val extra: Map<String, JsonElement> = emptyMap(),
    val raw: JsonObject,
)

data class ResourceInfo(
    val url: String? = null,
    val description: String? = null,
    val mimeType: String? = null,
    val raw: JsonObject = JsonObject(),
)

data class SelectedChallenge(
    val requirement: PaymentRequirement,
    val resource: ResourceInfo? = null,
)

object ExactChallenge {
    const val DEFAULT_NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
    private val gson = Gson()

    fun selectSvmChallenge(
        headers: Map<String, String>,
        body: String?,
        network: String = DEFAULT_NETWORK,
        scheme: String = "exact",
        preferredCurrencies: List<String> = emptyList(),
    ): SelectedChallenge? {
        val envelopes = listOfNotNull(
            paymentRequiredHeader(headers),
            paymentRequiredBody(body),
        )

        for (envelope in envelopes) {
            val candidates = accepts(envelope)
                .filter { it.scheme == scheme && it.network == network }
                .filter { it.asset.isNotBlank() && it.amount.isNotBlank() }

            if (candidates.isEmpty()) {
                continue
            }

            val resource = resource(envelope)
            if (preferredCurrencies.isNotEmpty()) {
                for (currency in preferredCurrencies) {
                    val selected = candidates.firstOrNull {
                        currencyMatches(it.asset, currency, network) ||
                            currencyMatches(it.raw.string("currency"), currency, network)
                    }
                    if (selected != null) {
                        return SelectedChallenge(selected, resource)
                    }
                }
                continue
            }

            return SelectedChallenge(
                candidates.minBy { it.amount.toULongOrNull() ?: ULong.MAX_VALUE },
                resource,
            )
        }

        return null
    }

    private fun paymentRequiredHeader(headers: Map<String, String>): JsonObject? {
        val encoded = headers.entries
            .firstOrNull { it.key.equals("PAYMENT-REQUIRED", ignoreCase = true) }
            ?.value
            ?: return null

        return try {
            val decoded = String(Base64.getDecoder().decode(encoded), Charsets.UTF_8)
            JsonParser.parseString(decoded).asJsonObjectOrNull()
        } catch (_: RuntimeException) {
            null
        }
    }

    private fun paymentRequiredBody(body: String?): JsonObject? {
        if (body.isNullOrBlank()) {
            return null
        }

        return try {
            JsonParser.parseString(body).asJsonObjectOrNull()
        } catch (_: RuntimeException) {
            null
        }
    }

    private fun accepts(envelope: JsonObject): List<PaymentRequirement> {
        val accepts = envelope.get("accepts")?.asJsonArray ?: return emptyList()

        return accepts.mapNotNull { entry ->
            val obj = entry.asJsonObjectOrNull() ?: return@mapNotNull null
            val scheme = obj.string("scheme") ?: return@mapNotNull null
            val network = obj.string("network") ?: return@mapNotNull null
            val asset = obj.string("asset") ?: return@mapNotNull null
            val amount = obj.string("amount") ?: return@mapNotNull null
            PaymentRequirement(
                scheme = scheme,
                network = network,
                asset = asset,
                amount = amount,
                payTo = obj.string("payTo"),
                maxTimeoutSeconds = obj.get("maxTimeoutSeconds")?.takeIf { it.isJsonPrimitive }?.asInt,
                extra = obj.get("extra")?.asJsonObjectOrNull()?.entrySet()
                    ?.associate { it.key to it.value }
                    ?: emptyMap(),
                raw = obj,
            )
        }
    }

    private fun resource(envelope: JsonObject): ResourceInfo? {
        val obj = envelope.get("resource")?.asJsonObjectOrNull() ?: return null
        return ResourceInfo(
            url = obj.string("url"),
            description = obj.string("description"),
            mimeType = obj.string("mimeType"),
            raw = obj,
        )
    }

    private fun currencyMatches(offered: String?, accepted: String, network: String): Boolean {
        if (offered.isNullOrBlank()) {
            return false
        }
        return stablecoinMint(offered, network) == stablecoinMint(accepted, network)
    }

    fun stablecoinMint(currency: String, network: String): String {
        return when (currency.trim().uppercase()) {
            "USDC", "USD" -> if (network == DEFAULT_NETWORK || network == "devnet" || network == "localnet") {
                "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
            } else {
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            }
            "PYUSD" -> if (network == DEFAULT_NETWORK || network == "devnet" || network == "localnet") {
                "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"
            } else {
                "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"
            }
            "USDG" -> if (network == DEFAULT_NETWORK || network == "devnet" || network == "localnet") {
                "4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7"
            } else {
                "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH"
            }
            "USDT" -> "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
            "CASH" -> "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH"
            else -> currency.trim()
        }
    }

    fun resultJson(
        ok: Boolean,
        status: Int,
        responseHeaders: Map<String, String> = emptyMap(),
        responseBody: Any? = null,
        error: String? = null,
    ): String {
        val payload = linkedMapOf<String, Any?>(
            "type" to "result",
            "implementation" to "kotlin",
            "role" to "client",
            "ok" to ok,
            "status" to status,
            "responseHeaders" to responseHeaders,
            "responseBody" to responseBody,
        )
        if (error != null) {
            payload["error"] = error
        }
        return gson.toJson(payload)
    }
}

private fun JsonElement.asJsonObjectOrNull(): JsonObject? =
    if (isJsonObject) asJsonObject else null

private fun JsonObject.string(name: String): String? =
    get(name)?.takeIf { it.isJsonPrimitive }?.asString

