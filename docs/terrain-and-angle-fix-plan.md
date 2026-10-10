# Terrain fills and aiming during opponent turns

The battlefield must render the actual terrain silhouette after new games and
craters, with no diagonal ground across the sky. Shaded layers must form simple
polygons that remain above the canvas floor, even at the deepest crater.

The selected angle must stay fixed while controls are locked for an opponent's
shot, matching power. Inactive tank barrels must retain their selected angles.
Each local player retains their own angle and power. Online clients and solo
humans retain their own selection during opponent turns. New games reset aiming.

Plan:

1. Add a regression that captures the renderer's actual terrain paths and checks
   that shaded fills never cross the floor. Confirm failure before clipping them.
2. Add turn and shot regressions for angle values, locks, and barrel directions.
   Confirm failures before adjusting angle ownership and rendering.
3. Keep terrain physics unchanged; clip only the decorative fill coordinates.
4. Run unit tests, browser turn regressions, type checks, build, and formatting.

Verification completed:

- Both renderer regressions failed before the fix and passed afterward.
- The local power regression failed before per-player power storage was added.
- All 34 unit tests passed; client and Worker type checks passed.
- Production build passed, with the existing Phaser bundle-size warning.
- Five Chromium regressions passed: local controls, local saved settings, solo
  turns, online saved settings and control locks, and desktop rendering.
- Inspected the captured desktop battlefield: terrain shading follows the ground
  without a diagonal fill wedge. Changed-file formatting passed.
