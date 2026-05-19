# frozen_string_literal: true

require "base64"
require "json"

module X402SDK
  module Interop
    module Client
      module_function

      def select_svm_requirement(headers:, body:, network:)
        accepts = []
        accepts.concat(accepts_from_envelope(load_payment_required_header(headers)))
        accepts.concat(accepts_from_envelope(load_payment_required_body(body)))

        accepts.find do |requirement|
          requirement["scheme"] == "exact" &&
            requirement["network"] == network &&
            requirement["asset"].is_a?(String) &&
            requirement["amount"].is_a?(String)
        end
      end

      def load_payment_required_header(headers)
        encoded = header_value(headers, "PAYMENT-REQUIRED")
        return nil if encoded.nil? || encoded.empty?

        JSON.parse(Base64.decode64(encoded))
      rescue ArgumentError, JSON::ParserError
        nil
      end

      def load_payment_required_body(body)
        return nil if body.nil? || body.empty?

        JSON.parse(body)
      rescue JSON::ParserError
        nil
      end

      def accepts_from_envelope(envelope)
        return [] unless envelope.is_a?(Hash)

        accepts = envelope["accepts"]
        return [] unless accepts.is_a?(Array)

        accepts.select { |entry| entry.is_a?(Hash) }
      end

      def header_value(headers, name)
        match = headers.find { |key, _value| key.casecmp(name).zero? }
        match&.last
      end
    end
  end
end
