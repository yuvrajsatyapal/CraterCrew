# Projectile visuals and saved aiming

Reference: https://www.youtube.com/watch?v=CnYdKTtlbb8 (Pocket Tanks All Weapons).
Observed compact colored shots and weapon-specific impact effects. This is a
visual reconstruction for learning, not a claim of exact original tuning.

Requirements:

- Ordinary projectile flight must not draw a connected path behind the head.
- Keep smooth interpolated travel, weapon colors and head shapes, and explicit
  beams, ropes and impact effects. Reduced FX must also remain trail-free.
- Each player keeps their submitted angle and power across opponent turns.
  Temporary weapon barrel alignment must not replace the selected controls.
- Online reconnects restore the last submitted settings for the correct player.

Root causes: drawFlight unconditionally strokes recent path samples; main.ts
stores temporary aim events in playerAngles; room joins reinitialize powers
without any authoritative saved power to restore.

Plan: add failing renderer, special-weapon turn-cycle and reconnect regressions;
remove generic flight strokes, separate animation aim from selected aim, save
submitted settings in tank state, then run unit/browser checks, types and build.

Verification:

- Before the fix, flight-line regressions failed; Turbo Cannon returned 0° and
  Reflex Missile returned 16° instead of the selected 73°. Online reload returned
  45° instead of the last submitted 90°.
- After the fix, all 226 unit tests passed. Client and Worker type checks,
  production build and changed-file formatting passed.
- Eight targeted Chromium checks passed across two runs: solo turns, local turn
  cycles, both online players' turns/reconnects, both special-weapon aim cycles,
  normal-motion multi-hit feedback, manual aiming after Reflex Missile, and
  reference material weapon multiplayer synchronization.
- Live Standard and Big Bang shots visibly render compact heads with different
  colors and no connected flight trail. Capture: previews/projectile-no-trail.png.
- Vite retains its existing large Phaser chunk warning. No deployment performed.
