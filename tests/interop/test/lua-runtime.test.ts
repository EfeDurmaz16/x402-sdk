// Runtime adversarial probe for the Lua exact verifier.
//
// Spawns `lua bin/interop-server.lua` with X402_INTEROP_LUA_PROBE=1 (the
// stdin/stdout JSON probe hatch introduced alongside the P1.1/P1.2 fixes),
// hand-crafts versioned Solana transactions, and asserts that the Lua
// verifier accepts or rejects each shape exactly like the canonical Rust
// spine in `rust/src/protocol/schemes/exact/verify.rs`.
//
// The runtime probe is skipped (not failed) when a Lua interpreter is not
// installed locally, so the wider CI matrix keeps building on lean images.

import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SERVER_PATH = resolve(__dirname, "../../../lua/bin/interop-server.lua");
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

function findLua(): string | null {
  for (const bin of ["lua5.5", "lua5.4", "lua"]) {
    try {
      const result = require("node:child_process").spawnSync(bin, ["-v"]);
      if (result.status === 0 || result.status === null) {
        return bin;
      }
    } catch {
      // continue
    }
  }
  return null;
}

const LUA_BIN = findLua();

type ProbeRequest = Record<string, unknown>;
type ProbeResponse = { ok: boolean; result?: unknown; error?: string; ata?: string; on_curve?: boolean };

async function runProbe(requests: ProbeRequest[]): Promise<ProbeResponse[]> {
  if (!LUA_BIN) {
    throw new Error("lua interpreter not found");
  }
  return new Promise((resolveProbe, rejectProbe) => {
    const proc = spawn(LUA_BIN, [SERVER_PATH], {
      env: { ...process.env, X402_INTEROP_LUA_PROBE: "1" },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    proc.on("error", rejectProbe);
    proc.on("close", code => {
      if (code !== 0) {
        rejectProbe(new Error(`lua probe exit ${code}: ${stderr}`));
        return;
      }
      const lines = stdout.trim().split("\n").filter(Boolean);
      resolveProbe(lines.map(line => JSON.parse(line) as ProbeResponse));
    });
    proc.stdin.write(requests.map(request => JSON.stringify(request)).join("\n") + "\n");
    proc.stdin.end();
  });
}

// Minimal base58 encoder (Bitcoin alphabet). We avoid pulling a runtime
// dependency just for the test harness; the Solana SDKs in this repo do not
// expose a stable encode-by-bytes helper at the top of the @solana/kit
// surface, so a hand-rolled encoder is the simplest path.
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros += 1;
  }
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      const value = digits[j] * 256 + carry;
      digits[j] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = "";
  for (let i = 0; i < zeros; i += 1) {
    result += "1";
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += B58_ALPHABET[digits[i]];
  }
  return result;
}

function base58Decode(value: string): Uint8Array {
  let zeros = 0;
  while (zeros < value.length && value[zeros] === "1") {
    zeros += 1;
  }
  const bytes: number[] = [];
  for (let i = zeros; i < value.length; i += 1) {
    const digit = B58_ALPHABET.indexOf(value[i]);
    if (digit < 0) {
      throw new Error(`invalid base58 char: ${value[i]}`);
    }
    let carry = digit;
    for (let j = 0; j < bytes.length; j += 1) {
      const sum = bytes[j] * 58 + carry;
      bytes[j] = sum & 0xff;
      carry = sum >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry = carry >> 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[zeros + i] = bytes[bytes.length - 1 - i];
  }
  return out;
}

function shortVec(value: number): Uint8Array {
  const out: number[] = [];
  let v = value;
  while (true) {
    let byte = v & 0x7f;
    v = v >> 7;
    if (v === 0) {
      out.push(byte);
      break;
    }
    out.push(byte | 0x80);
  }
  return new Uint8Array(out);
}

function le8(value: bigint | number): Uint8Array {
  const buf = new Uint8Array(8);
  let v = BigInt(value);
  for (let i = 0; i < 8; i += 1) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

interface BuildInstruction {
  programIndex: number;
  accounts: number[];
  data: Uint8Array;
}

interface BuildOptions {
  requiredSignatures: number;
  numReadonlySigned: number;
  numReadonlyUnsigned: number;
  accountKeys: Uint8Array[];
  instructions: BuildInstruction[];
}

function buildVersionedTransaction(options: BuildOptions): Uint8Array {
  // Build the message body.
  const messageHeader = new Uint8Array([
    0x80,
    options.requiredSignatures,
    options.numReadonlySigned,
    options.numReadonlyUnsigned,
  ]);
  const accountCount = shortVec(options.accountKeys.length);
  const accountBytes = concatBytes(...options.accountKeys);
  const blockhash = new Uint8Array(32);
  const ixCount = shortVec(options.instructions.length);
  const ixBytes: Uint8Array[] = [];
  for (const ix of options.instructions) {
    ixBytes.push(new Uint8Array([ix.programIndex]));
    ixBytes.push(shortVec(ix.accounts.length));
    ixBytes.push(new Uint8Array(ix.accounts));
    ixBytes.push(shortVec(ix.data.length));
    ixBytes.push(ix.data);
  }
  const message = concatBytes(messageHeader, accountCount, accountBytes, blockhash, ixCount, ...ixBytes);
  const sigCount = shortVec(options.requiredSignatures);
  const sigs = new Uint8Array(options.requiredSignatures * 64);
  return concatBytes(sigCount, sigs, message);
}

// Deterministic 32-byte "pubkey" derived from a label. Not on-curve in
// general, but the Lua verifier only checks pubkey identity / PDA shape, not
// whether each account key is on-curve.
function deterministicKey(label: string): Uint8Array {
  return createHash("sha256").update(label).digest();
}

interface AtaSetup {
  payTo: Uint8Array;
  mint: Uint8Array;
  tokenProgram: Uint8Array;
  destinationAta: Uint8Array;
  sourceAta: Uint8Array;
}

async function deriveAta(payTo: Uint8Array, tokenProgram: Uint8Array, mint: Uint8Array): Promise<Uint8Array> {
  const responses = await runProbe([
    {
      op: "derive_ata",
      pay_to: base58Encode(payTo),
      token_program: base58Encode(tokenProgram),
      mint: base58Encode(mint),
    },
  ]);
  expect(responses[0].ok).toBe(true);
  return base58Decode((responses[0] as { ata: string }).ata);
}

interface ScenarioOptions {
  // When true, swap the destination account in transferChecked for an
  // attacker-controlled account that is NOT the canonical ATA.
  destinationAttack?: boolean;
  // When true, add an optional memo instruction that references the
  // fee-payer as one of its account metas.
  feePayerInMemoAccounts?: boolean;
  // When true, add a legitimate destination-ATA-create instruction so the
  // fee-payer appears at the funding-payer slot — this MUST still pass.
  includeLegitimateAtaCreate?: boolean;
}

interface Scenario {
  txB64: string;
  requirement: Record<string, unknown>;
  description: string;
}

async function buildExactScenario(options: ScenarioOptions): Promise<Scenario> {
  const feePayer = deterministicKey("scenario-fee-payer");
  const owner = deterministicKey("scenario-owner");
  const payTo = deterministicKey("scenario-recipient");
  const mint = deterministicKey("scenario-mint");
  const tokenProgram = base58Decode(TOKEN_PROGRAM);
  const computeBudget = base58Decode(COMPUTE_BUDGET);
  const memoProgram = base58Decode(MEMO_PROGRAM);
  const ataProgram = base58Decode(ATA_PROGRAM);
  const systemProgram = base58Decode(SYSTEM_PROGRAM);

  const sourceAta = deterministicKey("scenario-source-ata");
  const canonicalDestination = await deriveAta(payTo, tokenProgram, mint);
  const attackerDestination = deterministicKey("scenario-attacker-destination");

  const destination = options.destinationAttack ? attackerDestination : canonicalDestination;

  // Account key layout (1-based in Lua, 0-based here):
  //   0: feePayer (writable signer)
  //   1: owner (writable signer)
  //   2: sourceAta (writable)
  //   3: destination (writable)
  //   4: mint (readonly)
  //   5: payTo (readonly, used for legitimate ATA-create wallet slot)
  //   6: computeBudget (program)
  //   7: tokenProgram (program)
  //   8: memoProgram (program, conditional)
  //   9: ataProgram (program, conditional)
  //  10: systemProgram (account + program, conditional)
  const accountKeys: Uint8Array[] = [feePayer, owner, sourceAta, destination, mint, payTo, computeBudget, tokenProgram];
  let memoIndex = -1;
  let ataProgramIndex = -1;
  let systemProgramIndex = -1;
  if (options.feePayerInMemoAccounts) {
    memoIndex = accountKeys.length;
    accountKeys.push(memoProgram);
  }
  if (options.includeLegitimateAtaCreate) {
    ataProgramIndex = accountKeys.length;
    accountKeys.push(ataProgram);
    systemProgramIndex = accountKeys.length;
    accountKeys.push(systemProgram);
  }

  const instructions: BuildInstruction[] = [
    {
      programIndex: 6,
      accounts: [],
      // SetComputeUnitLimit: discriminator 2 + u32 LE.
      data: concatBytes(new Uint8Array([2]), new Uint8Array([0x10, 0x27, 0x00, 0x00])),
    },
    {
      programIndex: 6,
      accounts: [],
      // SetComputeUnitPrice: discriminator 3 + u64 LE.
      data: concatBytes(new Uint8Array([3]), le8(0n)),
    },
    {
      programIndex: 7,
      accounts: [2, 4, 3, 1],
      // TransferChecked: discriminator 12 + u64 amount + u8 decimals.
      data: concatBytes(new Uint8Array([12]), le8(1000n), new Uint8Array([6])),
    },
  ];

  if (options.includeLegitimateAtaCreate) {
    // ATA create with fee-payer as accounts[0] (funding payer), destination,
    // wallet=payTo, mint, systemProgram, tokenProgram. Matches the shape the
    // Lua verifier whitelists at `valid_destination_ata_create_instruction`.
    instructions.push({
      programIndex: ataProgramIndex,
      accounts: [0, 3, 5, 4, systemProgramIndex, 7],
      data: new Uint8Array([1]),
    });
  }

  if (options.feePayerInMemoAccounts) {
    instructions.push({
      programIndex: memoIndex,
      accounts: [0],
      data: new TextEncoder().encode("hello"),
    });
  }

  const tx = buildVersionedTransaction({
    requiredSignatures: 2,
    numReadonlySigned: 0,
    numReadonlyUnsigned: accountKeys.length - 2,
    accountKeys,
    instructions,
  });

  const requirement = {
    scheme: "exact",
    network: "solana:test",
    asset: base58Encode(mint),
    amount: "1000",
    payTo: base58Encode(payTo),
    maxTimeoutSeconds: 60,
    extra: {
      decimals: 6,
      feePayer: base58Encode(feePayer),
      tokenProgram: TOKEN_PROGRAM,
    },
  };

  return {
    txB64: Buffer.from(tx).toString("base64"),
    requirement,
    description: JSON.stringify(options),
  };
}

const describeRuntime = LUA_BIN ? describe : describe.skip;

describeRuntime("Lua exact verifier runtime adversarial suite", () => {
  it("derives ATA addresses identically to the Solana SPL helper", async () => {
    // Spot-checks across bump values exercised against the Python solders
    // reference during local development. These are stable cross-language
    // golden vectors; any regression here is a bignum bug.
    const cases: Array<[string, string]> = [
      ["11111111111111111111111111111111", "HJt8Tjdsc9ms9i4WCZEzhzr4oyf3ANcdzXrNdLPFqm3M"],
      ["So11111111111111111111111111111111111111112", "DHe62eeQVEnNK7vg5xUpDkJm7tuqHadjhvmPRFBG9UPo"],
      ["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", "C4PRXFV6Gf5mytVZb6RoeLsG8CjcFWzR2EJ3dvwPTUJH"],
    ];
    const responses = await runProbe(
      cases.map(([payTo]) => ({
        op: "derive_ata",
        pay_to: payTo,
        token_program: TOKEN_PROGRAM,
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      })),
    );
    for (let index = 0; index < cases.length; index += 1) {
      expect(responses[index].ok).toBe(true);
      expect((responses[index] as { ata: string }).ata).toBe(cases[index][1]);
    }
  });

  it("accepts a canonical exact transaction (positive control)", async () => {
    const scenario = await buildExactScenario({});
    const responses = await runProbe([
      { op: "verify_exact_transaction", transaction_b64: scenario.txB64, requirement: scenario.requirement },
    ]);
    expect(responses[0].ok, JSON.stringify(responses[0])).toBe(true);
  });

  it("accepts a legitimate destination-ATA-create instruction even though fee-payer funds it", async () => {
    // P1.1 carve-out: the fee-payer is legitimately the funding payer at
    // accounts[0] (0-based) / accounts[1] (1-based in Lua) of an ATA-create
    // instruction whose structural shape matches `valid_destination_ata_create_instruction`.
    const scenario = await buildExactScenario({ includeLegitimateAtaCreate: true });
    const responses = await runProbe([
      { op: "verify_exact_transaction", transaction_b64: scenario.txB64, requirement: scenario.requirement },
    ]);
    expect(responses[0].ok, JSON.stringify(responses[0])).toBe(true);
  });

  it("rejects a transaction whose memo instruction references the fee-payer (P1.1)", async () => {
    const scenario = await buildExactScenario({ feePayerInMemoAccounts: true });
    const responses = await runProbe([
      { op: "verify_exact_transaction", transaction_b64: scenario.txB64, requirement: scenario.requirement },
    ]);
    expect(responses[0].ok).toBe(false);
    expect(responses[0].error).toContain("invalid_exact_svm_payload_transaction_fee_payer_in_instruction_accounts");
  });

  it("rejects a transaction whose transferChecked destination is not the canonical ATA (P1.2)", async () => {
    const scenario = await buildExactScenario({ destinationAttack: true });
    const responses = await runProbe([
      { op: "verify_exact_transaction", transaction_b64: scenario.txB64, requirement: scenario.requirement },
    ]);
    expect(responses[0].ok).toBe(false);
    expect(responses[0].error).toContain("invalid_exact_svm_payload_destination_ata_mismatch");
  });
});
