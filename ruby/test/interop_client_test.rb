# frozen_string_literal: true

require "base64"
require "json"
require "minitest/autorun"
require "x402_sdk/interop/client"

class InteropClientTest < Minitest::Test
  NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
  ASSET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

  def test_selects_requirement_from_payment_required_header
    requirement = {
      "scheme" => "exact",
      "network" => NETWORK,
      "asset" => ASSET,
      "amount" => "1000"
    }
    encoded = Base64.strict_encode64(JSON.generate("x402Version" => 2, "accepts" => [requirement]))

    selected = X402SDK::Interop::Client.select_svm_requirement(
      headers: { "PAYMENT-REQUIRED" => encoded },
      body: "",
      network: NETWORK
    )

    assert_equal requirement, selected
  end

  def test_selects_requirement_from_json_body
    evm = {
      "scheme" => "exact",
      "network" => "eip155:8453",
      "asset" => "0x0000000000000000000000000000000000000000",
      "amount" => "1000"
    }
    solana = {
      "scheme" => "exact",
      "network" => NETWORK,
      "asset" => ASSET,
      "amount" => "1000"
    }

    selected = X402SDK::Interop::Client.select_svm_requirement(
      headers: {},
      body: JSON.generate("accepts" => [evm, solana]),
      network: NETWORK
    )

    assert_equal solana, selected
  end

  def test_ignores_unsupported_scheme
    selected = X402SDK::Interop::Client.select_svm_requirement(
      headers: {},
      body: JSON.generate(
        "accepts" => [
          {
            "scheme" => "upto",
            "network" => NETWORK,
            "asset" => ASSET,
            "amount" => "1000"
          }
        ]
      ),
      network: NETWORK
    )

    assert_nil selected
  end
end
