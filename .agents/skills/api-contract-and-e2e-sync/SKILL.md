---
name: api-contract-and-e2e-sync
description: >-
  Ensures database schema, Tornado REST endpoints, frontend fetch/state hydration, and automated
  pytest suites stay synchronized across BuildersFrame and Antigravity Studio.
---

# API Contract & E2E Sync

1. **Trace Schema -> Handler -> UI**
   - When adding or modifying a field, verify:
     1. SQLite table definition & non-destructive `init_db()` migration/seed sync.
     2. Tornado handler payload validation, status codes (`200`, `400`, `401`, `404`, `409`), and JSON serialization.
     3. Frontend `app.js` `fetch()` error handling, optimistic/disabled button state, and DOM re-render + cache-buster bump in `index.html`.

2. **Isolated Automated Tests (`pytest`)**
   - Write every test against a `tempfile.TemporaryDirectory()` SQLite path—never against live `buildersframe.db` or `antigravity_studio.db`.
   - Test Tornado routes via the in-memory dispatcher in `tests/test_api_tornado.py` so suites run fast and offline without opening sockets.
   - Run both suites cleanly with zero warnings:
     - `python3 -m pytest -v`
     - `cd antigravity-studio && python3 -m pytest -v`
