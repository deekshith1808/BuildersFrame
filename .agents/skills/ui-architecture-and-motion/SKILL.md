---
name: ui-architecture-and-motion
description: >-
  Guides professional frontend layout, CSS stacking context isolation, responsive grid behavior,
  and subtle reduced-motion-safe 3D/floating animations for BuildersFrame and Antigravity Studio.
  Use when designing, refactoring, or debugging HTML/CSS/JS UI screens.
---

# UI Architecture & Motion Workflow

1. **Audit Layout Containers First**
   - Check CSS Grid/Flex parents for `min-width: 0` and `minmax(0, 1fr)` so long URLs, code snippets, or pills never cause horizontal scrollbars on `390×844` mobile.
   - Check header action rows at `1280×800` (including signed-in user pills) to verify no right-edge clipping occurs.

2. **Isolate Stacking Contexts (`z-index`)**
   - Whenever adding dropdowns, popovers (`#homeSearchSuggestions`, `#autocompletePopover`), or drawers, trace the nearest `position: relative` ancestor's `z-index` so sibling footers/nav bars never bleed through or steal clicks.

3. **Keep Cards Scannable & Progressive**
   - Show abstract metadata on list cards (badge, source header, capability level, title, and fit score where applicable); reveal dense constraints, summaries, and action menus inside the preview modal/drawer.

4. **Motion & Canvas Rules**
   - Use `transform` and `opacity` transitions; keep durations crisp (`150ms–460ms`).
   - Pause hover/float keyframes on `:hover` so targets stay steady under the cursor.
   - Gate `requestAnimationFrame` loops on `!prefersReducedMotion.matches && !document.hidden && !isOffscreen`.
   - Always include `@media (prefers-reduced-motion: reduce)` overrides disabling custom animations and parallax.
