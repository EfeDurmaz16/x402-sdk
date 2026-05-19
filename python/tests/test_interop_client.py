from __future__ import annotations

import base64
import json
import unittest

from x402_sdk.interop.client import select_svm_requirement


class SelectSvmRequirementTests(unittest.TestCase):
    def test_selects_requirement_from_payment_required_header(self) -> None:
        requirement = {
            "scheme": "exact",
            "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            "amount": "1000",
        }
        envelope = {"x402Version": 2, "accepts": [requirement]}
        encoded = base64.b64encode(json.dumps(envelope).encode("utf-8")).decode("ascii")

        self.assertEqual(
            select_svm_requirement(
                headers={"PAYMENT-REQUIRED": encoded},
                body="",
                network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            ),
            requirement,
        )

    def test_selects_matching_requirement_from_json_body(self) -> None:
        usdc = {
            "scheme": "exact",
            "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            "amount": "1000",
        }
        evm = {
            "scheme": "exact",
            "network": "eip155:8453",
            "asset": "0x0000000000000000000000000000000000000000",
            "amount": "1000",
        }

        self.assertEqual(
            select_svm_requirement(
                headers={},
                body=json.dumps({"accepts": [evm, usdc]}),
                network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            ),
            usdc,
        )

    def test_returns_none_when_no_solana_exact_requirement_matches(self) -> None:
        body = json.dumps(
            {
                "accepts": [
                    {
                        "scheme": "upto",
                        "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                        "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                        "amount": "1000",
                    }
                ]
            }
        )

        self.assertIsNone(
            select_svm_requirement(
                headers={},
                body=body,
                network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            )
        )

    def test_selects_upto_requirement_when_scheme_is_requested(self) -> None:
        requirement = {
            "scheme": "upto",
            "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            "amount": "1000",
        }

        self.assertEqual(
            select_svm_requirement(
                headers={},
                body=json.dumps({"accepts": [requirement]}),
                network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                scheme="upto",
            ),
            requirement,
        )


if __name__ == "__main__":
    unittest.main()
