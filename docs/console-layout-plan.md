# Console layout optimization

Improve the existing battle console shown in the user's screenshot. Keep the silver hardware, black readouts, Fire artwork and purple/gold identity. Use a compact centered strip on desktop: brand, movement, weapon, Fire, angle, power, tank. Use symmetric columns to center Fire exactly. Cap module widths instead of expanding them with ultrawide viewports, and reduce the console height to leave more room for the battlefield. Decorative art is subordinate to the controls.

Below 1280px and in short landscape windows, stack Move/Weapon on the left and Angle/Power on the right, with Fire centered between the two rows. Preserve phone touch targets, aiming editors, all action IDs, game state and gameplay. Changes are limited to layout CSS.

1. Add browser regressions for a bounded desktop console, controls fitting their panel, and nonoverlapping modules across desktop, tablet, phone and short landscape.
2. Verify the new desktop assertions fail before applying layout changes.
3. Replace the expanding desktop sizing rules and add the wide single-row arrangement using existing colors and art.
4. Run the layout and existing aiming/touch regressions, unit suite, typecheck, production build and formatting checks. Inspect desktop and phone screenshots.

Acceptance: desktop console is at most 150px tall; wide controls remain at most 360px wide; all visible controls and ammo text stay inside the panel; no modules overlap or horizontal page overflow occurs; portrait action targets remain at least 44px.

Verification: the regression first detected the oversized 280px console, then detected Fire being 464px off-center. The final layout regression passes at ten viewport sizes from 320px to 3396px, checking exact Fire centering, left/right grouping, module bounds, overlap and ammo placement. Phone touch targets and aiming editors pass; existing battlefield resize, fine aiming, weapon cycling and keyboard confirmation checks pass. Production build, client/worker typechecks, changed-file formatting and whitespace checks pass. All 263 unit tests pass with two workers; the initial unrestricted concurrent run had three simulation test timeouts, resolved by separating browser and unit runs and limiting worker count.
