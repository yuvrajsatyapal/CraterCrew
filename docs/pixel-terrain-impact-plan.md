# Pixel terrain and weapon impact repair

Reference: https://www.youtube.com/watch?v=CnYdKTtlbb8 (Pocket Tanks All Weapons).
Observed stepped green terrain, persistent strata outside compact craters, and
weapon motion leading into excavation. This is a behavioral study, not a claim
of identical source physics or complete fidelity for all 85 weapons.

## Acceptance criteria

- Excavation removes occupied cells without recoloring surviving dirt in that
  column. Original hill-relative strata survive cloning and shot replay.
- Ground has restrained, deterministic two-pixel grain over six-pixel collision
  cells. Existing material colors and underground pockets remain legible.
- Canvas scales with crisp edges rather than smoothed interpolation.
- Skipstone reflects from vertical barriers instead of repeatedly hitting them.
- Booster Worm's drill uses its actual flight route and reveals only the route
  reached so far. Multi-point laser routes likewise reveal progressively;
  instantaneous two-point beam attacks retain their existing timing.

## Implementation and verification

1. Add regressions for surviving dirt colors, grid-aligned grain, barrier bounce,
   and progressive drill/laser graphics; observe failures before changes.
2. Store original surface rows as optional serialized world appearance metadata.
   Use that immutable profile for strata; add deterministic pixel grain.
3. Correct legacy bounce wall response and synchronize Booster Worm drill route.
4. Disable canvas smoothing, verify unit suite, type checks, build, and browser
   mixed-weapon playback. Capture the resulting terrain for visual inspection.

## Root causes and final design

The material renderer measured depth from the first remaining dirt cell. A crater
therefore shifted the shading of the entire surviving column. `dirtSurface` now
records the original surface rows when the world is created. It is optional for
older serialized worlds and is preserved by cloning and JSON transport; patches
continue to change only occupancy. Pixel grain uses world coordinates, not the
redraw count, so destruction cannot shuffle the texture. Layers darken with depth
rather than repeating bright stripes underground.

Skipstone's legacy trace reflected vertical velocity on every terrain contact.
The repair distinguishes vertical wall contact and reflects horizontal velocity,
returning the next sweep to the last free position.

Booster Worm previously rendered three drill control points while its projectile
followed 100 different samples; excavation occurred only every 12 samples. The
effect now uses the same route and clears a swept segment at each arrival tick.
Multi-point drill and laser effects reveal only their reached route; the laser's
white core follows the revealed bends as well.

## Verification

- Nine added unit regressions were observed failing before their respective fixes.
- Final full unit suite: 235 passing tests across 16 files.
- Client and Worker TypeScript checks, production build, and changed-file formatting pass.
- Sequential full-motion browser check passed for Big Bang and Booster Worm,
  with exact pixel equality for surviving dirt beneath the first impact and
  authoritative score totals after both shots.
- A concurrent verification run hit the existing five-second unit timeout and
  the new browser scenario's overall timeout; sequential reruns passed without
  extending either timeout. No runtime error was reported by the passing rerun.
- Fresh reviewer accepted after correcting a bent laser highlight and typing
  the new browser diagnostics accesses.
- Final screenshot: `docs/previews/pixel-terrain-repaired.png`.
- Production build retains the existing Phaser chunk-size warning.
- Final five-scenario browser run passed: full-motion Lava Flow, consecutive mixed
  weapon terrain/pixel preservation, piercing/airburst/scatter playback, online
  material synchronization, and short/narrow viewport battlefield bounds. Together
  with the isolated impact/Booster Worm scenario, six browser scenarios passed.
