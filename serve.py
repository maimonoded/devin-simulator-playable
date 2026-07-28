#!/usr/bin/env python3
"""Dev server for Harbour Heights.

    python3 serve.py            → http://localhost:8125
    python3 serve.py 9000       → a different port

Two things a plain `python3 -m http.server` gets wrong for this project:

  * **HTTP Range** — episode videos are 30-60 MB and the player seeks. Without
    206 responses a seek restarts the file from zero.
  * **no-store** — the board and CSS change constantly while developing, and the
    browser caches aggressively enough to serve stale files after an edit.

A server is required at all since the board loads three.js as an ES module, and
browsers block module scripts on file:// URLs.
"""
import functools
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8125


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def do_GET(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().do_GET()

        m = re.match(r"bytes=(\d+)-(\d*)", rng)
        if not m:
            return super().do_GET()

        size = os.path.getsize(path)
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return

        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()

        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    def log_message(self, fmt, *args):          # quieter console
        if "304" not in fmt % args:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"Harbour Heights → http://localhost:{PORT}/index.html   (ctrl-c to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
