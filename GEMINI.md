# BuildersFrame & Antigravity Studio Workspace Rules

These engineering rules apply across the entire `Builders_Frame` repository (both the main BuildersFrame app and `antigravity-studio/`).

## 1. Architecture & Data Integrity
- Keep the existing stack intact: **Vanilla HTML/CSS/JS** frontend + **Python Tornado** backend + **SQLite** persistence (`buildersframe.db` and `antigravity-studio/antigravity_studio.db`). Never introduce React/Next.js/Vite rewrites unless explicitly requested.
- Never reset, truncate, or drop production SQLite databases (`buildersframe.db`, `antigravity_studio.db`). Automated tests must use isolated `tempfile.TemporaryDirectory()` databases via `tests/conftest.py`.
- Maintain strict product honesty: label deterministic matching as weighted heuristic scoring, keep `ProblemResearchAgent` labeled as template-guided (unless a live LLM key/integration is active), and never insert placeholder `example.com` or `github.com/example` URLs in seed or ingested data.

## 2. Frontend Craft, Responsiveness & Accessibility
- **Zero Horizontal Overflow**: All CSS Grid tracks must use `minmax(0, 1fr)` (or `min-width: 0`) where children could overflow. Verify both `1280×800` desktop and `390×844` mobile layouts.
- **Accessible Interactive Controls**: Every button, card (`role="button"`), and modal control must support `Enter`/`Space` keyboard activation, `Escape` dismissal, visible `:focus-visible` outlines, and WCAG AA contrast (`>= 4.5:1` normal text, `>= 3:1` large text/UI).
- **Motion Discipline**: Animate only GPU-friendly properties (`transform`, `opacity`), pause offscreen or hidden-tab `<canvas>` loops, and disable ambient animations cleanly under `@media (prefers-reduced-motion: reduce)`.
- **Cache Hygiene**: Keep `Cache-Control: no-store` on local dev static assets or bump `?v=...` cache-busters in HTML whenever CSS/JS changes.

## 3. Security & Backend Standards
- **XSS Prevention**: Always sanitize dynamic user/API strings with `escapeHtml()` before assembling `innerHTML`, and validate external links (`http://` or `https://` only) with `rel="noopener noreferrer"`.
- **SQL & Subprocess Safety**: Use parameterized SQLite queries (`?` placeholders) exclusively. Never pass raw user strings to `subprocess.run(..., shell=True)`; use `shlex.split` (`shell=False`) and `os.path.realpath` workspace boundary checks (`resolve_safe_path`).
- **Auth & Datetime**: Hash passwords with salted `PBKDF2-HMAC-SHA256`, store opaque tokens in `HttpOnly; SameSite=Lax` cookies, and use timezone-aware UTC datetimes (`datetime.now(timezone.utc)`) with zero Python deprecation warnings.

## 4. Verification Before Done
- Run `python3 -m pytest -v` (root) and `cd antigravity-studio && python3 -m pytest -v` after code edits.
- For UI changes, verify the running local web pages (`http://localhost:8000` and/or `http://localhost:8100`) for `0` console errors, `0` HTTP `4xx/5xx` errors, and `0` horizontal overflow on desktop and mobile.
