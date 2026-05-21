package org.x402.sdk.interop

import com.google.gson.JsonObject
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

class SolanaTransactionTest {
    @Test
    fun `base58 round trips public keys`() {
        val key = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        assertEquals(key, SolanaPublicKey.fromBase58(key).base58)
    }

    @Test
    fun `derives canonical associated token accounts`() {
        val mint = SolanaPublicKey.fromBase58("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
        val tokenProgram = SolanaPublicKey.fromBase58("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

        val source = associatedTokenAddress(
            owner = SolanaPublicKey.fromBase58("11111111111111111111111111111112"),
            mint = mint,
            tokenProgram = tokenProgram,
        )
        val destination = associatedTokenAddress(
            owner = SolanaPublicKey.fromBase58("11111111111111111111111111111115"),
            mint = mint,
            tokenProgram = tokenProgram,
        )

        assertEquals("4tRapEGgJZKuGoeeMRrpHsxAEuvo5YnDCzTXykqDhrK9", source.base58)
        assertEquals("CFGbKktYnf4cVvvkVYXPCFfHKq6TE7zc9XdBKxqS5P4q", destination.base58)
    }

    @Test
    fun `default builder creates partially signed exact transaction shape`() {
        val accepted = JsonObject().apply {
            addProperty("scheme", "exact")
            addProperty("network", ExactChallenge.DEFAULT_NETWORK)
            addProperty("asset", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
            addProperty("amount", "1000")
            addProperty("payTo", "11111111111111111111111111111115")
            add(
                "extra",
                JsonObject().apply {
                    addProperty("feePayer", "11111111111111111111111111111111")
                    addProperty("decimals", 6)
                    addProperty("tokenProgram", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                    addProperty("memo", "order-123")
                },
            )
        }
        val request = SolanaExactPaymentRequest(
            payer = "11111111111111111111111111111112",
            network = ExactChallenge.DEFAULT_NETWORK,
            asset = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            amount = "1000",
            payTo = "11111111111111111111111111111115",
            feePayer = "11111111111111111111111111111111",
            memo = "order-123",
            maxTimeoutSeconds = 60,
            accepted = accepted,
        )

        val tx = DefaultSolanaExactTransactionBuilder(FixedRpc).buildUnsignedTransaction(request)

        assertEquals(2, tx.signatures.size)
        assertEquals(1, tx.signerIndex)
        assertEquals(0x80, tx.message[0].toInt() and 0xff)
        assertEquals(2, tx.message[1].toInt())
        assertContentEquals(ByteArray(64), tx.signatures[0])
    }
}

private object FixedRpc : SolanaRpc {
    override fun latestBlockhash(): String = "11111111111111111111111111111111"

    override fun tokenMetadata(mint: String): SolanaTokenMetadata =
        SolanaTokenMetadata(
            tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            decimals = 6,
        )
}
