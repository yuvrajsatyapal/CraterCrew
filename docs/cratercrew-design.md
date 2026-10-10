# CraterCrew — proposed first-release spec

Status: approved for uninterrupted implementation by the user; first release implemented.

## Goal

Build an original browser artillery game inspired by Pocket Tanks, with satisfying destructible terrain, tactical weapons, quick matches, and usable mobile controls. Use free development tools and deployment free tiers. Original artwork, sounds, names, and balancing are required.

## Proposed release scope

- Two tanks per match; alternate turns; eliminate the opposing tank to win.
- Solo versus a bot, local two-player, and private online rooms with a shareable invitation.
- Seeded procedural hills, crater deformation, tanks settling after terrain changes, wind, angle and power aiming, and limited movement fuel.
- Six distinct weapons: basic shell, heavy shell, scatter volley, bouncing shell, terrain digger, and airburst. Basic shells are unlimited; special ammunition is limited equally for both players.
- A short trajectory hint helps initial aiming without revealing the full impact point.
- Ready lobby, visible turn owner, health, ammunition, wind, shot result, victory screen, and rematch.
- Mouse, keyboard, and touch input. Mobile landscape is preferred; portrait offers a usable layout and a rotate hint.
- Generated vector-style art, procedural effects, and synthesized audio keep downloads small. Sound and reduced-motion controls are available.

Public matchmaking, accounts, ranked ladders, purchases, and large weapon catalogs are later milestones.

## Architecture

TypeScript throughout. Vite serves a Phaser client; semantic HTML overlays provide menus and accessible controls. A renderer-independent shared rules package owns seeded terrain, fixed-step projectile simulation, collision, damage, ammunition, turn transitions, and victory conditions.

A Cloudflare Worker handles room creation and WebSocket upgrades. One SQLite-backed Durable Object owns each online match. Clients submit intent (angle, power, movement, weapon), never damage or trusted match state. The server validates player identity, turn ownership, numeric bounds, ammunition, and action sequence; it computes the entire bounded shot and broadcasts the authoritative result. Phaser animates that result locally.

Persist match snapshots and reconnect identities. Use the WebSocket Hibernation API, serialize connection metadata, and restore state after object eviction. Avoid a continuous server frame loop. Match revisions and action IDs prevent duplicate shots and stale updates. Limit message size, action frequency, room capacity, and room lifetime; restrict allowed browser origins.

Disconnects pause play for a bounded grace period before forfeiting. Turn deadlines use Durable Object alarms and persisted timestamps. Expired rooms clean up their stored state. Joining a full, expired, or started room produces a clear error. A reconnecting player receives a complete snapshot.

## Visual direction

An original moon-quarry arena: dark space, warm mineral terrain, cyan and orange tanks, readable HUD, restrained industrial typography, and impactful explosions. Prioritize the battlefield over menu decoration. The aim controls remain near the player's thumb on phones. Color is reinforced by player labels and icons.

## Optimization targets

- Cap rendering resolution and particle counts; pool effects and redraw terrain only when it changes.
- Fixed logical arena coordinates with responsive scaling.
- Lazy-load Phaser when entering play; avoid external image and font dependencies.
- Pause rendering when hidden; server state remains authoritative.
- Target 60 fps on desktop and 30 fps on representative midrange phones; measure before claiming achievement.
- Bound simulation steps, weapon fragments, and shot duration to protect Worker CPU budgets.
- Send match updates per action rather than continuously streaming projectile frames.

## Verification and acceptance

Use test-first development for seeded determinism, projectile collisions, terrain deformation, tank settling, damage, turn switching, invalid shots, win conditions, and duplicate-action rejection. Vitest verifies shared rules and room behavior. Playwright verifies solo play, local play, touch controls, two browser contexts joining an online room, authoritative turn enforcement, reconnect, and rematch against local Wrangler.

Release requires passing type checks, tests, production build, browser flows, and performance measurements. An online match must complete with both clients agreeing on terrain, health, turn, and winner. Offline play must function without a configured multiplayer endpoint. Controls must remain usable at desktop and mobile viewports.

## Delivery sequence

1. Shared rules and a playable solo/local vertical slice.
2. Private multiplayer with authoritative validation and reconnect handling.
3. Complete weapons, visual polish, mobile QA, performance measurement, and deployment configuration.

Each milestone gets a reviewed implementation plan. A design review precedes client implementation.

## Free deployment

Use Cloudflare Pages for static output and Workers plus SQLite-backed Durable Objects for online rooms. Free operation is conditional on usage quotas; unlimited free hosting is not promised. Provide Wrangler configuration, environment examples, local instructions, and deployment commands. Live deployment requires access to the user's Cloudflare account.

References checked on 2026-10-09:

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/pages/platform/limits/

## Accepted scope

The proposed differentiators are destructible tactical terrain, six useful weapons, fast rematches, mobile controls, and instant private online play. The proposed first release includes all three play modes. The user approved implementation in one pass. Implementation and checks are recorded in docs/verification.md.
