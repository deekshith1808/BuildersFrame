---
name: web-security-and-auth-audit
description: >-
  Step-by-step web security audit for Python Tornado backends, SQLite persistence, cookies,
  XSS protection, CORS headers, and workspace command sandboxing. Use when adding endpoints,
  modifying authentication, or auditing web app security.
---

# Web Security & Auth Audit

1. **HTTP Security Headers & CORS**
   - Set `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin` on HTML/API responses.
   - Avoid `Access-Control-Allow-Origin: *` alongside credentialed/cookie sessions; reflect explicit allowed local origins or restrict cross-origin writes cleanly.

2. **Authentication & Session Storage**
   - Store passwords with per-user random salt (`PBKDF2-HMAC-SHA256`, `>= 120,000` iterations) and verify with `hmac.compare_digest`.
   - Issue opaque tokens via `secrets.token_urlsafe(32)` in `HttpOnly`, `SameSite=Lax` cookies with timezone-aware UTC expiry (`datetime.now(timezone.utc)`).

3. **XSS & URL Safety in Vanilla JS**
   - Pass all database/user fields through `escapeHtml()` before injecting into `innerHTML`.
   - Validate external links and markdown links (`http://` or `https://` only; block `javascript:` and `data:` URIs).

4. **SQL & Workspace Sandbox Hygiene**
   - Verify all SQLite statements use `?` parameter binding (never f-strings for user values).
   - For file/command tools (`antigravity-studio/backend/tools.py`), enforce `os.path.realpath` prefix checks, parse commands with `shlex.split` (`shell=False`), and enforce explicit allowlists/policies (`strict`, `request-review`, `proceed-in-sandbox`).
