local socket = require("socket")
local http = require("socket.http")
local ltn12 = require("ltn12")
local json = require("dkjson")
local sodium = require("luasodium")
local luazen = require("luazen")

local function raw_json(value)
  return { __raw_json = value }
end

local function json_string(value)
  return '"' .. tostring(value):gsub("\\", "\\\\"):gsub('"', '\\"') .. '"'
end

local function json_object(fields)
  local parts = {}
  for _, field in ipairs(fields) do
    local key = field[1]
    local value = field[2]
    if type(value) == "boolean" then
      table.insert(parts, json_string(key) .. ":" .. tostring(value))
    elseif type(value) == "number" then
      table.insert(parts, json_string(key) .. ":" .. tostring(value))
    elseif type(value) == "table" and value.__raw_json then
      table.insert(parts, json_string(key) .. ":" .. value.__raw_json)
    elseif type(value) == "table" then
      local items = {}
      for _, item in ipairs(value) do
        table.insert(items, json_string(item))
      end
      table.insert(parts, json_string(key) .. ":[" .. table.concat(items, ",") .. "]")
    else
      table.insert(parts, json_string(key) .. ":" .. json_string(value))
    end
  end
  return "{" .. table.concat(parts, ",") .. "}"
end

local function read_headers(client)
  local headers = {}
  while true do
    local line = client:receive("*l")
    if not line or line == "" then
      break
    end

    local name, value = line:match("^([^:]+):%s*(.*)$")
    if name then
      headers[name:lower()] = value
    end
  end
  return headers
end

local function header_value(headers, name)
  return headers[name:lower()]
end

local function must_json_decode(raw, label)
  local decoded, _, decode_error = json.decode(raw, 1, nil)
  if decoded == nil then
    error(label .. " JSON decode failed: " .. tostring(decode_error))
  end
  return decoded
end

local function must_json_encode(value, label)
  local encoded = json.encode(value)
  if type(encoded) ~= "string" then
    error(label .. " JSON encode failed")
  end
  return encoded
end

local base64_alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local base64_lookup = {}
for index = 1, #base64_alphabet do
  base64_lookup[base64_alphabet:sub(index, index)] = index - 1
end

local function base64_decode(input)
  if type(input) ~= "string" or input == "" then
    return nil, "empty payment header"
  end

  local clean = input:gsub("%s", "")
  if clean:find("[^A-Za-z0-9+/=]") then
    return nil, "invalid base64 character"
  end

  local output = {}
  local buffer = 0
  local bits = 0
  local padding_started = false

  for index = 1, #clean do
    local char = clean:sub(index, index)
    if char == "=" then
      padding_started = true
    else
      if padding_started then
        return nil, "invalid base64 padding"
      end

      local value = base64_lookup[char]
      if value == nil then
        return nil, "invalid base64 character"
      end

      buffer = (buffer << 6) | value
      bits = bits + 6
      if bits >= 8 then
        bits = bits - 8
        local byte = (buffer >> bits) & 0xff
        table.insert(output, string.char(byte))
        buffer = buffer & ((1 << bits) - 1)
      end
    end
  end

  return table.concat(output)
end

local function base64_encode(input)
  local output = {}
  local index = 1

  while index <= #input do
    local byte1 = input:byte(index) or 0
    local byte2 = input:byte(index + 1) or 0
    local byte3 = input:byte(index + 2) or 0
    local triple = (byte1 << 16) | (byte2 << 8) | byte3

    local char1 = ((triple >> 18) & 0x3f) + 1
    local char2 = ((triple >> 12) & 0x3f) + 1
    local char3 = ((triple >> 6) & 0x3f) + 1
    local char4 = (triple & 0x3f) + 1

    table.insert(output, base64_alphabet:sub(char1, char1))
    table.insert(output, base64_alphabet:sub(char2, char2))
    if index + 1 <= #input then
      table.insert(output, base64_alphabet:sub(char3, char3))
    else
      table.insert(output, "=")
    end
    if index + 2 <= #input then
      table.insert(output, base64_alphabet:sub(char4, char4))
    else
      table.insert(output, "=")
    end

    index = index + 3
  end

  return table.concat(output)
end

local function base58_decode(value)
  local decoded = luazen.b58decode(value)
  if type(decoded) ~= "string" or #decoded ~= 32 then
    error("invalid base58 public key")
  end
  return decoded
end

local function base58_encode(value)
  return luazen.b58encode(value)
end

local function read_short_vec(bytes, offset)
  local value = 0
  local shift = 0
  local index = offset
  while true do
    if index > #bytes then
      error("short vec extends beyond input")
    end
    local byte = bytes:byte(index)
    value = value | ((byte & 0x7f) << shift)
    index = index + 1
    if (byte & 0x80) == 0 then
      return value, index
    end
    shift = shift + 7
    if shift > 28 then
      error("short vec is too long")
    end
  end
end

local function uint64_le(bytes)
  if #bytes ~= 8 then
    error("expected 8 byte little-endian integer")
  end
  local value = 0
  for index = 8, 1, -1 do
    value = (value << 8) | bytes:byte(index)
  end
  return value
end

local function account_key_for_index(account_keys, index)
  local value = account_keys[index + 1]
  if not value then
    error("invalid_exact_svm_payload_no_transfer_instruction")
  end
  return value
end

local function parse_versioned_transaction(transaction)
  local signature_count, signature_offset = read_short_vec(transaction, 1)
  local message_offset = signature_offset + (signature_count * 64)
  if message_offset > #transaction then
    error("transaction has no message bytes")
  end

  local message = transaction:sub(message_offset)
  if message:byte(1) ~= 0x80 then
    error("expected versioned transaction message")
  end
  if #message < 4 then
    error("transaction message header extends beyond input")
  end

  local required_signatures = message:byte(2)
  local account_count, offset = read_short_vec(message, 5)
  local account_keys = {}
  for index = 1, account_count do
    if offset + 31 > #message then
      error("message account key extends beyond input")
    end
    account_keys[index] = message:sub(offset, offset + 31)
    offset = offset + 32
  end
  if offset + 31 > #message then
    error("message recent blockhash extends beyond input")
  end
  offset = offset + 32

  local instruction_count
  instruction_count, offset = read_short_vec(message, offset)
  local instructions = {}
  for index = 1, instruction_count do
    if offset > #message then
      error("instruction program index extends beyond input")
    end
    local program_index = message:byte(offset)
    offset = offset + 1
    local account_index_count
    account_index_count, offset = read_short_vec(message, offset)
    if offset + account_index_count - 1 > #message then
      error("instruction account indexes extend beyond input")
    end
    local accounts = {}
    for account_index = 1, account_index_count do
      accounts[account_index] = message:byte(offset + account_index - 1)
    end
    offset = offset + account_index_count
    local data_length
    data_length, offset = read_short_vec(message, offset)
    if offset + data_length - 1 > #message then
      error("instruction data extends beyond input")
    end
    local data = message:sub(offset, offset + data_length - 1)
    offset = offset + data_length
    instructions[index] = { program_index = program_index, accounts = accounts, data = data }
  end

  return {
    signature_count = signature_count,
    signature_offset = signature_offset,
    message_offset = message_offset,
    message = message,
    required_signatures = required_signatures,
    account_keys = account_keys,
    instructions = instructions,
  }
end

local function extract_json_object(json, key)
  local _, object_start = json:find('"' .. key .. '"%s*:%s*{')
  if not object_start then
    return nil
  end

  local depth = 0
  local in_string = false
  local escaped = false

  for index = object_start, #json do
    local char = json:sub(index, index)
    if in_string then
      if escaped then
        escaped = false
      elseif char == "\\" then
        escaped = true
      elseif char == '"' then
        in_string = false
      end
    elseif char == '"' then
      in_string = true
    elseif char == "{" then
      depth = depth + 1
    elseif char == "}" then
      depth = depth - 1
      if depth == 0 then
        return json:sub(object_start, index)
      end
    end
  end

  return nil
end

local function json_string_field(json, key)
  return json:match('"' .. key .. '"%s*:%s*"([^"]*)"')
end

local server = assert(socket.bind("127.0.0.1", 0))
local _, port = server:getsockname()

local default_resource_path = "/protected"
local default_network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
local default_mint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
local default_amount = "1000"
local default_pay_to = "11111111111111111111111111111111"
local default_fee_payer = "11111111111111111111111111111111"
local default_token_program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
local token_2022_program = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
local compute_budget_program = "ComputeBudget111111111111111111111111111111"
local memo_program = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
local lighthouse_program = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95"
local associated_token_program = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
local system_program = "11111111111111111111111111111111"
local max_compute_unit_price = 5000000
local max_memo_bytes = 256
local duplicate_cache_ttl = 120
local settlement_cache = {}
local capability_payload = {
  { "implementation", "lua" },
  { "role", "server" },
  { "capabilities", { "exact" } }
}

local function read_env(name, fallback)
  local value = os.getenv(name)
  if value == nil or value == "" then
    return fallback
  end
  return value
end

local function normalize_amount(price)
  local value = tostring(price):match("^%s*(.-)%s*$")
  value = value:gsub("^%$", "")
  value = value:match("^(%S+)") or value

  local whole, fraction = value:match("^(%d+)%.?(%d*)$")
  if not whole then
    return default_amount
  end
  if #fraction > 6 then
    return default_amount
  end

  fraction = fraction .. string.rep("0", 6 - #fraction)
  return tostring((tonumber(whole) * 1000000) + tonumber(fraction))
end

local function required_env(name)
  local value = os.getenv(name)
  if value == nil or value == "" then
    error(name .. " is required")
  end
  return value
end

local function exact_requirement_table()
  return {
    scheme = "exact",
    network = read_env("X402_INTEROP_NETWORK", default_network),
    asset = read_env("X402_INTEROP_MINT", default_mint),
    amount = normalize_amount(read_env("X402_INTEROP_PRICE", "$0.001")),
    payTo = read_env("X402_INTEROP_PAY_TO", default_pay_to),
    maxTimeoutSeconds = 60,
    extra = {
      decimals = 6,
      feePayer = read_env("X402_INTEROP_FEE_PAYER", default_fee_payer),
      tokenProgram = default_token_program,
    }
  }
end

local function exact_requirement_json()
  local extra = json_object({
    { "decimals", 6 },
    { "feePayer", read_env("X402_INTEROP_FEE_PAYER", default_fee_payer) },
    { "tokenProgram", default_token_program }
  })

  return json_object({
    { "scheme", "exact" },
    { "network", read_env("X402_INTEROP_NETWORK", default_network) },
    { "asset", read_env("X402_INTEROP_MINT", default_mint) },
    { "amount", normalize_amount(read_env("X402_INTEROP_PRICE", "$0.001")) },
    { "payTo", read_env("X402_INTEROP_PAY_TO", default_pay_to) },
    { "maxTimeoutSeconds", 60 },
    { "extra", raw_json(extra) }
  })
end

local function exact_challenge_json()
  return json_object({
    { "x402Version", 2 },
    { "accepts", raw_json("[" .. exact_requirement_json() .. "]") },
    { "resource", raw_json(json_object({ { "type", "http" }, { "uri", default_resource_path } })) }
  })
end

local function exact_payment_required_header()
  return base64_encode(exact_challenge_json())
end

local function accepted_requirement_matches(accepted)
  local expected = exact_requirement_table()
  if type(accepted) ~= "table" or type(accepted.extra) ~= "table" then
    return false
  end
  return accepted.scheme == expected.scheme and
    accepted.network == expected.network and
    accepted.asset == expected.asset and
    tostring(accepted.amount) == expected.amount and
    accepted.payTo == expected.payTo and
    tostring(accepted.extra.decimals) == tostring(expected.extra.decimals) and
    accepted.extra.feePayer == expected.extra.feePayer and
    accepted.extra.tokenProgram == expected.extra.tokenProgram
end

local function decode_payment_signature(payment_header)
  local decoded, decode_error = base64_decode(payment_header)
  if not decoded then
    error("malformed PAYMENT-SIGNATURE: " .. decode_error)
  end
  return must_json_decode(decoded, "PAYMENT-SIGNATURE")
end

local function keypair_from_json_secret(raw)
  local values = must_json_decode(raw, "Solana secret key")
  if type(values) ~= "table" or #values ~= 64 then
    error("expected a 64-byte Solana secret key JSON array")
  end
  local seed = {}
  for index = 1, 32 do
    seed[index] = string.char(values[index])
  end
  local public_key, secret_key = sodium.crypto_sign_seed_keypair(table.concat(seed))
  if type(public_key) ~= "string" or #public_key ~= 32 or type(secret_key) ~= "string" or #secret_key ~= 64 then
    error("failed to derive Ed25519 keypair")
  end
  return { public_key = public_key, secret_key = secret_key }
end

local function instruction_program(instruction, account_keys)
  return account_key_for_index(account_keys, instruction.program_index)
end

local function verify_compute_limit_instruction(instruction, account_keys)
  if instruction_program(instruction, account_keys) ~= base58_decode(compute_budget_program) or
      #instruction.data ~= 5 or instruction.data:byte(1) ~= 2 then
    error("invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction")
  end
end

local function verify_compute_price_instruction(instruction, account_keys)
  if instruction_program(instruction, account_keys) ~= base58_decode(compute_budget_program) or
      #instruction.data ~= 9 or instruction.data:byte(1) ~= 3 then
    error("invalid_exact_svm_payload_transaction_instructions_compute_price_instruction")
  end
  if uint64_le(instruction.data:sub(2, 9)) > max_compute_unit_price then
    error("invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high")
  end
end

local function parse_transfer_checked_instruction(instruction, account_keys)
  local program = instruction_program(instruction, account_keys)
  local allowed_token_program = base58_decode(default_token_program)
  local allowed_token_2022_program = base58_decode(token_2022_program)
  if program ~= allowed_token_program and program ~= allowed_token_2022_program then
    error("invalid_exact_svm_payload_transaction_transfer_program")
  end
  if #instruction.accounts < 4 or #instruction.data ~= 10 or instruction.data:byte(1) ~= 12 then
    error("invalid_exact_svm_payload_transaction_transfer_checked")
  end
  return {
    source = account_key_for_index(account_keys, instruction.accounts[1]),
    mint = account_key_for_index(account_keys, instruction.accounts[2]),
    destination = account_key_for_index(account_keys, instruction.accounts[3]),
    authority = account_key_for_index(account_keys, instruction.accounts[4]),
    amount = uint64_le(instruction.data:sub(2, 9)),
    decimals = instruction.data:byte(10),
    token_program = program,
  }
end

local function valid_destination_ata_create_instruction(instruction, account_keys, requirement, transfer)
  if #instruction.data > 1 then
    return false
  end
  if #instruction.data == 1 and instruction.data:byte(1) ~= 0 and instruction.data:byte(1) ~= 1 then
    return false
  end
  if #instruction.accounts < 6 then
    return false
  end
  return account_key_for_index(account_keys, instruction.accounts[1]) == transfer.destination and
    account_key_for_index(account_keys, instruction.accounts[2]) == base58_decode(requirement.payTo) and
    account_key_for_index(account_keys, instruction.accounts[3]) == transfer.mint and
    account_key_for_index(account_keys, instruction.accounts[4]) == base58_decode(system_program) and
    account_key_for_index(account_keys, instruction.accounts[5]) == transfer.token_program
end

local function verify_optional_instructions(instructions, account_keys, requirement, transfer)
  local memo_count = 0
  for index = 4, #instructions do
    local instruction = instructions[index]
    local program = instruction_program(instruction, account_keys)
    if program == base58_decode(memo_program) then
      memo_count = memo_count + 1
      if #instruction.data > max_memo_bytes then
        error("extra.memo exceeds maximum 256 bytes")
      end
      if requirement.extra.memo and instruction.data ~= requirement.extra.memo then
        error("invalid_exact_svm_payload_transaction_memo")
      end
    elseif program == base58_decode(lighthouse_program) then
      -- Lighthouse is an allowed optional settlement instruction.
    elseif program == base58_decode(associated_token_program) and valid_destination_ata_create_instruction(instruction, account_keys, requirement, transfer) then
      -- Destination ATA creation may be included before settlement.
    else
      local reasons = {
        "invalid_exact_svm_payload_unknown_fourth_instruction",
        "invalid_exact_svm_payload_unknown_fifth_instruction",
        "invalid_exact_svm_payload_unknown_sixth_instruction",
      }
      error(reasons[index - 3] or "invalid_exact_svm_payload_unknown_optional_instruction")
    end
  end
  if requirement.extra.memo and memo_count ~= 1 then
    error("invalid_exact_svm_payload_transaction_memo")
  end
end

local function verify_exact_transaction(parsed, requirement)
  local instructions = parsed.instructions
  if #instructions < 3 or #instructions > 6 then
    error("invalid_exact_svm_payload_transaction_instructions_length")
  end
  verify_compute_limit_instruction(instructions[1], parsed.account_keys)
  verify_compute_price_instruction(instructions[2], parsed.account_keys)
  local transfer = parse_transfer_checked_instruction(instructions[3], parsed.account_keys)
  verify_optional_instructions(instructions, parsed.account_keys, requirement, transfer)

  local fee_payer = base58_decode(requirement.extra.feePayer)
  for _, instruction in ipairs(instructions) do
    for _, account_index in ipairs(instruction.accounts) do
      if account_key_for_index(parsed.account_keys, account_index) == fee_payer then
        error("invalid_exact_svm_payload_transaction_fee_payer_transferring_funds")
      end
    end
  end
  if transfer.authority == fee_payer or transfer.source == fee_payer then
    error("invalid_exact_svm_payload_transaction_fee_payer_transferring_funds")
  end
  if transfer.mint ~= base58_decode(requirement.asset) then
    error("invalid_exact_svm_payload_transaction_mint")
  end
  if transfer.amount ~= tonumber(requirement.amount) then
    error("invalid_exact_svm_payload_transaction_amount")
  end
  if transfer.decimals ~= tonumber(requirement.extra.decimals) then
    error("invalid_exact_svm_payload_transaction_decimals")
  end
  return transfer
end

local function required_signer_index(parsed, public_key)
  for index = 1, parsed.required_signatures do
    if parsed.account_keys[index] == public_key then
      return index - 1
    end
  end
  error("fee payer not found in required signer accounts")
end

local function sign_transaction_with_fee_payer(transaction, parsed, keypair)
  local signer_index = required_signer_index(parsed, keypair.public_key)
  if signer_index >= parsed.signature_count then
    error("fee payer is not present in transaction signatures")
  end
  local signature = sodium.crypto_sign_detached(parsed.message, keypair.secret_key)
  local start = parsed.signature_offset + (signer_index * 64)
  return transaction:sub(1, start - 1) .. signature .. transaction:sub(start + 64)
end

local function verify_transaction_signatures(transaction, parsed)
  for index = 1, parsed.required_signatures do
    local signature_start = parsed.signature_offset + ((index - 1) * 64)
    local signature = transaction:sub(signature_start, signature_start + 63)
    if not sodium.crypto_sign_verify_detached(signature, parsed.message, parsed.account_keys[index]) then
      error("invalid transaction signature")
    end
  end
end

local function post_json_rpc(method, params)
  local body = must_json_encode({ jsonrpc = "2.0", id = 1, method = method, params = params }, method)
  local chunks = {}
  local ok, status = http.request({
    url = required_env("X402_INTEROP_RPC_URL"),
    method = "POST",
    headers = {
      ["content-type"] = "application/json",
      ["content-length"] = tostring(#body),
    },
    source = ltn12.source.string(body),
    sink = ltn12.sink.table(chunks),
  })
  if not ok or status < 200 or status >= 300 then
    error(method .. " HTTP " .. tostring(status))
  end
  local payload = must_json_decode(table.concat(chunks), method)
  if payload.error ~= nil then
    error(method .. " RPC error: " .. must_json_encode(payload.error, method .. " error"))
  end
  return payload.result
end

local function get_account_data(public_key)
  local result = post_json_rpc("getAccountInfo", {
    base58_encode(public_key),
    { encoding = "base64" },
  })
  if result == nil or result.value == nil then
    return nil
  end
  local data = result.value.data
  if type(data) ~= "table" or type(data[1]) ~= "string" then
    return nil
  end
  local decoded, decode_error = base64_decode(data[1])
  if not decoded then
    error("account data decode failed: " .. decode_error)
  end
  return decoded
end

local function verify_token_account(public_key, expected_mint, expected_owner)
  local data = get_account_data(public_key)
  if data == nil then
    return false
  end
  if #data < 64 then
    error("token account data too short")
  end
  if data:sub(1, 32) ~= expected_mint then
    error("token account mint mismatch")
  end
  if expected_owner and data:sub(33, 64) ~= expected_owner then
    error("token account owner mismatch")
  end
  return true
end

local function has_destination_create_instruction(parsed, requirement, transfer)
  for index = 4, #parsed.instructions do
    local instruction = parsed.instructions[index]
    if instruction_program(instruction, parsed.account_keys) == base58_decode(associated_token_program) and
        valid_destination_ata_create_instruction(instruction, parsed.account_keys, requirement, transfer) then
      return true
    end
  end
  return false
end

local function verify_token_accounts_exist(parsed, requirement, transfer)
  local expected_mint = base58_decode(requirement.asset)
  if not verify_token_account(transfer.source, expected_mint, nil) then
    error("source token account does not exist")
  end
  if has_destination_create_instruction(parsed, requirement, transfer) then
    return
  end
  if not verify_token_account(transfer.destination, expected_mint, base58_decode(requirement.payTo)) then
    error("destination token account does not exist")
  end
end

local function transaction_cache_key(transaction)
  return base64_encode(sodium.crypto_hash_sha256(transaction))
end

local function claim_settlement(cache_key)
  local now = socket.gettime()
  for key, seen_at in pairs(settlement_cache) do
    if now - seen_at > duplicate_cache_ttl then
      settlement_cache[key] = nil
    end
  end
  if settlement_cache[cache_key] then
    return false
  end
  settlement_cache[cache_key] = now
  return true
end

local function release_settlement(cache_key)
  settlement_cache[cache_key] = nil
end

local function send_transaction(transaction)
  local result = post_json_rpc("sendTransaction", {
    base64_encode(transaction),
    {
      encoding = "base64",
      skipPreflight = false,
      preflightCommitment = "processed",
      maxRetries = 3,
    },
  })
  if type(result) ~= "string" or result == "" then
    error("sendTransaction returned empty signature")
  end
  return result
end

local function settle_exact_payment(payment_header)
  local payment = decode_payment_signature(payment_header)
  if payment.x402Version ~= 2 then
    error("unsupported x402Version")
  end
  if not accepted_requirement_matches(payment.accepted) then
    error("accepted payment requirement does not match server challenge")
  end
  if type(payment.payload) ~= "table" or type(payment.payload.transaction) ~= "string" or payment.payload.transaction == "" then
    error("payment payload is missing transaction")
  end

  local transaction, transaction_decode_error = base64_decode(payment.payload.transaction)
  if not transaction then
    error("payment transaction decode failed: " .. transaction_decode_error)
  end
  local parsed = parse_versioned_transaction(transaction)
  local transfer = verify_exact_transaction(parsed, payment.accepted)
  local cache_key = transaction_cache_key(transaction)
  if not claim_settlement(cache_key) then
    error("duplicate_settlement")
  end

  local settled = false
  local function settle()
    verify_token_accounts_exist(parsed, payment.accepted, transfer)
    local keypair = keypair_from_json_secret(required_env("X402_INTEROP_FACILITATOR_SECRET_KEY"))
    local signed_transaction = sign_transaction_with_fee_payer(transaction, parsed, keypair)
    local signed_parsed = parse_versioned_transaction(signed_transaction)
    verify_transaction_signatures(signed_transaction, signed_parsed)
    local settlement = send_transaction(signed_transaction)
    settled = true
    return settlement
  end

  local ok, result = pcall(settle)
  if not ok then
    if not settled then
      release_settlement(cache_key)
    end
    error(result)
  end
  return result
end

local function payment_required_response()
  return 402, "Payment Required", "PAYMENT-REQUIRED: " .. exact_payment_required_header() .. "\r\n", json_object({ { "error", "payment_required" } })
end

local function payment_error_response(message)
  return 402, "Payment Required", "PAYMENT-REQUIRED: " .. exact_payment_required_header() .. "\r\n", json_object({ { "error", "payment_invalid" }, { "message", message } })
end

local function response_for(path, headers)
  if path == "/health" then
    return 200, "OK", "", json_object({ { "ok", true } })
  elseif path == "/capabilities" then
    return 200, "OK", "", json_object(capability_payload)
  elseif path == "/exact" then
    return 402, "Payment Required", "PAYMENT-REQUIRED: " .. exact_payment_required_header() .. "\r\n", json_object({ { "error", "payment_required" } })
  elseif path == default_resource_path or path == "/protected" then
    local payment_signature = header_value(headers, "PAYMENT-SIGNATURE")
    if not payment_signature or payment_signature == "" then
      return payment_required_response()
    end

    local ok, settlement_or_error = pcall(settle_exact_payment, payment_signature)
    if not ok then
      return payment_error_response(settlement_or_error)
    end

    return 200, "OK", "x-fixture-settlement: " .. settlement_or_error .. "\r\n", json_object({
      { "ok", true },
      { "paid", true },
      { "settlement", settlement_or_error }
    })
  else
    return 404, "Not Found", "", json_object({ { "error", "not_found" } })
  end
end

print(json_object({
  { "type", "ready" },
  { "implementation", "lua" },
  { "role", "server" },
  { "port", port },
  { "capabilities", { "exact" } }
}))
io.stdout:flush()

while true do
  local client = server:accept()
  if client then
    local request_line = client:receive("*l") or ""
    local path = request_line:match("^%u+%s+([^%s]+)%s+HTTP/%d%.%d$") or "/"
    local headers = read_headers(client)
    local status, reason, extra_headers, body = response_for(path, headers)

    client:send(
      "HTTP/1.1 " .. status .. " " .. reason .. "\r\n" ..
      "content-type: application/json\r\n" ..
      extra_headers ..
      "content-length: " .. #body .. "\r\n" ..
      "connection: close\r\n\r\n" ..
      body
    )
    client:close()
  end
end
