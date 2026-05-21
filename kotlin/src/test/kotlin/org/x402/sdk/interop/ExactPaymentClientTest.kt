package org.x402.sdk.interop

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class ExactPaymentClientTest {
    @Test
    fun `creates v2 payment signature header with injected transaction signer`() {
        val builder = RecordingTransactionBuilder(byteArrayOf(1, 2, 3))
        val signer = RecordingTransactionSigner(byteArrayOf(9, 8, 7))
        val client = ExactPaymentClient(builder, signer)

        val headers = client.createPaymentHeaders(
            selected = selectedRequirement(
                extra = mapOf(
                    "feePayer" to "FeePayer1111111111111111111111111111",
                    "memo" to "order-123",
                ),
            ),
            payer = "Payer11111111111111111111111111111111",
        )

        val encoded = assertNotNull(headers["PAYMENT-SIGNATURE"])
        val envelope = JsonParser.parseString(
            String(Base64.getDecoder().decode(encoded), Charsets.UTF_8),
        ).asJsonObject

        assertEquals(2, envelope["x402Version"].asInt)
        assertEquals("exact", envelope["accepted"].asJsonObject["scheme"].asString)
        assertEquals(ExactChallenge.DEFAULT_NETWORK, envelope["accepted"].asJsonObject["network"].asString)
        assertEquals("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", envelope["accepted"].asJsonObject["asset"].asString)
        assertEquals("PayTo111111111111111111111111111111111", envelope["accepted"].asJsonObject["payTo"].asString)
        assertEquals("CQgH", envelope["payload"].asJsonObject["transaction"].asString)
        assertEquals("http://127.0.0.1:3000/protected", envelope["resource"].asJsonObject["url"].asString)

        assertEquals(1, builder.requests.size)
        assertEquals("Payer11111111111111111111111111111111", builder.requests.single().payer)
        assertEquals("FeePayer1111111111111111111111111111", builder.requests.single().feePayer)
        assertEquals("order-123", builder.requests.single().memo)
        assertContentEquals(byteArrayOf(1, 2, 3), signer.inputs.single())
    }

    @Test
    fun `rejects missing feePayer before constructing transaction`() {
        val builder = RecordingTransactionBuilder(byteArrayOf(1))
        val signer = RecordingTransactionSigner(byteArrayOf(2))
        val client = ExactPaymentClient(builder, signer)

        val error = assertFailsWith<IllegalArgumentException> {
            client.createPaymentHeaders(
                selected = selectedRequirement(extra = emptyMap()),
                payer = "Payer11111111111111111111111111111111",
            )
        }

        assertEquals("feePayer is required in paymentRequirements.extra for SVM transactions", error.message)
        assertEquals(0, builder.requests.size)
        assertEquals(0, signer.inputs.size)
    }

    @Test
    fun `rejects missing payTo before constructing transaction`() {
        val builder = RecordingTransactionBuilder(byteArrayOf(1))
        val signer = RecordingTransactionSigner(byteArrayOf(2))
        val client = ExactPaymentClient(builder, signer)

        val error = assertFailsWith<IllegalArgumentException> {
            client.createPaymentHeaders(
                selected = selectedRequirement(payTo = null),
                payer = "Payer11111111111111111111111111111111",
            )
        }

        assertEquals("payTo is required for SVM exact payment requirements", error.message)
        assertEquals(0, builder.requests.size)
        assertEquals(0, signer.inputs.size)
    }

    @Test
    fun `rejects oversized memo before constructing transaction`() {
        val builder = RecordingTransactionBuilder(byteArrayOf(1))
        val signer = RecordingTransactionSigner(byteArrayOf(2))
        val client = ExactPaymentClient(builder, signer)

        val error = assertFailsWith<IllegalArgumentException> {
            client.createPaymentHeaders(
                selected = selectedRequirement(
                    extra = mapOf(
                        "feePayer" to "FeePayer1111111111111111111111111111",
                        "memo" to "x".repeat(257),
                    ),
                ),
                payer = "Payer11111111111111111111111111111111",
            )
        }

        assertEquals("extra.memo exceeds maximum 256 bytes", error.message)
        assertEquals(0, builder.requests.size)
        assertEquals(0, signer.inputs.size)
    }
}

private class RecordingTransactionBuilder(
    private val unsignedTransaction: ByteArray,
) : SolanaExactTransactionBuilder {
    val requests = mutableListOf<SolanaExactPaymentRequest>()

    override fun buildUnsignedTransaction(request: SolanaExactPaymentRequest): ByteArray {
        requests.add(request)
        return unsignedTransaction
    }
}

private class RecordingTransactionSigner(
    private val signedTransaction: ByteArray,
) : SolanaTransactionSigner {
    val inputs = mutableListOf<ByteArray>()

    override fun signTransaction(unsignedTransaction: ByteArray): ByteArray {
        inputs.add(unsignedTransaction)
        return signedTransaction
    }
}

private fun selectedRequirement(
    payTo: String? = "PayTo111111111111111111111111111111111",
    extra: Map<String, String> = mapOf("feePayer" to "FeePayer1111111111111111111111111111"),
): SelectedChallenge {
    val raw = JsonObject().apply {
        addProperty("scheme", "exact")
        addProperty("network", ExactChallenge.DEFAULT_NETWORK)
        addProperty("asset", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
        addProperty("amount", "1000")
        if (payTo != null) {
            addProperty("payTo", payTo)
        }
        addProperty("maxTimeoutSeconds", 60)
        add(
            "extra",
            JsonObject().apply {
                extra.forEach { (key, value) -> addProperty(key, value) }
            },
        )
    }

    return SelectedChallenge(
        requirement = PaymentRequirement(
            scheme = "exact",
            network = ExactChallenge.DEFAULT_NETWORK,
            asset = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            amount = "1000",
            payTo = payTo,
            maxTimeoutSeconds = 60,
            extra = raw["extra"].asJsonObject.entrySet().associate { it.key to it.value },
            raw = raw,
        ),
        resource = ResourceInfo(
            url = "http://127.0.0.1:3000/protected",
            description = "fixture",
            mimeType = "application/json",
            raw = JsonObject().apply {
                addProperty("url", "http://127.0.0.1:3000/protected")
                addProperty("description", "fixture")
                addProperty("mimeType", "application/json")
            },
        ),
    )
}
