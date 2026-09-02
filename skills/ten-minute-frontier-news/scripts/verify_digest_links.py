#!/usr/bin/env python3
"""Verify every nested sources[].url in a Ten-Minute Frontier digest."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
)
WARN_CODES = {401, 403, 429}


def check(source: dict) -> dict:
    url = source["url"]
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    try:
        with urlopen(request, timeout=15) as response:
            code = response.getcode()
            return {"url": url, "name": source.get("name", ""), "status": code, "ok": 200 <= code < 400}
    except HTTPError as exc:
        return {
            "url": url,
            "name": source.get("name", ""),
            "status": exc.code,
            "ok": exc.code in WARN_CODES,
            "warning": exc.code in WARN_CODES,
        }
    except (URLError, TimeoutError, OSError) as exc:
        return {"url": url, "name": source.get("name", ""), "status": None, "ok": False, "error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("digest")
    args = parser.parse_args()
    path = Path(args.digest)
    digest = json.loads(path.read_text(encoding="utf-8"))
    sources = []
    seen = set()
    for item in digest.get("items", []):
        for source in item.get("sources", []):
            if source.get("url") and source["url"] not in seen:
                seen.add(source["url"])
                sources.append(source)

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(check, sources))

    failures = [result for result in results if not result["ok"]]
    warnings = [result for result in results if result.get("warning")]
    report = {
        "digest": str(path),
        "checked": len(results),
        "passed": len(results) - len(failures),
        "warnings": warnings,
        "failures": failures,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
