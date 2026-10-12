#!/usr/bin/env python3
"""Render the venue-kit templates for one client.

Usage:  python scripts/build_client.py clients/<name>/client.json [--out dist/<name>]

Every {{TOKEN}} in templates/ and sql/ is replaced with the matching value from
client.json ("tokens" object). The build stops if a token is missing or unused
values are left, so a half-configured site can never ship.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKEN = re.compile(r"\{\{([A-Z_]+)\}\}")

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cfg_path = pathlib.Path(sys.argv[1])
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    tokens = cfg["tokens"]
    out = pathlib.Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv \
        else ROOT / "dist" / cfg_path.parent.name
    sources = sorted((ROOT / "templates").glob("*")) + sorted((ROOT / "sql").glob("*.sql"))
    missing, used = set(), set()
    rendered = {}
    for src in sources:
        text = src.read_text(encoding="utf-8")
        def sub(m):
            key = m.group(1); used.add(key)
            if key not in tokens:
                missing.add(key); return m.group(0)
            return str(tokens[key])
        rendered[src] = TOKEN.sub(sub, text)
    if missing:
        sys.exit("Missing tokens in %s: %s" % (cfg_path, ", ".join(sorted(missing))))
    unused = set(tokens) - used
    if unused:
        print("Note: unused tokens:", ", ".join(sorted(unused)))
    for src, text in rendered.items():
        dest = out / ("sql" if src.suffix == ".sql" else "site") / src.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding="utf-8")
    print("Built %d files for '%s' -> %s" % (len(rendered), cfg.get("name", cfg_path.parent.name), out))

if __name__ == "__main__":
    main()
