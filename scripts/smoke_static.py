#!/usr/bin/env python3
"""Serves the exported `out/` directory and checks every route plus its assets.

This is a real HTTP check of the production build: correct status codes, the
document shell, resolvable JS/CSS assets, and the 404 page.
"""
import http.server
import pathlib
import re
import socketserver
import sys
import threading
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1] / "out"
ROUTES = ["/", "/dashboard/", "/locations/", "/reviews/", "/bulk/", "/reports/", "/audit/", "/team/", "/settings/", "/activity/", "/login/", "/onboarding/"]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass


def main() -> int:
    if not ROOT.exists():
        print("out/ missing — run `pnpm build` first")
        return 1

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{port}"

        failures = []
        checked = 0

        for route in ROUTES:
            url = base + route
            try:
                with urllib.request.urlopen(url, timeout=10) as response:
                    body = response.read().decode("utf-8", "ignore")
                    checked += 1
                    if response.status != 200:
                        failures.append(f"{route} -> HTTP {response.status}")
                        continue
                    if "<title>" not in body or "Kendra" not in body:
                        failures.append(f"{route} -> shell missing title/brand")
                    assets = re.findall(r'(?:src|href)="(/_next/[^"]+)"', body)
                    if not assets:
                        failures.append(f"{route} -> no _next assets referenced")
                    for asset in assets[:6]:
                        try:
                            with urllib.request.urlopen(base + asset, timeout=10) as asset_response:
                                if asset_response.status != 200:
                                    failures.append(f"{route} asset {asset} -> {asset_response.status}")
                        except Exception as exc:  # noqa: BLE001
                            failures.append(f"{route} asset {asset} -> {exc}")
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{route} -> {exc}")

        # the export must ship a 404 document
        if not (ROOT / "404.html").exists():
            failures.append("404.html missing from the export")

        httpd.shutdown()

    for failure in failures:
        print(f"  FAIL {failure}")
    print(f"\n{checked}/{len(ROUTES)} routes served, {len(failures)} problem(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
