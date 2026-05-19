from __future__ import annotations

import json
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class InteropHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._write_json(200, {"ok": True})
            return

        self._write_json(
            501,
            {
                "ok": False,
                "paid": False,
                "error": "python_exact_server_not_implemented",
            },
        )

    def log_message(self, format: str, *args: object) -> None:
        print(format % args, file=sys.stderr)

    def _write_json(self, status: int, body: dict[str, object]) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> int:
    server = ThreadingHTTPServer(("127.0.0.1", 0), InteropHandler)

    def shutdown(_signum: int, _frame: object) -> None:
        server.shutdown()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    print(
        json.dumps(
            {
                "type": "ready",
                "implementation": "python",
                "role": "server",
                "port": server.server_port,
                "capabilities": ["exact"],
            }
        ),
        flush=True,
    )
    server.serve_forever()
    server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
