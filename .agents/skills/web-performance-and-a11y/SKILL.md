---
name: web-performance-and-a11y
description: >-
  Audits and improves accessibility (WCAG semantics, keyboard navigation, modal focus return,
  contrast) and Core Web Vitals (LCP, CLS, asset delivery) for static/SPA web pages.
---

# Web Performance & Accessibility Checklist

1. **Accessibility & Keyboard UX**
   - Keep heading levels sequential (`h1` -> `h2` -> `h3` without skipped levels).
   - Every modal (`role="dialog" aria-modal="true"`) must trap or move focus inside on open, close on `Escape`, and restore focus to the triggering element on close.
   - Ensure form inputs have `<label>` or `aria-label`, icon-only buttons have `aria-label`, and custom clickable cards have `role="button"`, `tabindex="0"`, and `Enter`/`Space` key handlers.

2. **LCP, CLS & Runtime Efficiency**
   - Preconnect external font origins cleanly (`preconnect` + `display=swap`), avoid layout-shifting banners above the hero fold, and give canvases/widgets explicit dimensions or min-heights.
   - Debounce search input filters, batch DOM updates via single `innerHTML` joins, and clean up timers/listeners.
