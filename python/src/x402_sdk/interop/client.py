from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


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

    _emit(
        {
            "type": "result",
            "implementation": "python",
            "role": "client",
            "ok": False,
            "status": status,
            "responseHeaders": headers,
            "responseBody": {
                "error": "python_exact_client_not_implemented",
                "challengeStatus": status,
                "challengeBody": body,
            },
            "settlement": None,
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
