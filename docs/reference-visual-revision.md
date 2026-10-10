# Reference visual revision

Date: 2026-10-09. Status: approved by the user for implementation in one uninterrupted pass. Target: as close as possible to the supplied video, including controls and motion; do not claim a measured 99% match.

## Intent

Recreate the appearance and interaction of the supplied Pocket Tanks gameplay as a reverse-engineering learning exercise. The user explicitly wants close visual fidelity, superseding the earlier moon-quarry visual direction. Support small and large screens while retaining a fully visible battlefield and usable controls.

Reference: https://www.youtube.com/watch?v=DdqD99IEi8s — “World record score in pocket tanks.” Directly inspected paused frames at 0:19, 2:20 and 2:50 through the browser. This is a visual study of those frames, not a claim to have reconstructed every weapon or the original simulation.

## Observed differences and proposed design

| Element     | Reference observation                                                                                                       | Revision                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sky         | Predominantly black, becoming purple near the horizon; no star field, moon, orbit or grid                                   | Reproduce the black-to-purple backdrop and remove the current decorative scenery                                                         |
| Terrain     | Bright green outer contour with several darker green strata; dramatic hill and crater silhouettes                           | Match the layered green rendering and contour treatment; preserve the actual destructible collision surface                              |
| Tanks       | Small green and orange tanks with shaded hulls, visible treads and narrow barrels                                           | Replace pastel rounded illustrations with compact shaded tank drawings; match their scale relative to the terrain                        |
| Score       | Large green/orange player names at opposite top corners, silver numbers beneath; volley centered                            | Overlay the scoreboard on the sky; remove the separate web-style score strip and badges                                                  |
| Controls    | Dark metal console with silver bevels, black numeric wells, orange italic Fire; Move and Angle above Weapon and Power       | Rebuild the console as a compact two-row arrangement using real accessible controls                                                      |
| Composition | Landscape game framed around the battlefield and a bottom console; decorative game logo and tank model occupy console sides | Keep the reference proportions on wide screens, with a CraterCrew wordmark and a locally drawn tank illustration in those side positions |
| Feedback    | Small active-player arrow, projectile trails and score numbers near impact                                                  | Use restrained arcade feedback in player colors; retain actual projectile animation and terrain settling                                 |

The video image includes blurred outer side fill around the original game capture. That fill is presentation by the recording, not part of the playable battlefield; do not reproduce it as game scenery.

## Responsive layout

- Desktop and landscape: use one centered, aspect-preserving game composition. Keep names and scores inside the upper sky and the metal console below the battlefield. Scale the composition from the available width AND height; avoid cropping or stretching terrain. Give spare space a plain black background.
- Short phone landscape (including 844 × 390): reduce console decoration before shrinking interactive controls. Use safe-area insets and retain all gameplay actions within the visible viewport.
- Phone portrait (including 375 × 812 and 390 × 844): show the entire landscape battlefield above a compact two-row console. Omit decorative console side artwork. Keep controls at least 44 CSS pixels tall; keep angle/power adjustment in the existing dedicated ruler panel. Do not require rotation to play.
- Tablet and large desktop: verify 768 × 1024, 1440 × 900 and 1920 × 1080 as well as small-screen sizes. Names must truncate safely; large and negative scores must fit.

## Movement, selection and animation

The user clarified that behavioral fidelity includes tank movement, button operation, weapon selection and the complete ground-impact animation. Matching the reference therefore includes motion and interaction, not only static styling. Exact timings and weapon-specific effects require further playback observation before claiming a match.

- Active tank: the turn selects which tank the controls operate. Its indicator identifies it; the opponent remains inactive until the turn changes.
- Move: left/right console buttons move the active tank along the terrain. Animate the treads and translation together, and continuously align its hull with the ground beneath it rather than interpolating only the start/end heights. Display remaining moves. Preserve the existing fuel and steep-slope rules unless a separately approved rules revision changes them.
- Weapon: add previous/next buttons around the weapon readout, reflecting the reference console. Show the selected weapon name, ammunition and a readable icon. Allow a direct selection list for touch and keyboard users. Selection does not fire the weapon; unavailable ammunition cannot be fired.
- Angle: use left/right fine-step controls beside the numeric angle; update the barrel immediately. Preserve the accessible ruler editor for direct drag adjustment on touch devices.
- Power: use fine-step controls beside the number and update the filled power bar immediately. Power changes launch speed; angle changes launch direction.
- Fire: lock conflicting actions while the shot resolves. Launch from the barrel tip, animate the shell along the shared simulation path and draw only its actual flight trail. Any recoil or muzzle flash must be checked against playback before adding it for stylistic effect.
- Ground impact: trigger each explosion when its own projectile reaches its collision point. Synchronize the flash, expanding blast, debris and terrain removal; do not wait for the final projectile in a multi-projectile shot to start every crater animation.
- Unsupported tank: after its supporting ground is removed, animate an accelerating fall, then settle the hull onto the new slope. Tune landing response against the recording; avoid a conspicuous cartoon bounce unless the reference supports it.
- Scoring and turn handoff: show impact score feedback near the hit, update the scoreboard, and enable the next player's controls after the shot and settling animation finish. Keep the existing ten-volley scoring rules.
- Weapon differences: preserve the current basic shell, heavy blast, scatter, bounce, digger and airburst behavior. Give each its appropriate flight/impact sequence; do not make every weapon share one generic explosion. The video's additional weapon names do not establish that the full original catalog is implemented.
- Responsive timing: use elapsed time rather than rendered frame counts so motion has consistent duration on small and large screens. Bound simultaneous particles and skip extra effects in reduced-motion mode; preserve collision, damage and scoring results.

Add meaningful tests for selection/ammunition, action lockout, per-projectile impact ordering, terrain-following tank movement and turn handoff after settling, alongside the existing match and responsive checks.

## Implementation sequence

1. Add browser regressions for full battlefield bounds, visible gameplay controls and opening/closing both aiming panels at each representative viewport. Run them before changing rendering/layout to identify actual failures.
2. Change `src/client/arena.ts`: reference backdrop, green terrain palette, shaded green/orange tanks and restrained effects. Draw static backdrop once; redraw terrain only when its surface changes; retain fixed logical simulation coordinates.
3. Change `src/client/main.ts`: overlay score markup, concise arcade labels, console decoration and control arrangement. Retain existing action IDs, keyboard bindings, accessible range inputs and room synchronization.
4. Consolidate the game-specific rules in `src/client/style.css`: reference palette, bevels, black readout wells, scoreboard typography, desktop composition and portrait/short-landscape behavior. Match the video even where that intentionally supersedes the earlier palette.
5. Run unit tests, both TypeScript checks, production build and the relevant local/online browser flows. Capture desktop, portrait and short-landscape output; inspect visually against the reference.
6. Measure render behavior during aiming and terrain impacts. Report observed frame rates and environments; do not promise a performance target without measurements.

## Acceptance

The sky, terrain, tank scale, corner scoreboard and metallic console should be recognizably faithful to the supplied recording. No moon-quarry styling should remain in gameplay. Full terrain extents must remain visible; all controls must be reachable in both orientations. Aiming, weapon selection, alternating turns, scoring, match completion and rematch must continue working.

This revision covers the presentation of existing gameplay. Exact replication of the original weapon catalog, weapon algorithms, terrain generator or undocumented physics is a separate reverse-engineering scope requiring more observations. Asset identity or pixel-perfect matching is not claimed by this plan.
