# Weapon mechanics repair — 2026-10-10

User report: added weapons behave incorrectly; screenshot shows a floating lava rectangle and tanks resting on unnatural material geometry.

## Confirmed causes and requirements

- Flow writes rectangles capped at twice the nominal depth. Columns over deep valleys float; six-pixel rectangles started at fractional coordinates overlap and replace terrain. Fill only air in reachable, supported columns, preserve hills and barriers, and evaluate damage against the actual deposited material at the hit timestamp.
- Flight checks one endpoint per tick and ignores initial collisions for two ticks. Sweep the travelled segment through material cells and tank bodies, start ordinary shots at the barrel tip, and resolve the first collision. Preserve deliberate drilling, reflection and wrapping.
- Material terrain shading is based on screen rows, introducing global stripes. Shade dirt by depth below its local surface without losing tunnels or persistent materials.
- Wrapped trajectories must break their rendered trail at the screen seam.

## Execution and validation

1. Add failing regressions for supported flows, terrain preservation, dry tanks, thin barriers, tank interception and screen seams.
2. Repair shared primitives, then check affected weapon families and existing legacy behavior.
3. Run the full unit suite, both TypeScript projects, production build, and browser weapon animation coverage. Inspect a normal-motion battlefield capture.
4. Record verification and reference limits here. The supplied 2020 video covers Puzzle but predates most of the added packs; do not claim exact reproduction of all original weapons.

No deployment requested. This workspace has no Git repository.

## Repairs and verification

- Swept projectiles now hit thin barriers and tank bodies, including immediately across a wrapped screen seam. Ordinary shots start at the barrel tip.
- Pools fill aligned air cells down to ground, stop at blocking ridges, and preserve existing hills and defensive material. Lava and goo no longer act as solid support.
- Flow damage and Lava Flow cooling are restricted to the cells deposited by that operation. Lava cooling converts supported lava rather than painting a horizontal concrete strip.
- Magnablobs, Sticker Shock, Knockback and Bump Rockets require a reached target before applying attachment, damage or displacement.
- Dirt shading follows each column's surface depth; wrapped projectile trails break at the seam.
- Added 15 physics regressions and 2 renderer regressions. Each confirmed failure was run red before its repair. The full unit suite passed: 195 tests across 14 files.
- Both TypeScript projects and the production build passed. Changed files passed Prettier. The build retains the existing Phaser bundle-size warning.
- Independent code review found four additional issues during iteration; all were reproduced, repaired, and rechecked with no remaining important findings.
- Browser verification is pending completion. The initial four-worker attempt had resource-related timeouts and was interrupted; its results are not counted as passing verification.
