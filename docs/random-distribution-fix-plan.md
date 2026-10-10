# Visible Random distribution correction

The user wants to watch AI distribute weapons after pressing Random.
The existing handler completes all picks synchronously and immediately mounts battle.

- Preserve earlier picks; use the existing seeded randomPick transition for each
  remaining weapon, alternating recipients.
- Deal one weapon every 450ms on the existing disposable draft tick. Show
  “AI choosing for [pilot]” and disable manual picks and the Random button.
- Keep both complete 10-weapon inventories visible for 1.5 seconds before battle.
- Leaving cancels distribution and its completion pause through disposeDraft;
  starting a new game must restore a fresh manual draft.
- Test visibly incremental assignment, preserved picks, input locking, completed
  inventories, delayed battle entry, and cancellation using the real DOM and
  controlled Playwright time before modifying production code.
- Verify draft browser tests, shared/room tests, typecheck, and build.

## Completion

Random now deals through the existing draft tick, preserves prior selections,
locks picking during distribution, and holds completed loadouts for 1.5 seconds.
On phones it brings both receiving inventories into view and scrolls each list
to its latest weapon. Leaving resets the distribution state and cancels the tick.

The incremental distribution and cancellation regressions failed before the
implementation and passed afterward. The immediate phone visibility assertion
also failed before adding the scroll correction and now passes. Independent
Gate 3.5 review accepted the final timing, cleanup, and scrolling behavior.
