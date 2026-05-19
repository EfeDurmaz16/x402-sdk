from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


def _header_value(headers: dict[str, str], name: str) -> str | None:
    for key, value in headers.items():
        if key.lower() == name.lower():
            return value
    return None


def _load_payment_required_header(headers: dict[str, str]) -> dict[str, Any] | None:
    encoded = _header_value(headers, "PAYMENT-REQUIRED")
    if not encoded:
        return None

    try:
        raw = base64.b64decode(encoded).decode("utf-8")
        loaded = json.loads(raw)
    except (ValueError, json.JSONDecodeError):
        return None

    return loaded if isinstance(loaded, dict) else None


def _load_payment_required_body(body: str) -> dict[str, Any] | None:
    if not body:
        return None

    try:
        loaded = json.loads(body)
    except json.JSONDecodeError:
        return None

    return loaded if isinstance(loaded, dict) else None


def _accepts_from_envelope(envelope: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not envelope:
        return []

    accepts = envelope.get("accepts")
    if not isinstance(accepts, list):
        return []

    return [entry for entry in accepts if isinstance(entry, dict)]


def select_svm_requirement(
    *,
    headers: dict[str, str],
    body: str,
    network: str,
    scheme: str = "exact",
) -> dict[str, Any] | None:
    accepts = [
        *_accepts_from_envelope(_load_payment_required_header(headers)),
        *_accepts_from_envelope(_load_payment_required_body(body)),
    ]

    for requirement in accepts:
        if requirement.get("scheme") != scheme:
            continue
        if requirement.get("network") != network:
            continue
        if not isinstance(requirement.get("asset"), str):
            continue
        if not isinstance(requirement.get("amount"), str):
            continue
        return requirement

    return None


def _emit(payload: dict[str, object]) -> None:
    print(json.dumps(payload), flush=True)


def main() -> int:
    target_url = os.environ.get("X402_INTEROP_TARGET_URL")
    if not target_url:
        raise RuntimeError("X402_INTEROP_TARGET_URL is required")

    status = 0
    headers: dict[str, str] = {}
    body: object = None

    try:
        with urllib.request.urlopen(target_url, timeout=10) as response:
            status = response.status
            headers = dict(response.headers.items())
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        status = error.code
        headers = dict(error.headers.items())
        body = error.read().decode("utf-8")

    selected_requirement = select_svm_requirement(
        headers=headers,
        body=str(body),
        network=os.environ.get(
            "X402_INTEROP_NETWORK",
            "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        ),
        scheme=os.environ.get("X402_INTEROP_SCHEME", "exact"),
    )
    intent = os.environ.get("X402_INTEROP_INTENT")
    scheme = os.environ.get("X402_INTEROP_SCHEME", "exact")
    error_domain = intent or scheme

    _emit(
        {
            "type": "result",
            "implementation": "python",
            "role": "client",
            "ok": False,
            "status": status,
            "responseHeaders": headers,
            "responseBody": {
                "error": f"python_{error_domain}_client_not_implemented",
                "challengeStatus": status,
                "challengeBody": body,
                "selectedRequirement": selected_requirement,
            },
            "settlement": None,
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
