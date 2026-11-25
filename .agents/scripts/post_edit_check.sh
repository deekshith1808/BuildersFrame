#!/usr/bin/env bash
set -u

# Read PostToolUse JSON payload from stdin safely and run lightweight syntax verification
python3 -c '
import json, subprocess, sys, os

try:
    payload = json.load(sys.stdin)
except Exception:
    print("{}")
    sys.exit(0)

args = (payload.get("toolCall") or {}).get("args") or {}
path = args.get("Path") or ""
if path and os.path.isfile(path):
    if path.endswith(".py"):
        subprocess.run([sys.executable, "-m", "py_compile", path], stdout=subprocess.DEVNULL, stderr=sys.stderr, check=False)
    elif path.endswith(".json"):
        subprocess.run([sys.executable, "-m", "json.tool", path], stdout=subprocess.DEVNULL, stderr=sys.stderr, check=False)

print("{}")
'
