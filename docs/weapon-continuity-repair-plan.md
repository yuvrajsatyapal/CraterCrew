# Weapon continuity and impact repair — 2026-10-10

## Requirements

- A new battlefield uses the same material world used by added weapons. Untouched land must keep its geometry and shading through first, second and mixed weapon shots. Tank support must agree with that world.
- Original projectiles sweep their travelled segments against material and tank bodies, like added projectiles; damage and explosion coordinates refer to the first contact.
- Playback interpolates projectile positions between physics ticks, preserves wrap seams, and removes the projectile at its recorded impact time. Tank hits use timestamped damage events for feedback.
- Inspect the supplied Pocket Tanks video, including Puzzle Pack at 42:42. Record observed mechanics separately from inferred behavior; do not claim exact coverage for newer packs absent from this video.

## Plan

1. Reproduce continuity, tank interception and playback issues with failing regressions.
2. Initialize authoritative cells and tank support once, repair original collision sweeps, and align playback with impact timestamps.
3. Inspect Puzzle reference and repair confirmed mismatches with test-first changes.
4. Run the complete unit suite, client/Worker type checks, build and focused browser tests for consecutive mixed shots and weapon playback. Save verification here.

## Findings and repairs

- Reproduced six initial failures: missing initial world, untouched terrain changing after Puzzle Box, original shell crossing a tank, original shell crossing a six-pixel wall, stepped projectile heads, and a projectile remaining visible after its impact began.
- New matches now initialize a material world once and derive terrain/tank support from it. The first added shot no longer replaces a different terrain representation. The generator retains its maximum initial ground depth within the six-pixel grid.
- Original shots sweep at half-cell intervals through defensive materials and tank bodies. Original blast times now use the terminal trajectory tick, including Airburst fragments with their common stem.
- Projectile heads interpolate between ticks without drawing across wrapped screen seams. Timestamped impacts determine projectile visibility.
- Three further regressions reproduced Nail Gun's delayed damage, delayed excavation and Reference Airburst's endpoint mismatch. Nail Gun now scores and excavates at path arrival ticks; Reference Airburst retains the sample where it explodes.
- Both original and added weapons retain deterministic simulation, bounded trajectories, persistent material state and score conservation.

## Video observations and limits

Reference: https://www.youtube.com/watch?v=CnYdKTtlbb8 (Pocket Tanks All Weapons, published May 30, 2020). Opened and inspected in the browser after direct web fetch failed. The expanded description identifies Puzzle Pack at 42:42. Paused gameplay at 42:46 and 42:51 shows localized ground changes and individual score increments; 42:56 shows the transition to Bouncy Blocker. Earlier playback shows ordinary projectiles and crater impacts. These observations guide locality and synchronization requirements. They do not establish exact formulas, sizes, timings or full mechanics for all 79 newer weapons. Existing Puzzle tile behavior has not been rewritten from isolated frames. Most catalog packs were added after this recording; exact fidelity requires additional footage for those weapons.

## Verification

- 209 unit tests passed in a serial run, including every added weapon followed by an original shell, replayed material patches, unchanged terrain outside modified columns and final tank support.
- Client and Worker TypeScript checks passed.
- Production build passed with the existing Phaser chunk-size advisory.
- Browser playback completed for all 79 added weapons, with matching scores and turn handoff. Arsenal checks passed at desktop, portrait-phone and landscape-phone widths.
- Normal-motion Lava Flow completed with grounded material and authoritative scores.
- The final-bundle consecutive-shot test proved untouched center terrain was pixel-identical through Puzzle Box, Standard, Lava Flow and Big Bang. Capture: `docs/previews/weapon-continuity-repaired.png`.
- Final-bundle Nail Gun, Reference Airburst, Starfall and Moon Rain playback completed without page errors and with authoritative scores.
- Resource contention caused unit-suite and final browser-batch timeouts during concurrent verification. Serial unit verification passed; the browser batch passed after increasing its aggregate budget. Per-weapon 15-second completion assertions remain unchanged.
- The online test's default Concrete aim can miss, so its unconditional material assertion was unreliable. The synchronization fixture now uses Rampart, which creates concrete at the firing tank. The corrected online test passed: both clients received identical material worlds and scores after the material shot and the following original shell.

## Independent review repairs

The code reviewer reproduced two additional failures; both received failing tests before repair:

- Starfall (`scatter`, seed 1, 15°, power 20) and Moon Rain (`airburst`, seed 1, 15°, power 30) could explode inside already empty craters because every path was traced against the initial world. Their trajectories now incorporate strictly earlier impacts from the other projectiles, including the common Airburst stem's elapsed time. Simultaneous impacts share pre-impact terrain. Bounded reconciliation accounts for impacts generated in a different array order.
- Older height-only match replay used `path.length` for crater timing and damage feedback despite having recorded blast timestamps. Both consumers now prefer the recorded timestamp and preserve fallback support for older results without one.

Independent review verdict: ACCEPT, with no remaining actionable correctness findings.

The reviewer additionally checked 1,092 Starfall/Moon Rain combinations across six seeds, 13 angles and seven powers: no explosion on already excavated terrain was found. Terrain copying is now limited to traces that replay prior craters, avoiding a full cell copy for ordinary previews and bot aim candidates.
