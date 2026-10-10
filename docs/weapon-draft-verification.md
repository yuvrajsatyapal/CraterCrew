# Weapon draft verification — 2026-10-10

Implemented the approved design in docs/weapon-draft-design.md.

## Behavior

- All game modes and rematches enter the weapon shop before battle.
- Twenty unique random special weapons are split through alternating picks,
  ten per tank. Standard shells remain unlimited outside the draft.
- Each pick gets 15 seconds; expiration automatically assigns a random weapon.
- Solo bot picks automatically. Random distributes remaining stock to both tanks
  without changing earlier selections.
- Online rooms validate picks and synchronize inventories, deadlines, pauses,
  reconnects, forfeits, and rematches. Late-packet expiry transitions are saved
  and broadcast even if the expired selection is rejected.
- Battle browsing shows only owned weapons. The last online pick and battle
  reconnect restore the complete loadout.
- Keyboard focus returns after opponent picks; a persistent live region announces
  selections and turns. The phone clock stays visible while scrolling the pool.

## Evidence

- `npx vitest run --maxWorkers=4`: **274 tests passed in 23 files**.
- `npm run typecheck`: client and Worker passed.
- `npm run build`: production build passed. Existing Phaser chunk-size warning remains.
- New browser helpers/diagnostics were separately checked with strict TypeScript.
- Formatting checks on changed implementation and test files passed.
- `git diff --check` passed.
- Full browser run: **50 passed, 5 failed** initially. Three failures were stale
  assertions for the legacy aiming dial that the pre-existing CSS hides; checks
  now assert the visible angle/power rulers. Two failures were loading/test
  timeouts under concurrent load. The reconnect canvas wait now allows 15 seconds.
- Final targeted run with one worker: **14/14 passed**, including all nine draft
  scenarios and all five initially failing existing cases. The terrain test passed
  without increasing its test timeout. Across these runs, all **56 current browser
  scenarios** have passing evidence; a second full-suite run was not performed.
- Independent Gate 3.5 reviewer accepted the final authority, lifecycle,
  loadout, keyboard, and Worker expiry corrections.

## Previews

- Desktop: docs/previews/weapon-draft-desktop.png
- Phone: docs/previews/weapon-draft-phone.png

Tests cover 375px, 768px, and 1440px draft layouts, solo Random and bot turns,
keyboard selection, countdown expiry, menu cleanup, final loadouts, online draft
and battle reconnect, plus the existing full-match/rematch, aiming, physics,
weapon animation, sound, and console layout scenarios.

Changes remain in the existing feature branch. No deployment or push performed.

## Visible Random distribution follow-up

- Random assigns weapons one at a time, alternates recipients, preserves earlier
  choices, and displays both completed inventories for 1.5 seconds before battle.
- Phone inventories stay in view and follow the latest assignment. Manual inputs
  are locked while AI deals. Returning to the menu cancels dealing and battle entry.
- Focused shared/room/Worker unit tests: **20 passed in 4 files**.
- Final client and Worker typecheck and production build passed.
- Four targeted draft browser tests passed: existing solo Random loadout checks,
  incremental distribution and completion pause, menu cancellation, and immediate
  phone inventory visibility.
- Online draft and battle reconnect passed on a separate rerun. An earlier suite
  run encountered a Playwright trace ZIP write error during browser-context cleanup;
  the online scenario passed with tracing disabled.
- Independent Gate 3.5 reviewer accepted the correction and phone scrolling.

- Existing solo bot battle test passed with a 90-second budget (40.9 seconds).
  Its prior 45-second overall limit was exceeded in the first final run; the test
  now allows time for both the visible draft sequence and battle turns.
- Final formatting and `git diff --check` passed.
- Completed phone loadouts: docs/previews/random-loadouts-phone.png.
