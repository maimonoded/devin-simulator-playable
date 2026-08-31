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


# ---------------------------------------------------------------------------------------
# THREE CACHE POLICIES, because the three kinds of file here have nothing in common.
#
# The numbers that decided this, measured on one page load:
#
#     .glb models   45 requests   43.1 MB     <- the whole problem
#     code + markup 84 requests    2.0 MB
#     .webp art      ~5 MB across the album and the box popups
#     three.js                     1.3 MB
#
# `no-cache` was on all of it, which sounds cached and is not: it forces a REVALIDATION on
# every single load. On localhost that is free. Over Tailscale to a phone it is 170 round
# trips, and worse -- 45 MB overflows the browser's cache, so most of it is evicted before
# the next load and comes back in full. Only the last eight GLBs survived, which is what a
# cache thrashing looks like.
#
# So: art and vendored libraries get a REAL max-age and are not asked about again. Code keeps
# no-store, because it is edited constantly and a stale bundle is a debugging afternoon.
IMMUTABLE = re.compile(r"^/vendor/")                       # version-pinned, never edited
ART = re.compile(r"^/(assets|episodes)/.*\.(webp|png|jpg|jpeg|glb|gltf|bin|mp4|woff2?)$", re.I)

ART_MAX_AGE = 7 * 24 * 3600        # a week
VENDOR_MAX_AGE = 365 * 24 * 3600   # a year; three.js is pinned at r169 in the repo

# THE ESCAPE HATCH. Art changes by a file being REPLACED, not edited -- and a cached file will
# not notice. While iterating on art, run:  FRESH=1 python3 serve.py
# and everything falls back to revalidate-always, which is what this server did before.
FRESH = os.environ.get("FRESH", "").strip() not in ("", "0", "false", "no")


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1, for KEEP-ALIVE. Python defaults to 1.0, which closes the socket after every
    # response -- and a page load here is ~170 requests, so that is 170 TCP handshakes. On
    # localhost the cost is invisible; over Tailscale to a phone it is the whole page load.
    #
    # Safe because every response this handler produces carries an accurate Content-Length:
    # the base class sets it for files and errors, and the 206 branch below sets its own. A
    # keep-alive response WITHOUT one would hang the connection until it timed out, which is
    # the trap this setting is usually blamed for.
    protocol_version = "HTTP/1.1"
    # An idle keep-alive socket holds a thread in ThreadingHTTPServer. The threads are daemons
    # so they never block shutdown, but without a timeout a walked-away-from tab pins one
    # indefinitely.
    timeout = 30

    def end_headers(self):
        self.send_header("Cache-Control", self._cache_control())
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def _cache_control(self):
        path = self.path.split("?")[0]
        if FRESH:
            # Everything revalidates. Slower, but a replaced file is visible on the next load.
            return "no-cache" if (IMMUTABLE.match(path) or ART.match(path)) else "no-store, must-revalidate"
        if IMMUTABLE.match(path):
            return f"public, max-age={VENDOR_MAX_AGE}, immutable"
        if ART.match(path):
            return f"public, max-age={ART_MAX_AGE}"
        # Code and markup: edited constantly, and a stale one is never worth the bytes it saves.
        return "no-store, must-revalidate"

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
