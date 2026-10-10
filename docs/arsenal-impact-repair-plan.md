# Arsenal layout and impact playback repair — 2026-10-10

## Scope and design

Keep the existing green metal arsenal and pixel icons. Rows must grow to contain their title, wrapped description, pack metadata and ammunition. The header and search remain outside the scrolling list. Match the supplied Pocket Tanks reference's compact projectile, immediate collision flash, then expanding blast and terrain response. Preserve authoritative physics and online timing.

## Confirmed causes

- A scrollable CSS grid defaults to auto minimum track sizing, allowing 85 rows to shrink below their content height. Use max-content row tracks and start alignment, with explicit text wrapping.
- Source weapons render a dangling metadata separator because their power label is empty.
- Blast rendering starts with zero radius, leaving the exact collision frame without visible feedback.
- Replay traverses all terrain, tank and effect events every frame, including completed and future events. Consume a sorted timeline once, keep only current tank motions and active effects, and redraw terrain only when new patches arrive.

## Plan and acceptance

1. Add failing row containment checks at desktop, portrait and landscape sizes; add renderer regression for a visible collision flash; test bounded event consumption and chronological replay.
2. Repair CSS and metadata; add a replay cursor and integrate it into the arena; add a small flash at the actual collision point, honoring reduced motion.
3. Run unit tests, typecheck, build and browser arsenal/shot checks. Save a preview.

## Reference limits

Reviewed the opening Big Shot sequence and Puzzle pack at 42:42 in https://www.youtube.com/watch?v=CnYdKTtlbb8. The 2020 video predates Neutron and other later packs; these cannot be validated against that video. This repair is layout and replay optimization, not a claim of pixel-perfect reproduction of all weapons.

## Animation review

| Before                                                            | After                                                                                              | Why                                                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Blast begins at zero radius when projectile disappears            | Small contact flash at collision, fading over about 99 ms                                          | Removes the blank collision frame; centered at the authoritative impact coordinates (`src/client/weapon-effects.ts:102`) |
| All timeline events scanned repeatedly each frame                 | Sorted cursor consumes due events once; only active effects and latest tank movements are rendered | Reduces replay traversal work while preserving collision timestamps (`src/client/arena.ts:396`)                          |
| Tanks reset to flat orientation before their first movement event | Initial ground slope is retained                                                                   | Prevents a visible rotation jump when a shot begins (`src/client/arena.ts:411`)                                          |

Decision: Approve the changed motion. Contact feedback is bounded, reduced motion uses a small colored dot, and authoritative shot timing is unchanged. This is a review of the changed playback only; it does not claim an exhaustive audit of every weapon or measured FPS improvement.

## Verification

- Reproduced row overflow in browser regressions at 1440×900, 390×844 and 844×390 before applying the fix; all three pass after repair, across all 85 rows.
- Reproduced the invisible collision-frame renderer regression before the fix; passes in full and reduced motion after repair.
- 238 unit tests across 17 files passed, including timeline ordering, one-time patch consumption, frame skips, active-effect expiry and retained landing poses.
- Both TypeScript projects and production build passed. Changed source, tests and document passed Prettier. The existing Phaser bundle-size warning remains.
- 14 browser checks passed: search/filter/icon coverage at three viewports, Neutron/Puzzle replay batches, six original weapons, normal-motion Lava Flow, mixed shots with unchanged terrain pixels, instrument panels and row containment.
- Mobile preview: `docs/previews/arsenal-details-repaired.png`.
- No deployment performed. No FPS benchmark was run; optimization reduces event traversal by construction, and browser checks verify replay correctness.
