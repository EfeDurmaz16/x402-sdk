# frozen_string_literal: true

require "base64"
require "json"
require_relative "test_helper"
require "x402_sdk/interop/exact"
require "x402_sdk/interop/server"

class InteropServerTest < Minitest::Test
  NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
  ASSET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  EXTRA_ASSET = "ExtraMint11111111111111111111111111111"
  PYUSD_DEVNET_MINT = "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"
  PAY_TO = "11111111111111111111111111111112"
  BLOCKHASH = "11111111111111111111111111111111"

  def test_normalizes_price_to_six_decimals
    assert_equal "1000", X402SDK::Interop::Server.normalize_amount("$0.001")
    assert_equal "1000", X402SDK::Interop::Server.normalize_amount("0.001 USDC")
    assert_equal "1250000", X402SDK::Interop::Server.normalize_amount("1.25")
  end

  def test_exact_challenge_uses_runtime_state
    state = build_state(price: "$0.125")
    requirement = X402SDK::Interop::Server.exact_requirement(state)

    assert_equal "exact", requirement.fetch("scheme")
    assert_equal NETWORK, requirement.fetch("network")
    assert_equal ASSET, requirement.fetch("asset")
    assert_equal "125000", requirement.fetch("amount")
    assert_equal PAY_TO, requirement.fetch("payTo")
    assert_equal X402SDK::Interop::Exact.base58_encode(state.fee_payer.raw_public_key),
                 requirement.fetch("extra").fetch("feePayer")
  end

  def test_exact_challenge_includes_extra_offered_mints
    state = build_state(extra_offered_mints: " #{PYUSD_DEVNET_MINT}, #{EXTRA_ASSET} ")
    accepts = X402SDK::Interop::Server.exact_challenge(state).fetch("accepts")
    base, pyusd, extra = accepts

    assert_equal [ASSET, PYUSD_DEVNET_MINT, EXTRA_ASSET], accepts.map { |requirement| requirement.fetch("asset") }
    assert_equal 3, accepts.length

    [pyusd, extra].each do |requirement|
      assert_equal base.fetch("amount"), requirement.fetch("amount")
      assert_equal base.fetch("payTo"), requirement.fetch("payTo")
      assert_equal base.fetch("extra").fetch("feePayer"), requirement.fetch("extra").fetch("feePayer")
      assert_equal base.fetch("extra").fetch("decimals"), requirement.fetch("extra").fetch("decimals")
    end

    assert_equal X402SDK::Interop::Exact::TOKEN_2022_PROGRAM, pyusd.fetch("extra").fetch("tokenProgram")
    assert_equal X402SDK::Interop::Server::DEFAULT_TOKEN_PROGRAM, extra.fetch("extra").fetch("tokenProgram")
  end

  def test_payment_requirement_matches_binds_settlement_fields
    state = build_state
    requirement = X402SDK::Interop::Server.exact_requirement(state)

    assert X402SDK::Interop::Server.payment_requirement_matches?(requirement, requirement)

    mutated = Marshal.load(Marshal.dump(requirement))
    mutated.fetch("extra")["feePayer"] = "11111111111111111111111111111114"

    refute X402SDK::Interop::Server.payment_requirement_matches?(mutated, requirement)
  end

  def test_settlement_signs_fee_payer_before_sending
    sent = []
    state = build_state(sender: ->(_state, transaction) {
      sent << transaction
      "ruby-settlement-signature"
    })
    payment_header = build_payment_header(state)

    settlement = X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    signed_transaction = sent.fetch(0)

    assert_equal "ruby-settlement-signature", settlement
    refute_equal "\x00".b * 64, signed_transaction.byteslice(1, 64)
    refute_equal "\x00".b * 64, signed_transaction.byteslice(65, 64)
  end

  def test_settlement_rejects_accepted_requirement_drift
    state = build_state
    envelope = JSON.parse(Base64.decode64(build_payment_header(state)))
    envelope.fetch("accepted").fetch("extra")["feePayer"] = "11111111111111111111111111111114"
    payment_header = Base64.strict_encode64(JSON.generate(envelope))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "accepted payment requirement does not match server challenge", error.message
  end

  def test_settlement_rejects_accepted_extra_drift
    state = build_state
    envelope = JSON.parse(Base64.decode64(build_payment_header(state)))
    envelope.fetch("accepted").fetch("extra")["unexpected"] = "drift"
    payment_header = Base64.strict_encode64(JSON.generate(envelope))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "accepted payment requirement does not match server challenge", error.message
  end

  def test_settlement_rejects_accepted_max_timeout_drift
    state = build_state
    envelope = JSON.parse(Base64.decode64(build_payment_header(state)))
    envelope["accepted"]["maxTimeoutSeconds"] = 30
    payment_header = Base64.strict_encode64(JSON.generate(envelope))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "accepted payment requirement does not match server challenge", error.message
  end

  def test_settlement_rejects_malformed_payment_signature_encoding
    state = build_state

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, "not base64")
    end

    assert_equal "invalid payment signature encoding", error.message
  end

  def test_settlement_rejects_malformed_payment_signature_json
    state = build_state
    payment_header = Base64.strict_encode64("not-json")

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "invalid payment signature JSON", error.message
  end

  def test_settlement_rejects_non_object_payment_signature_json
    state = build_state
    payment_header = Base64.strict_encode64(JSON.generate(["not", "object"]))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "payment signature must be a JSON object", error.message
  end

  def test_settlement_rejects_non_object_payload
    state = build_state
    envelope = {
      "x402Version" => 2,
      "accepted" => X402SDK::Interop::Server.exact_requirement(state),
      "payload" => "not-object"
    }
    payment_header = Base64.strict_encode64(JSON.generate(envelope))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "payment payload is missing transaction", error.message
  end

  def test_settlement_rejects_missing_transaction_payload
    state = build_state
    envelope = {
      "x402Version" => 2,
      "accepted" => X402SDK::Interop::Server.exact_requirement(state),
      "payload" => {}
    }
    payment_header = Base64.strict_encode64(JSON.generate(envelope))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "payment payload is missing transaction", error.message
  end

  def test_settlement_rejects_invalid_transaction_payload_base64
    state = build_state
    envelope = JSON.parse(Base64.decode64(build_payment_header(state)))
    envelope.fetch("payload")["transaction"] = "not base64"
    payment_header = Base64.strict_encode64(JSON.generate(envelope))

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "payment payload transaction is not valid base64", error.message
  end

  def test_settlement_rejects_transaction_amount_mismatch_before_sending
    sent = []
    state = build_state(sender: ->(_state, transaction) {
      sent << transaction
      "unit-settlement"
    })
    payment_header = mutate_payment_transaction(build_payment_header(state)) do |transaction|
      replace_transfer_amount(transaction, 999)
    end

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "invalid_exact_svm_payload_amount_mismatch", error.message
    assert_empty sent
  end

  def test_settlement_rejects_fee_payer_as_transfer_authority_before_sending
    sent = []
    state = build_state(sender: ->(_state, transaction) {
      sent << transaction
      "unit-settlement"
    })
    payment_header = mutate_payment_transaction(build_payment_header(state)) do |transaction|
      make_fee_payer_transfer_authority(transaction)
    end

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds", error.message
    assert_empty sent
  end

  def test_settlement_rejects_fee_payer_as_transfer_source_before_sending
    sent = []
    state = build_state(sender: ->(_state, transaction) {
      sent << transaction
      "unit-settlement"
    })
    payment_header = mutate_payment_transaction(build_payment_header(state)) do |transaction|
      make_fee_payer_transfer_source(transaction)
    end

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds", error.message
    assert_empty sent
  end

  def test_settlement_rejects_fee_payer_in_any_instruction_account_before_sending
    sent = []
    state = build_state(sender: ->(_state, transaction) {
      sent << transaction
      "unit-settlement"
    })
    payment_header = mutate_payment_transaction(build_payment_header(state)) do |transaction|
      add_fee_payer_to_memo_accounts(transaction)
    end

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "invalid_exact_svm_payload_transaction_fee_payer_in_instruction_accounts", error.message
    assert_empty sent
  end

  def test_settlement_rejects_lighthouse_as_sixth_instruction
    sent = []
    state = build_state(sender: ->(_state, transaction) {
      sent << transaction
      "unit-settlement"
    })
    payment_header = mutate_payment_transaction(build_payment_header(state)) do |transaction|
      append_optional_instruction(transaction, X402SDK::Interop::Exact::LIGHTHOUSE_PROGRAM)
      append_optional_instruction(transaction, X402SDK::Interop::Exact::LIGHTHOUSE_PROGRAM)
    end

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "invalid_exact_svm_payload_unknown_sixth_instruction", error.message
    assert_empty sent
  end

  def test_settlement_rejects_duplicate_transaction_payload_before_resending
    sent = []
    state = build_state(sender: ->(_state, _transaction) {
      sent << true
      "unit-settlement-#{sent.length}"
    })
    payment_header = build_payment_header(state)

    assert_equal "unit-settlement-1", X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    end

    assert_equal "duplicate_settlement", error.message
    assert_equal 1, sent.length
  end

  def test_settlement_cache_releases_transaction_payload_after_send_failure
    state = build_state(sender: ->(_state, _transaction) { raise "send failed" })
    payment_header = build_payment_header(state)

    2.times do
      error = assert_raises(RuntimeError) do
        X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
      end
      assert_equal "send failed", error.message
    end
  end

  def test_settlement_rejects_missing_source_token_account_before_sending
    sent = []
    checked = []
    state = build_state(
      sender: ->(_state, _transaction) {
        sent << true
        "unit-settlement"
      },
      account_checker: ->(_state, account) {
        checked << account
        false
      }
    )

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, build_payment_header(state))
    end

    assert_equal "source token account does not exist", error.message
    assert_equal 1, checked.length
    assert_empty sent
  end

  def test_settlement_rejects_missing_destination_token_account_before_sending
    sent = []
    checked = []
    state = build_state(
      sender: ->(_state, _transaction) {
        sent << true
        "unit-settlement"
      },
      account_checker: ->(_state, account) {
        checked << account
        checked.length == 1
      }
    )

    error = assert_raises(RuntimeError) do
      X402SDK::Interop::Server.settle_exact_payment(state, build_payment_header(state))
    end

    assert_equal "destination token account does not exist", error.message
    assert_equal 2, checked.length
    assert_empty sent
  end

  def test_settlement_skips_missing_destination_account_when_create_ata_is_present
    checked = []
    state = build_state(
      account_checker: ->(_state, account) {
        checked << account
        true
      }
    )
    payment_header = mutate_payment_transaction(build_payment_header(state)) do |transaction|
      append_valid_destination_ata_create_instruction(transaction, state)
    end

    assert_equal "unit-settlement", X402SDK::Interop::Server.settle_exact_payment(state, payment_header)
    assert_equal 1, checked.length
  end

  def test_settlement_cache_evicts_entries_after_ttl
    cache = X402SDK::Interop::Server::SettlementCache.new(ttl_seconds: 120)
    now = Time.at(1_000)

    refute cache.duplicate?("tx-a", now: now)
    assert cache.duplicate?("tx-a", now: now + 119)
    refute cache.duplicate?("tx-a", now: now + 121)
  end

  def test_payment_errors_are_normalized
    body = X402SDK::Interop::Server.payment_error_body(RuntimeError.new("sendTransaction RPC error: failed"))

    assert_equal(
      {
        error: "payment_error",
        message: "sendTransaction RPC error: failed",
        invalidReason: "sendTransaction RPC error: failed"
      },
      body
    )
  end

  def test_protected_route_normalizes_invalid_payment_error_body
    state = build_state
    status, headers, body = X402SDK::Interop::Server.response_for(
      "/protected",
      { "PAYMENT-SIGNATURE" => "not base64" },
      state
    )

    assert_equal 402, status
    assert headers.key?("PAYMENT-REQUIRED")
    assert_equal "payment_error", body.fetch(:error)
    assert_equal "invalid payment signature encoding", body.fetch(:message)
    assert_equal "invalid payment signature encoding", body.fetch(:invalidReason)
  end

  def test_send_transaction_normalizes_rpc_error_message
    state = build_state
    response = Object.new
    base_is_a = response.method(:is_a?)
    response.define_singleton_method(:is_a?) { |klass| klass == Net::HTTPSuccess || base_is_a.call(klass) }
    response.define_singleton_method(:code) { "200" }
    response.define_singleton_method(:body) do
      JSON.generate(
        "error" => {
          "code" => -32_002,
          "message" => "Transaction simulation failed"
        }
      )
    end
    fake_http = Object.new
    fake_http.define_singleton_method(:request) { |_request| response }
    start = ->(_hostname, _port, _options, &block) { block.call(fake_http) }

    singleton = class << Net::HTTP; self; end
    original_start = Net::HTTP.method(:start)
    singleton.define_method(:start, start)
    begin
      error = assert_raises(RuntimeError) do
        X402SDK::Interop::Server.send_transaction(state, "signed-transaction")
      end

      assert_equal "sendTransaction RPC error: Transaction simulation failed", error.message
    ensure
      singleton.define_method(:start, original_start)
    end
  end

  def test_send_transaction_returns_rpc_signature
    state = build_state

    with_net_http_response(JSON.generate("result" => "rpc-signature")) do
      assert_equal "rpc-signature", X402SDK::Interop::Server.send_transaction(state, "signed-transaction")
    end
  end

  def test_send_transaction_rejects_empty_rpc_signature
    state = build_state

    with_net_http_response(JSON.generate("result" => "")) do
      error = assert_raises(RuntimeError) do
        X402SDK::Interop::Server.send_transaction(state, "signed-transaction")
      end

      assert_equal "sendTransaction returned empty signature", error.message
    end
  end

  def test_account_exists_returns_true_when_rpc_value_is_present
    state = build_state

    with_net_http_response(JSON.generate("result" => { "value" => { "owner" => "token" } })) do
      assert X402SDK::Interop::Server.account_exists?(state, PAY_TO)
    end
  end

  def test_account_exists_returns_false_when_rpc_value_is_missing
    state = build_state

    with_net_http_response(JSON.generate("result" => { "value" => nil })) do
      refute X402SDK::Interop::Server.account_exists?(state, PAY_TO)
    end
  end

  def test_account_exists_normalizes_non_object_rpc_error
    state = build_state

    with_net_http_response(JSON.generate("error" => "plain rpc failure")) do
      error = assert_raises(RuntimeError) do
        X402SDK::Interop::Server.account_exists?(state, PAY_TO)
      end

      assert_equal "getAccountInfo RPC error: plain rpc failure", error.message
    end
  end

  def test_account_exists_rejects_http_failure
    state = build_state

    with_net_http_response("service unavailable", code: "503", success: false) do
      error = assert_raises(RuntimeError) do
        X402SDK::Interop::Server.account_exists?(state, PAY_TO)
      end

      assert_equal "getAccountInfo HTTP 503", error.message
    end
  end

  def test_static_routes_return_expected_responses
    state = build_state

    status, = X402SDK::Interop::Server.response_for("/health", {}, state)
    assert_equal 200, status

    status, _headers, body = X402SDK::Interop::Server.response_for("/capabilities", {}, state)
    assert_equal 200, status
    assert_equal "ruby", body.fetch(:implementation)

    status, headers, body = X402SDK::Interop::Server.response_for("/exact", {}, state)
    assert_equal 402, status
    assert headers.key?("PAYMENT-REQUIRED")
    assert_equal({ error: "payment_required" }, body)

    status, headers, body = X402SDK::Interop::Server.response_for("/missing", {}, state)
    assert_equal 404, status
    assert_empty headers
    assert_equal({ error: "not_found" }, body)
  end

  def test_protected_route_returns_settlement_success
    state = build_state(sender: ->(_state, _transaction) { "settlement-signature" })
    status, headers, body = X402SDK::Interop::Server.response_for(
      "/protected",
      { "payment-signature" => build_payment_header(state) },
      state
    )

    assert_equal 200, status
    assert_equal "settlement-signature", headers.fetch("x-fixture-settlement")
    assert_equal true, body.fetch(:paid)
    assert_equal "settlement-signature", body.fetch(:settlement).fetch(:transaction)
    assert_equal NETWORK, body.fetch(:settlement).fetch(:network)
  end

  def test_protected_route_returns_payment_required_without_signature
    state = build_state
    status, headers, body = X402SDK::Interop::Server.response_for("/protected", {}, state)

    assert_equal 402, status
    assert_equal({ error: "payment_required" }, body)
    assert JSON.parse(Base64.decode64(headers.fetch("PAYMENT-REQUIRED"))).fetch("accepts").any?
  end

  private

  def build_state(
    price: "$0.001",
    extra_offered_mints: nil,
    sender: ->(_state, _transaction) { "unit-settlement" },
    account_checker: ->(_state, _account) { true }
  )
    env = {
      "X402_INTEROP_RPC_URL" => "http://127.0.0.1:8899",
      "X402_INTEROP_NETWORK" => NETWORK,
      "X402_INTEROP_MINT" => ASSET,
      "X402_INTEROP_PAY_TO" => PAY_TO,
      "X402_INTEROP_FACILITATOR_SECRET_KEY" => JSON.generate(secret(65)),
      "X402_INTEROP_PRICE" => price
    }
    env["X402_INTEROP_EXTRA_OFFERED_MINTS"] = extra_offered_mints unless extra_offered_mints.nil?

    X402SDK::Interop::Server::State.new(
      env: env,
      transaction_sender: sender,
      account_checker: account_checker
    )
  end

  def build_payment_header(state)
    X402SDK::Interop::Exact.build_exact_payment_signature(
      requirement: X402SDK::Interop::Server.exact_requirement(state),
      client_secret_key: JSON.generate(secret(1)),
      recent_blockhash: BLOCKHASH,
      resource: { "type" => "http", "uri" => "/protected" }
    )
  end

  def with_net_http_response(body, code: "200", success: true)
    response = Object.new
    base_is_a = response.method(:is_a?)
    response.define_singleton_method(:is_a?) do |klass|
      (success && klass == Net::HTTPSuccess) || base_is_a.call(klass)
    end
    response.define_singleton_method(:code) { code }
    response.define_singleton_method(:body) { body }
    fake_http = Object.new
    fake_http.define_singleton_method(:request) { |_request| response }

    singleton = class << Net::HTTP; self; end
    original_start = Net::HTTP.method(:start)
    singleton.define_method(:start, ->(_hostname, _port, _options, &block) { block.call(fake_http) })
    yield
  ensure
    singleton.define_method(:start, original_start)
  end

  def mutate_payment_transaction(payment_header)
    envelope = JSON.parse(Base64.decode64(payment_header))
    transaction = Base64.decode64(envelope.fetch("payload").fetch("transaction"))
    envelope.fetch("payload")["transaction"] = Base64.strict_encode64(yield transaction.dup)
    Base64.strict_encode64(JSON.generate(envelope))
  end

  def replace_transfer_amount(transaction, amount)
    offset = transfer_data_offset(transaction)
    transaction[offset, 10] = [12].pack("C") + [amount].pack("Q<") + [6].pack("C")
    transaction
  end

  def make_fee_payer_transfer_authority(transaction)
    offset = transfer_data_offset(transaction)
    transaction.setbyte(offset - 2, 0)
    transaction
  end

  def make_fee_payer_transfer_source(transaction)
    offset = transfer_data_offset(transaction)
    transaction.setbyte(offset - 5, 0)
    transaction
  end

  def add_fee_payer_to_memo_accounts(transaction)
    offset = transaction.bytesize - 1 - 32

    transaction.setbyte(offset - 2, 1)
    transaction.insert(offset - 1, [0].pack("C"))
    transaction
  end

  def append_optional_instruction(transaction, program)
    message_offset = 1 + (2 * 64)
    account_count_offset = message_offset + 4
    account_count = transaction.getbyte(account_count_offset)
    account_keys_offset = account_count_offset + 1
    blockhash_offset = account_keys_offset + (account_count * 32)

    unless transaction.byteslice(account_keys_offset, account_count * 32).include?(X402SDK::Interop::Exact.base58_decode(program))
      transaction.setbyte(account_count_offset, account_count + 1)
      transaction.insert(blockhash_offset, X402SDK::Interop::Exact.base58_decode(program))
      account_count += 1
    end

    instruction_count_offset = account_keys_offset + (account_count * 32) + 32

    transaction.setbyte(instruction_count_offset, transaction.getbyte(instruction_count_offset) + 1)
    transaction.insert(transaction.bytesize - 1, [account_count - 1, 0, 0].pack("C*"))
    transaction
  end

  def append_valid_destination_ata_create_instruction(transaction, state)
    message_offset = 1 + (2 * 64)
    account_count_offset = message_offset + 4
    account_count = transaction.getbyte(account_count_offset)
    account_keys_offset = account_count_offset + 1
    blockhash_offset = account_keys_offset + (account_count * 32)
    extra_keys = [
      X402SDK::Interop::Exact.base58_decode(state.pay_to),
      X402SDK::Interop::Exact.base58_decode(X402SDK::Interop::Exact::SYSTEM_PROGRAM),
      X402SDK::Interop::Exact.base58_decode(X402SDK::Interop::Exact::ASSOCIATED_TOKEN_PROGRAM)
    ]

    transaction.setbyte(account_count_offset, account_count + extra_keys.length)
    transaction.insert(blockhash_offset, extra_keys.join)

    pay_to_index = account_count
    system_index = account_count + 1
    ata_program_index = account_count + 2
    instruction_count_offset = account_keys_offset + ((account_count + extra_keys.length) * 32) + 32
    transaction.setbyte(instruction_count_offset, transaction.getbyte(instruction_count_offset) + 1)
    instruction = [
      ata_program_index,
      6,
      1,
      3,
      pay_to_index,
      6,
      system_index,
      5,
      1,
      1
    ].pack("C*")
    transaction.insert(transaction.bytesize - 1, instruction)
    transaction
  end

  def transfer_data_offset(transaction)
    data = [12].pack("C") + [1000].pack("Q<") + [6].pack("C")
    offset = transaction.index(data)
    raise "transfer instruction fixture not found" if offset.nil?

    offset
  end

  def secret(start)
    values = Array.new(64, 0)
    values[0, 32] = (start...(start + 32)).map { |value| value % 256 }
    values
  end
end
