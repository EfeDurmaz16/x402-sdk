package org.x402.sdk.interop

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URI
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.EdECPrivateKeySpec
import java.security.spec.NamedParameterSpec
import kotlin.experimental.and

private const val TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
private const val TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
private const val ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
private const val COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111"
private const val MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
private const val PROGRAM_DERIVED_ADDRESS_MARKER = "ProgramDerivedAddress"
private const val DEFAULT_DECIMALS = 6

data class SolanaTokenMetadata(
    val tokenProgram: String,
    val decimals: Int,
)

interface SolanaRpc {
    fun latestBlockhash(): String
    fun tokenMetadata(mint: String): SolanaTokenMetadata?
}

class JsonRpcSolanaClient(private val rpcUrl: String) : SolanaRpc {
    private val gson = Gson()

    override fun latestBlockhash(): String {
        val result = rpc(
            "getLatestBlockhash",
            listOf(mapOf("commitment" to "confirmed")),
        )
        return result
            .getAsJsonObject("value")
            ?.get("blockhash")
            ?.asString
            ?: throw IllegalStateException("getLatestBlockhash response did not include value.blockhash")
    }

    override fun tokenMetadata(mint: String): SolanaTokenMetadata? {
        val result = rpc(
            "getAccountInfo",
            listOf(mint, mapOf("encoding" to "base64", "commitment" to "confirmed")),
        )
        val value = result.getAsJsonObject("value") ?: return null
        val owner = value.get("owner")?.asString ?: return null
        val data = value.get("data")
            ?.takeIf { it.isJsonArray }
            ?.asJsonArray
            ?.firstOrNull()
            ?.asString
            ?: return SolanaTokenMetadata(tokenProgram = owner, decimals = DEFAULT_DECIMALS)
        val decoded = java.util.Base64.getDecoder().decode(data)
        val decimals = decoded.getOrNull(44)?.toInt()?.and(0xff) ?: DEFAULT_DECIMALS
        return SolanaTokenMetadata(tokenProgram = owner, decimals = decimals)
    }

    private fun rpc(method: String, params: List<Any>): JsonObject {
        val connection = URI(rpcUrl).toURL().openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.doOutput = true
        connection.setRequestProperty("content-type", "application/json")
        val body = gson.toJson(
            mapOf(
                "jsonrpc" to "2.0",
                "id" to "x402-kotlin",
                "method" to method,
                "params" to params,
            ),
        )
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val status = connection.responseCode
        val stream = if (status >= 400) connection.errorStream else connection.inputStream
        val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        val parsed = JsonParser.parseString(response).asJsonObject
        parsed.get("error")?.let { error ->
            throw IllegalStateException("$method RPC failed: $error")
        }
        return parsed.getAsJsonObject("result")
            ?: throw IllegalStateException("$method RPC response did not include result")
    }
}

class MemorySolanaTransactionSigner(secretKey: ByteArray) : SolanaTransactionSigner {
    private val seed: ByteArray
    val publicKey: SolanaPublicKey

    init {
        require(secretKey.size == 64 || secretKey.size == 32) {
            "Solana secret key must be a 32-byte seed or 64-byte seed+public-key array"
        }
        seed = secretKey.copyOfRange(0, 32)
        publicKey = if (secretKey.size == 64) {
            SolanaPublicKey(secretKey.copyOfRange(32, 64))
        } else {
            // JDK Ed25519 exposes signing from a seed but not portable public-key
            // derivation. Interop uses the Solana 64-byte secret-key shape.
            throw IllegalArgumentException("32-byte seed cannot derive Solana public key in this adapter")
        }
    }

    override fun signMessage(message: ByteArray): ByteArray {
        val keyFactory = KeyFactory.getInstance("Ed25519")
        val privateKey = keyFactory.generatePrivate(
            EdECPrivateKeySpec(NamedParameterSpec("Ed25519"), seed),
        )
        return Signature.getInstance("Ed25519").run {
            initSign(privateKey)
            update(message)
            sign()
        }
    }

    companion object {
        fun fromJsonByteArray(raw: String): MemorySolanaTransactionSigner {
            val bytes = JsonParser.parseString(raw).asJsonArray.map { it.asInt.toByte() }.toByteArray()
            return MemorySolanaTransactionSigner(bytes)
        }
    }
}

class DefaultSolanaExactTransactionBuilder(
    private val rpc: SolanaRpc,
) : SolanaExactTransactionBuilder {
    override fun buildUnsignedTransaction(request: SolanaExactPaymentRequest): UnsignedSolanaTransaction {
        val payer = SolanaPublicKey.fromBase58(request.payer)
        val feePayer = SolanaPublicKey.fromBase58(request.feePayer)
        val mint = SolanaPublicKey.fromBase58(request.asset)
        val recipient = SolanaPublicKey.fromBase58(request.payTo)
        require(payer != feePayer) { "managed fee payer must not be the transfer authority" }

        val metadata = rpc.tokenMetadata(request.asset)
        val tokenProgram = SolanaPublicKey.fromBase58(
            request.accepted.string("tokenProgram")
                ?: request.accepted.extraString("tokenProgram")
                ?: metadata?.tokenProgram
                ?: stablecoinTokenProgram(request.asset),
        )
        val decimals = request.accepted.int("decimals")
            ?: request.accepted.extraInt("decimals")
            ?: metadata?.decimals
            ?: DEFAULT_DECIMALS
        val amount = request.amount.toULongOrNull()
            ?: throw IllegalArgumentException("amount must be an unsigned integer string")
        require(amount <= ULong.MAX_VALUE) { "amount is outside u64 range" }

        val sourceAta = associatedTokenAddress(owner = payer, mint = mint, tokenProgram = tokenProgram)
        val destinationAta = associatedTokenAddress(owner = recipient, mint = mint, tokenProgram = tokenProgram)
        val blockhash = request.accepted.extraString("recentBlockhash") ?: rpc.latestBlockhash()

        val instructions = listOfNotNull(
            computeUnitLimitInstruction(20_000u),
            computeUnitPriceInstruction(1u),
            transferCheckedInstruction(
                tokenProgram = tokenProgram,
                source = sourceAta,
                mint = mint,
                destination = destinationAta,
                owner = payer,
                amount = amount.toLong(),
                decimals = decimals,
            ),
            memoInstruction(request.memo ?: randomMemo()),
        )
        val message = SolanaTransactionCodec.compileV0Message(
            feePayer = feePayer,
            signers = listOf(feePayer, payer),
            instructions = instructions,
            recentBlockhash = SolanaPublicKey.fromBase58(blockhash),
        )
        return UnsignedSolanaTransaction(
            message = message.serialized,
            signatures = List(message.requiredSignatures) { ByteArray(UnsignedSolanaTransaction.SIGNATURE_LENGTH) },
            signerIndex = message.accountKeys.indexOf(payer).also {
                require(it >= 0) { "payer signer was not included in transaction account keys" }
            },
        )
    }
}

data class SolanaPublicKey(val bytes: ByteArray) {
    init {
        require(bytes.size == 32) { "Solana public keys must be 32 bytes" }
    }

    val base58: String get() = Base58.encode(bytes)

    override fun equals(other: Any?): Boolean = other is SolanaPublicKey && bytes.contentEquals(other.bytes)
    override fun hashCode(): Int = bytes.contentHashCode()
    override fun toString(): String = base58

    companion object {
        fun fromBase58(value: String): SolanaPublicKey = SolanaPublicKey(Base58.decode(value))
    }
}

data class AccountMeta(
    val publicKey: SolanaPublicKey,
    val signer: Boolean,
    val writable: Boolean,
)

data class SolanaInstruction(
    val programId: SolanaPublicKey,
    val accounts: List<AccountMeta>,
    val data: ByteArray,
)

data class CompiledMessage(
    val serialized: ByteArray,
    val accountKeys: List<SolanaPublicKey>,
    val requiredSignatures: Int,
)

object SolanaTransactionCodec {
    fun compileV0Message(
        feePayer: SolanaPublicKey,
        signers: List<SolanaPublicKey>,
        instructions: List<SolanaInstruction>,
        recentBlockhash: SolanaPublicKey,
    ): CompiledMessage {
        val writableSigners = linkedSetOf(feePayer)
        val readOnlySigners = linkedSetOf<SolanaPublicKey>()
        signers.filter { it != feePayer }.forEach { readOnlySigners.add(it) }

        val writableNonSigners = linkedSetOf<SolanaPublicKey>()
        val readOnlyNonSigners = linkedSetOf<SolanaPublicKey>()
        instructions.forEach { instruction ->
            instruction.accounts.forEach { account ->
                if (account.signer) {
                    if (account.writable) writableSigners.add(account.publicKey) else readOnlySigners.add(account.publicKey)
                } else {
                    if (account.writable) writableNonSigners.add(account.publicKey) else readOnlyNonSigners.add(account.publicKey)
                }
            }
            readOnlyNonSigners.add(instruction.programId)
        }

        val accountKeys = writableSigners.toList() + readOnlySigners.toList() +
            writableNonSigners.toList() + readOnlyNonSigners.toList()
        val requiredSignatures = writableSigners.size + readOnlySigners.size
        val out = ByteArrayBuilder()
        out.byte(0x80)
        out.byte(requiredSignatures)
        out.byte(readOnlySigners.size)
        out.byte(readOnlyNonSigners.size)
        out.compactU16(accountKeys.size)
        accountKeys.forEach { out.bytes(it.bytes) }
        out.bytes(recentBlockhash.bytes)
        out.compactU16(instructions.size)
        instructions.forEach { instruction ->
            out.byte(accountKeys.indexOf(instruction.programId))
            out.compactU16(instruction.accounts.size)
            instruction.accounts.forEach { out.byte(accountKeys.indexOf(it.publicKey)) }
            out.compactU16(instruction.data.size)
            out.bytes(instruction.data)
        }
        out.compactU16(0)
        return CompiledMessage(out.toByteArray(), accountKeys, requiredSignatures)
    }

    fun serializeTransaction(signatures: List<ByteArray>, message: ByteArray): ByteArray =
        ByteArrayBuilder().apply {
            compactU16(signatures.size)
            signatures.forEach { bytes(it) }
            bytes(message)
        }.toByteArray()

}

private fun computeUnitLimitInstruction(units: UInt): SolanaInstruction =
    SolanaInstruction(
        programId = SolanaPublicKey.fromBase58(COMPUTE_BUDGET_PROGRAM),
        accounts = emptyList(),
        data = byteArrayOf(2) + units.toLittleEndianBytes(),
    )

private fun computeUnitPriceInstruction(microLamports: UInt): SolanaInstruction =
    SolanaInstruction(
        programId = SolanaPublicKey.fromBase58(COMPUTE_BUDGET_PROGRAM),
        accounts = emptyList(),
        data = byteArrayOf(3) + microLamports.toULong().toLittleEndianBytes(),
    )

private fun transferCheckedInstruction(
    tokenProgram: SolanaPublicKey,
    source: SolanaPublicKey,
    mint: SolanaPublicKey,
    destination: SolanaPublicKey,
    owner: SolanaPublicKey,
    amount: Long,
    decimals: Int,
): SolanaInstruction =
    SolanaInstruction(
        programId = tokenProgram,
        accounts = listOf(
            AccountMeta(source, signer = false, writable = true),
            AccountMeta(mint, signer = false, writable = false),
            AccountMeta(destination, signer = false, writable = true),
            AccountMeta(owner, signer = true, writable = false),
        ),
        data = byteArrayOf(12) + amount.toULong().toLittleEndianBytes() + byteArrayOf(decimals.toByte()),
    )

private fun memoInstruction(memo: String): SolanaInstruction {
    val memoBytes = memo.toByteArray(Charsets.UTF_8)
    require(memoBytes.size <= MAX_MEMO_BYTES) { "extra.memo exceeds maximum $MAX_MEMO_BYTES bytes" }
    return SolanaInstruction(
        programId = SolanaPublicKey.fromBase58(MEMO_PROGRAM),
        accounts = emptyList(),
        data = memoBytes,
    )
}

fun associatedTokenAddress(
    owner: SolanaPublicKey,
    mint: SolanaPublicKey,
    tokenProgram: SolanaPublicKey,
): SolanaPublicKey =
    findProgramAddress(
        seeds = listOf(owner.bytes, tokenProgram.bytes, mint.bytes),
        programId = SolanaPublicKey.fromBase58(ASSOCIATED_TOKEN_PROGRAM),
    )

private fun findProgramAddress(seeds: List<ByteArray>, programId: SolanaPublicKey): SolanaPublicKey {
    for (bump in 255 downTo 0) {
        val candidate = createProgramAddress(seeds + byteArrayOf(bump.toByte()), programId)
        if (!Ed25519Curve.isOnCurve(candidate.bytes)) {
            return candidate
        }
    }
    throw IllegalStateException("Unable to find a viable program address bump seed")
}

private fun createProgramAddress(seeds: List<ByteArray>, programId: SolanaPublicKey): SolanaPublicKey {
    val digest = MessageDigest.getInstance("SHA-256")
    seeds.forEach { seed ->
        require(seed.size <= 32) { "Solana PDA seeds must be at most 32 bytes" }
        digest.update(seed)
    }
    digest.update(programId.bytes)
    digest.update(PROGRAM_DERIVED_ADDRESS_MARKER.toByteArray(Charsets.UTF_8))
    return SolanaPublicKey(digest.digest())
}

private fun stablecoinTokenProgram(asset: String): String = when (asset) {
    "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM",
    "4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7",
    "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
    -> TOKEN_2022_PROGRAM
    else -> TOKEN_PROGRAM
}

private fun randomMemo(): String {
    val bytes = ByteArray(16)
    java.security.SecureRandom().nextBytes(bytes)
    return bytes.joinToString("") { "%02x".format(it) }
}

private object Ed25519Curve {
    private val p = BigInteger.ONE.shiftLeft(255).subtract(BigInteger.valueOf(19))
    private val d = BigInteger("-121665").multiply(BigInteger("121666").modInverse(p)).mod(p)

    fun isOnCurve(compressed: ByteArray): Boolean {
        if (compressed.size != 32) return false
        val yBytes = compressed.copyOf()
        yBytes[31] = yBytes[31] and 0x7f
        val y = littleEndianToBigInteger(yBytes)
        if (y >= p) return false
        val y2 = y.multiply(y).mod(p)
        val numerator = y2.subtract(BigInteger.ONE).mod(p)
        val denominator = d.multiply(y2).add(BigInteger.ONE).mod(p)
        if (denominator == BigInteger.ZERO) return false
        val x2 = numerator.multiply(denominator.modInverse(p)).mod(p)
        return x2 == BigInteger.ZERO || x2.modPow(p.subtract(BigInteger.ONE).divide(BigInteger.TWO), p) == BigInteger.ONE
    }

    private fun littleEndianToBigInteger(bytes: ByteArray): BigInteger =
        BigInteger(1, bytes.reversedArray())
}

object Base58 {
    private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    private val indexes = IntArray(128) { -1 }.also { table ->
        ALPHABET.forEachIndexed { index, c -> table[c.code] = index }
    }

    fun encode(bytes: ByteArray): String {
        if (bytes.isEmpty()) return ""
        var zeros = 0
        while (zeros < bytes.size && bytes[zeros] == 0.toByte()) zeros++
        var value = BigInteger(1, bytes)
        val result = StringBuilder()
        val base = BigInteger.valueOf(58)
        while (value > BigInteger.ZERO) {
            val divRem = value.divideAndRemainder(base)
            result.append(ALPHABET[divRem[1].toInt()])
            value = divRem[0]
        }
        repeat(zeros) { result.append('1') }
        return result.reverse().toString()
    }

    fun decode(value: String): ByteArray {
        require(value.isNotBlank()) { "base58 value is required" }
        var result = BigInteger.ZERO
        val base = BigInteger.valueOf(58)
        value.forEach { char ->
            require(char.code < indexes.size && indexes[char.code] >= 0) { "invalid base58 character: $char" }
            result = result.multiply(base).add(BigInteger.valueOf(indexes[char.code].toLong()))
        }
        val raw = result.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
        val zeros = value.takeWhile { it == '1' }.count()
        return ByteArray(zeros) + raw
    }
}

private class ByteArrayBuilder {
    private val bytes = mutableListOf<Byte>()

    fun byte(value: Int) {
        require(value in 0..255) { "byte value out of range" }
        bytes.add(value.toByte())
    }

    fun bytes(value: ByteArray) {
        value.forEach { bytes.add(it) }
    }

    fun compactU16(value: Int) {
        var remaining = value
        do {
            var elem = remaining and 0x7f
            remaining = remaining ushr 7
            if (remaining != 0) elem = elem or 0x80
            byte(elem)
        } while (remaining != 0)
    }

    fun toByteArray(): ByteArray = bytes.toByteArray()
}

private fun UInt.toLittleEndianBytes(): ByteArray =
    byteArrayOf(
        (this and 0xffu).toByte(),
        ((this shr 8) and 0xffu).toByte(),
        ((this shr 16) and 0xffu).toByte(),
        ((this shr 24) and 0xffu).toByte(),
    )

private fun ULong.toLittleEndianBytes(): ByteArray =
    ByteArray(8) { index -> ((this shr (8 * index)) and 0xffu).toByte() }

private fun JsonObject.string(name: String): String? =
    get(name)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString

private fun JsonObject.int(name: String): Int? =
    get(name)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt

private fun JsonObject.extraString(name: String): String? =
    getAsJsonObject("extra")?.string(name)

private fun JsonObject.extraInt(name: String): Int? =
    getAsJsonObject("extra")?.int(name)
