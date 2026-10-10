# Retro console and full-width battlefield refresh

## User brief and design

Improve the existing interface using the supplied artillery-game console references: sculpted olive metal, deep black instrument wells, raised arrow buttons, purple/gold wordmark, segmented red power gauge, and a prominent gold Fire button. Remove black empty side margins on large displays. Preserve game rules and all current action IDs, keyboard controls, selection, aiming and touch workflows.

The game shell and console fill the viewport. A responsive camera fits the complete fixed-coordinate battlefield and extends its sky and edge terrain into spare space, preserving proportions and simulation boundaries. Portrait layouts retain their compact control layout. Styling uses native CSS and existing artwork, with richer highlights, shadows and tactile pressed states; no new libraries or remote assets.

## Implementation plan

1. Add failing viewport geometry tests and a wide-screen browser regression.
2. Resize the renderer with its host; fit the fixed world through camera zoom/scroll and draw scenery across the camera view. Clean up resize listeners on shutdown.
3. Remove shell width caps and polish console modules, action buttons, readouts, footer, menu buttons and dialog actions. Respect existing compact breakpoints, focus rings and reduced motion.
4. Run geometry tests, unit suite, TypeScript/build checks and responsive/aiming browser checks. Inspect screenshots at wide desktop, ultrawide, portrait and short landscape.

## Acceptance

- At 1920 and 2560 pixels wide, shell, battlefield canvas and console reach both viewport edges.
- Entire original world remains in view with a uniform scale; resizing does not alter aim or physics.
- No horizontal overflow; mobile aiming, weapon selection and Fire remain usable.
- Retro control labels remain readable and keyboard focus remains visible.

## Verification

- Unit suite: 20 files, 263 tests passed. Camera/render regression rerun after the final resize fix: 11 passed.
- Production build, client/worker TypeScript checks, changed-file Prettier checks and git diff whitespace checks passed.
- Chromium: 5 selected browser tests passed, covering desktop rendering, aiming panels, weapon cycling, portrait touch controls, and viewport resizing across 320, 375, 390, 500, 768, 844, 1440, 1920 and 2560 pixel widths.
- Inspected desktop, ultrawide, portrait and short-landscape screenshots. The complete simulation remains uniformly scaled inside a canvas that fills the arena. Scenery extends outside the fixed gameplay boundaries.
- Corrected a resize regression by supplying the host's current dimensions to Phaser's scale manager from ResizeObserver.

## Button refinement follow-up

User requested further improvement to the buttons. Refine the existing button faces with a consistent satin-metal gradient, stronger raised/recessed edges, geometric directional glyphs instead of font-dependent arrows, a sculpted Fire button, visible selected arsenal entries, and framed close buttons. Keep accessible button names, action IDs and phone touch sizes. Validate through the existing aiming, cycling, portrait and responsive browser tests plus build/format checks; this is a reversible presentation change.

Button refinement verification: production build and changed-file Prettier/whitespace checks passed. Six relevant Chromium checks passed across the runs: desktop rendering, fine aiming, nine-size responsive layout, portrait touch targets, weapon cycling, and weapon picker/close interaction. Inspected desktop menu and battle screenshots. Two concurrent runners initially collided in the shared artifact folder; affected checks passed when rerun together with an isolated output path.

## Silver reference follow-up

Apply the user's latest reference throughout the existing interface: neutral silver raised bevels, black instrument wells, white labels with dark outlines, and an orange/red-to-yellow Fire wordmark. Preserve all responsive geometry, action IDs, keyboard focus, and game behavior. Update shared metal tokens, menu/dialog actions, arsenal rows and console surfaces; verify existing interaction and viewport checks plus production build. No new screens or gameplay changes.

## Reference slider correction

Recreate the supplied HEIC editor photos: angle uses a silver scrolling numbered ruler with a fixed red selection band and opposing triangular markers; power uses a recessed red level track and circular silver thumb. Both share large outlined arrow keys, a black value well with a raised title tab, and a circular green confirmation key. Use Arial labels, normal-weight numerals, and matching ruler typography. Retain native accessible ranges, existing action IDs and input/keyboard behavior. Verify fine adjustment, limits, confirmation, keyboard and phone layouts with existing browser regressions and build.

## Fire and logo lettering correction

Replace the narrow Impact lettering with broad Arial Black arcade lettering. Apply an explicit slant so rendering does not depend on synthetic italic support. Fire uses the reference's thick black outline and red/orange/yellow fill. Both CraterCrew wordmarks use the same broad slanted forms with purple and gold beveled gradients; keep the console mark inside its allotted grid slot. Match the small header wordmark to those colors. Verify desktop screenshots, phone/short-landscape overflow and weapon/aim controls, then build and format checks.

## Fire image overlay

User requested a transparent image cutout instead of rendered lettering. Isolate Fire from the supplied screenshot, save the transparent PNG in public/ui, and place it over the existing metal button. Give the button an explicit accessible Fire label and keep its action ID and responsive hit area. Verify the rendered transparency, desktop/phone fit, build and browser controls.
