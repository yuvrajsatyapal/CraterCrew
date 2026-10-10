# Pre-game weapon draft

Status: approved by the user for implementation in one go; implemented and verified.

## Requested outcome

Before a battle starts, show a random pool of 20 weapons. Players choose
weapons one at a time, with a clock for every pick. Single-player mode has
a Random button that assigns weapons to both tanks. The supplied screenshot
is the visual reference. The linked video's first 17 seconds were requested
as a reference, but the video could not be retrieved during this review.

## Proposed rules and assumptions

- Apply the draft to solo, local two-player, and private online games, including
  rematches. A battle starts automatically when all 20 picks are complete.
- Sample 20 distinct special weapons from the existing catalog. Keep the
  unlimited Standard shell available to both players outside the draft.
- Nova/seat 1 picks first; then alternate seats. Each player receives 10
  different weapons. Picking removes a weapon from the shared pool.
- Allow 15 seconds per pick. At expiration, assign one remaining weapon
  randomly to the active player and start the next pick's clock.
- In solo mode, the bot chooses automatically after a brief visible pause.
  Random assigns all remaining weapons, alternating between seats and
  preserving weapons already picked. Show this button only in solo mode.
- Grant each drafted weapon its existing ammunition amount. Other special
  weapons have zero ammunition and are absent from the playable arsenal.
- Use a fresh random pool for every new match and rematch. No reroll control
  or additional confirmation screen is needed.

The 15-second duration, automatic timeout pick, and inclusion of online play
are proposed defaults, not details explicitly supplied by the user.

## Approach

Recommended: one shared draft state machine, used locally and by the online
room authority. It owns pool generation, turn ownership, picks, revision,
deadline, random completion, and final ammunition assignment.

A client-only draft would be smaller initially, but it could not enforce
online ownership or reliably synchronize deadlines and reconnects. Giving
each player an independent selection list would avoid alternating turns but
would change the shared-pool experience shown in the reference.

## Screen design

Use the reference's three-part composition: Nova's chosen weapons on the
left, the shared weapon pool in the center, and Rook's chosen weapons on the
right. Use existing weapon art, metal buttons, typography, and the current
cyan/orange player palette from src/client/style.css. There is no existing
.planning/design-config.md; existing styles are the source of visual values.

At the top, show “Weapon Shop,” the active player's name, pick progress,
and a clock with a numeric countdown. Highlight the active player's panel
and label it “Your pick,” “Nova's pick,” or “Rook is choosing” as appropriate.
Every weapon button shows its icon and name; its description is available
without requiring hover. Assigned panels show name and count, such as 3/10.
The solo Random control sits beneath the pool, with text explaining that it
distributes the remaining weapons to both tanks. Provide a Menu control.

On narrow screens, put compact player inventories above the pool, retain a
two-column weapon list, and allow inventories to scroll without displacing
the clock. Keyboard and touch selection use real buttons, visible focus,
and labels. Announce turn changes and selections without announcing every
countdown tick. Reduced motion suppresses decorative pick transitions.

## Integration and lifecycle

- src/shared/weapon-draft.ts: renderer-independent seeded draft rules.
- src/client/main.ts and a focused draft view module: enter the draft from
  start/rematch, render updates, run solo bot picks, and mount Phaser only
  once the draft completes. Restrict battle weapon browsing to owned stock.
- src/client/style.css: responsive draft layout using existing theme values.
- src/shared/room.ts: add a drafting phase and authoritative pick commands.
  Reject wrong-seat, duplicate, unavailable, expired, and stale picks.
- worker/index.ts: persist and broadcast draft state and schedule deadline
  alarms during drafting as well as playing. Reconnecting clients restore
  the same pool, assigned lists, turn, and deadline.
- Pause online drafts on disconnection, use the existing 30-second grace
  and forfeit behavior, and resume with a fresh pick deadline. Show paused
  state explicitly. Handle a draft forfeit without mounting the battlefield.
- Cancel local clock and bot callbacks when leaving or restarting. Check
  existing session generations so old callbacks cannot enter another game.
- The shared match constructor can retain its full-inventory behavior for
  simulation tests; the draft completion boundary applies player loadouts.

## Test-first implementation sequence

1. Write failing unit tests for 20 unique deterministic weapons, alternating
   picks, 10 weapons per player, validation, timeout picks, partial Random
   completion, and ammunition assignment; implement shared draft rules.
2. Write failing room tests for ready-to-draft, authority, deadlines,
   disconnect/reconnect, forfeit, and rematch; integrate room and alarms.
3. Add browser tests for the draft screen, solo bot and Random behavior,
   local alternating picks, timeout, exit cleanup, restricted battle stock,
   and online synchronization. Update existing game-start browser flows to
   complete drafting before interacting with battlefield controls.
4. Implement and review the responsive screen against the supplied image,
   then verify at 375px, 768px, and 1440px widths.
5. Run unit tests, type checks for client and Worker, production build, and
   relevant browser flows. Confirm all modes and rematches enter drafting
   and that only drafted weapons plus Standard are usable in battle.

## Acceptance

Exactly 20 unique special weapons appear initially. Each pick visibly moves
one weapon to the active player's inventory. Both players finish with 10;
the timer restarts each turn and timeout cannot stall the draft. Solo Random
completes both inventories fairly. Online clients agree on all picks and
cannot select out of turn. Leaving or rematching does not reuse old timers,
and battle ammunition reflects the completed draft.
