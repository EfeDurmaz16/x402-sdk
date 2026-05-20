package org.x402.sdk.interop

import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ExactChallengeTest {
    @Test
    fun `selects Solana exact requirement from PAYMENT-REQUIRED header`() {
        val envelope = """
            {
              "accepts": [
                {
                  "scheme": "exact",
                  "network": "eip155:8453",
                  "asset": "0x0000000000000000000000000000000000000000",
                  "amount": "1000"
                },
                {
                  "scheme": "exact",
                  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                  "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                  "amount": "1000",
                  "payTo": "5T388jBjovy7d8mQ3emHxMDTbUF8b7nWvAnSiP3EAdFL",
                  "extra": { "feePayer": "HoCy8p5xxDDYTYWEbQZasEjVNM5rxvidx8AfyqA4ywBa" }
                }
              ],
              "resource": {
                "url": "http://127.0.0.1:3000/protected",
                "description": "fixture"
              }
            }
        """.trimIndent()
        val header = Base64.getEncoder().encodeToString(envelope.toByteArray(Charsets.UTF_8))

        val selected = ExactChallenge.selectSvmChallenge(
            headers = mapOf("PAYMENT-REQUIRED" to header),
            body = null,
        )

        assertNotNull(selected)
        assertEquals("exact", selected.requirement.scheme)
        assertEquals(ExactChallenge.DEFAULT_NETWORK, selected.requirement.network)
        assertEquals("1000", selected.requirement.amount)
        assertEquals("http://127.0.0.1:3000/protected", selected.resource?.url)
    }

    @Test
    fun `prefers requested stablecoin by symbol or mint`() {
        val body = """
            {
              "accepts": [
                {
                  "scheme": "exact",
                  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                  "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                  "amount": "1000"
                },
                {
                  "scheme": "exact",
                  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                  "asset": "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM",
                  "amount": "1000"
                }
              ]
            }
        """.trimIndent()

        val selected = ExactChallenge.selectSvmChallenge(
            headers = emptyMap(),
            body = body,
            preferredCurrencies = listOf("PYUSD", "USDC"),
        )

        assertNotNull(selected)
        assertEquals("CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM", selected.requirement.asset)
    }

    @Test
    fun `rejects network mismatch before payment construction`() {
        val body = """
            {
              "accepts": [
                {
                  "scheme": "exact",
                  "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                  "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                  "amount": "1000"
                }
              ]
            }
        """.trimIndent()

        val selected = ExactChallenge.selectSvmChallenge(headers = emptyMap(), body = body)

        assertNull(selected)
    }
}

