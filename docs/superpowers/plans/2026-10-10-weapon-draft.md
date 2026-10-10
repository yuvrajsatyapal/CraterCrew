# Weapon Draft Implementation Plan

Execution: inline, approved by the user's “implement in one go” instruction.
Spec: docs/weapon-draft-design.md.
Goal: add a timed 20-weapon draft before every match and rematch.
Architecture: deterministic shared draft rules; room authority owns online picks;
a focused client view owns rendering and local timer cleanup.
Tech stack: existing TypeScript, Vite, Phaser, Vitest, Playwright, Cloudflare Worker.

## Constraints

20 distinct specials, 10 per player, 15 seconds per pick, timeout random pick,
solo Random finishes remaining distribution, Standard remains unlimited.
Use existing palette, metal buttons, and weapon art; keyboard and touch support.

## Review focus

Late pick packets must not select for the next player; duplicate revisions reject.
Leaving must cancel callbacks; rematches must restore fresh draft state.
Disconnected drafts must pause and forfeit after grace; reconnect must restore picks.
Filtered arsenal must never expose undrafted ammunition or lose owned weapons.
Narrow screens must fit 20 choices, inventories, and timer without horizontal overflow.

## Task 1: Shared draft

Files: src/shared/weapon-draft.ts, tests/weapon-draft.test.ts.
Interfaces: createDraft(seed, now), pickWeapon(draft, player, id, revision, now),
randomPick(draft, now), completeRandomly(draft, now), applyDraft(match, draft).

- [x] Add tests for deterministic pool, alternate ownership, invalid picks,
      deadline validation, partial Random completion, and final loadouts.
- [x] Run `npx vitest run tests/weapon-draft.test.ts` and observe failure.
- [x] Implement immutable draft transitions and ammunition assignment.
- [x] Run the same tests and observe passing results.

## Task 2: Online rooms

Files: src/shared/room.ts, worker/index.ts, tests/room.test.ts,
tests/room-draft.test.ts. Consume Task 1 interfaces.

- [x] Add tests for ready-to-draft, stale/wrong picks, timeout, disconnect,
      reconnect, forfeit, and rematch. Adapt existing room setup to complete drafting.
- [x] Run room tests and observe failures before integration.
- [x] Add drafting phase, persisted draft, pick commands and alarm scheduling.
- [x] Verify all room and shared tests; run Worker typecheck.

## Task 3: Client and browser validation

Files: src/client/weapon-draft-view.ts, src/client/main.ts, src/client/style.css,
tests/e2e/weapon-draft.spec.ts, existing browser test helpers and flows.
Consume Draft and PublicRoom; view returns a dispose callback.

- [x] Add browser tests for 20 choices, alternating picks, timeout, solo Random,
      restricted loadouts, return to menu, rematch, responsive layouts, and online sync.
- [x] Build existing app and observe the new screen tests fail.
- [x] Implement three-panel screen, timed local draft and bot, synchronized online
      draft routing, cleanup, and inventory filtering.
- [x] Update old battle tests to complete drafting through visible controls.
- [x] Run typecheck, unit suite, build, relevant browser suite and review screenshots.
- [x] Record final results in docs/weapon-draft-verification.md.

No deployment, push, or commit requested; retain changes in the current feature branch.
