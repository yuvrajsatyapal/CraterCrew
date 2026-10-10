# Hit tag reference repair

Reference: https://www.youtube.com/watch?v=CnYdKTtlbb8, Single Shot around 0:05 and 3 Shot at 0:14.85–0:18.43. Inspected paused frames directly in the browser.

Observed: small white unsigned ordinary damage values, separate tags for the three 20-point hits, constant text size, upward drift with gentle horizontal motion, and the scoreboard already credited while tags remain visible. Tags do not fly into the scoreboard. Existing signed, bouncing, lane-spread tags with a maximum 900 ms lifetime differ from this behavior.

Scope/design: use plain white 14 px numbers with a thin dark edge, negative numbers for self-hit penalties, spawn at the affected tank body, rise steadily with subtle horizontal drift. Keep simultaneous tags separate with a small stagger. Use a 2400 ms lifetime (a visual approximation from the sampled frames), with a short final fade; reduced motion gets minimal travel. Keep existing hit/fall attribution and authoritative totals. Decouple cosmetic tag lifetime from shot completion so local and online turns stay aligned. Clear tags on cancellation/session changes; expire and destroy each tag normally.

Plan: add failing tests for unsigned hit formatting, constant scale, tank-centered origin, independent lifetime and scene cleanup. Implement feedback helpers and scene lifecycle changes. Run unit tests, typecheck, production build and hit-stream browser regression; inspect a live multi-hit shot. This is a focused presentation repair, not a recalibration of all weapon damage or effect shapes.

## Verification

- Red: five focused assertions failed against the prior tag implementation (format, motion, lifetime, idle expiry, cancellation).
- Green: 259 unit tests across 19 files pass, including turn completion with a still-visible tag.
- Typecheck and production build pass. Vite retains its existing large Phaser bundle warning.
- Chromium hit-stream regressions: 2 pass, including progressive multi-hit scoring to the authoritative 63 points and manual aiming after Reflex Missile.
- Inspected `test-results/reference-hit-stream.png`: separate small white 9-point tags above the struck tank, score credited to NOVA.
- Timing and sideways motion are approximations from the inspected frames, not measurements of the original source code. No weapon damage rules or server turn durations were changed.
