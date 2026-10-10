# Preserve aiming angles between turns

Players keep their chosen angle when control returns after an opponent's shot.
Each local player remembers their own angle; solo bot shots must not overwrite
the human angle, and online clients keep their own angle across both shots.
New local games and newly joined rooms start at 45° / 135°.

Root cause: `animateShot` unconditionally replaces the angle with the starting
angle after each completed animation.

Plan:

1. Add browser regressions for local turn cycles, solo bot turns, and online turns;
   run them against the existing build to confirm the reset.
2. Remember angles per player when aiming controls change and restore the
   appropriate angle at shot completion. Initialize them for a new session.
   Preserve existing power and weapon behavior.
3. Run the regressions, unit suite, type checks, build, and changed-file formatting.
