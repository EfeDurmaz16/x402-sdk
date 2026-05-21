package org.x402.sdk.interop

import java.net.HttpURLConnection
import java.net.URI

fun main() {
    val targetUrl = System.getenv("X402_INTEROP_TARGET_URL")

    if (targetUrl.isNullOrBlank()) {
        println(
            ExactChallenge.resultJson(
                ok = false,
                status = 0,
                error = "X402_INTEROP_TARGET_URL is required",
            ),
        )
        return
    }

    val firstResponse = get(targetUrl)
    val selected = ExactChallenge.selectSvmChallenge(
        headers = firstResponse.headers,
        body = firstResponse.body,
        network = System.getenv("X402_INTEROP_NETWORK") ?: ExactChallenge.DEFAULT_NETWORK,
        scheme = System.getenv("X402_INTEROP_SCHEME") ?: "exact",
        preferredCurrencies = System.getenv("X402_INTEROP_PREFER_CURRENCIES")
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList(),
    )

    if (selected == null) {
        println(
            ExactChallenge.resultJson(
                ok = false,
                status = firstResponse.status,
                responseHeaders = firstResponse.headers,
                responseBody = firstResponse.body,
                error = "No supported Solana exact payment requirement was found",
            ),
        )
        return
    }

    println(
        ExactChallenge.resultJson(
            ok = false,
            status = firstResponse.status,
            responseHeaders = firstResponse.headers,
            responseBody = mapOf(
                "selected" to mapOf(
                    "scheme" to selected.requirement.scheme,
                    "network" to selected.requirement.network,
                    "asset" to selected.requirement.asset,
                    "amount" to selected.requirement.amount,
                ),
            ),
            error = "Kotlin exact client scaffold can parse/select challenges and encode PAYMENT-SIGNATURE with injected transaction/signing adapters; a production Solana transaction builder is not implemented yet.",
        ),
    )
}

private data class HttpResponse(
    val status: Int,
    val headers: Map<String, String>,
    val body: String,
)

private fun get(url: String): HttpResponse {
    val connection = URI(url).toURL().openConnection() as HttpURLConnection
    connection.requestMethod = "GET"
    connection.connectTimeout = 10_000
    connection.readTimeout = 10_000

    val status = connection.responseCode
    val stream = if (status >= 400) connection.errorStream else connection.inputStream
    val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
    val headers = connection.headerFields
        .filterKeys { it != null }
        .mapValues { (_, values) -> values.joinToString(",") }

    return HttpResponse(status, headers, body)
}
