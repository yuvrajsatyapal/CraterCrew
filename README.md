# CraterCrew

A browser artillery duel with a classic metallic console, layered green terrain, and visuals studied from the supplied Pocket Tanks video. Built with TypeScript, Phaser, Vite, Cloudflare Workers, SQLite Durable Objects, Vitest and Playwright.

## Play locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Solo and couch duels work immediately. Private online play also requires a second terminal:

```sh
npm run dev:worker
```

Create a room, copy its invitation, open it in another browser/profile, and ready both players. Player reconnect credentials are stored per room in session storage, so refreshing the same tab preserves your seat. An invitation opens the join form rather than joining without a callsign.

## Features

- Solo versus an aiming bot, pass-and-play local duels, private two-player online rooms.
- Before every match and rematch, draft 20 random special weapons in alternating turns: ten per tank, with a 15-second clock and automatic random picks on timeout. Solo Random visibly deals the remaining weapons one at a time to both tanks, then shows completed loadouts for 1.5 seconds before battle.
- Seeded terrain, wind, 85 playable weapons, persistent material terrain, fall damage and movement fuel.
- Six original weapons plus 79 unique weapons individually illustrated on the supplied BlitWise blog, each with its matching icon and reconstructed mechanics. Search the arsenal by name or filter by pack.
- Previous/next weapon buttons, inline angle/power adjustment, terrain-following movement and per-projectile impact/fall animation.
- Mouse, keyboard and responsive touch controls; optional synthesized sound and reduced effects.
- Victory, draws and rematches. Unlimited standard shells; three rounds of each drafted special weapon. Only your drafted weapons appear in your battle arsenal.
- Server-validated commands, revision checks, bounded shot simulation, persisted room state, WebSocket hibernation, 60-second turns, 30-second disconnect forfeits and two-hour room expiration.

Keyboard: left/right arrows change angle; up/down arrows change power; Space fires; A/D move. The field manual explains aiming and terrain tactics. Each tank starts with zero points. Play ten volleys each; the highest score wins. Angle 0 fires right, 90 up, and 180 left.

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts a production preview and local Wrangler server automatically. It uses two isolated browser contexts to verify online synchronization and reconnects. Screenshots and failure traces are written to ignored `test-results/`.

## Free-tier deployment

The source builds without paid services. Hosting can use Cloudflare's free tiers, subject to account quotas. A Cloudflare account is required; a custom domain is optional. No Cloudflare credentials belong in source control.

1. Authenticate using `npx wrangler login`.
2. In `wrangler.toml`, set `ALLOWED_ORIGINS` to the exact frontend origin, for example `https://cratercrew.pages.dev`. Use a comma-separated list to keep local origins if wanted. Arbitrary Pages preview domains are deliberately not allowed automatically.
3. Run `npm run deploy:worker`. Record the resulting `https://cratercrew-rooms.<account>.workers.dev` URL.
4. Create a Pages project named `cratercrew` using the dashboard or `npx wrangler pages project create cratercrew --production-branch main`.
5. Build and deploy with the Worker URL:

```sh
VITE_MULTIPLAYER_URL=https://cratercrew-rooms.YOUR_ACCOUNT.workers.dev npm run deploy:pages
```

If the Pages project name differs, change the deploy script and allowed origin to match. Verify `/health` on the Worker, then complete a private match in two browsers on the deployed frontend. Local verification does not substitute for this production smoke test.

For Git-connected Pages builds, set build command `npm run build`, output directory `dist`, and build environment variable `VITE_MULTIPLAYER_URL` to the Worker URL. Deploy the Worker separately when backend code changes. `.env.example` documents local configuration; it contains no secrets.

Static output is also hostable elsewhere. Without a multiplayer endpoint, solo and local play remain available and the online menu explains the missing service.

## Architecture

- `src/shared/game.ts`: deterministic rules, terrain, weapons, bot and bounded simulation. No Phaser dependency.
- `src/shared/reference-weapons.ts`: source inventory, pack membership, matching icons and locally chosen tuning.
- `src/shared/materials.ts`: bounded material grid, tunnels, overhangs, support and persistent defenses.
- `src/shared/weapon-engine.ts`, `weapon-packs/`, `weapon-timeline.ts`: deterministic weapon handlers, chronological terrain operations, tank motion and damage events.
- `src/shared/room.ts`: lobby, identity, readiness, authoritative actions, deadlines, reconnect and rematch rules.
- `worker/index.ts`: origin allowlist, room invitations, WebSockets, persistence, rate/size limits and alarms.
- `src/client/main.ts`: HTML menus, accessible controls, state and network transport.
- `src/client/arena.ts`: lazy-loaded Phaser scene, procedural drawing and projectile animation.
- `src/client/weapon-presentation.ts`: explicit sound and visual families for all 85 playable weapons.
- `src/client/sound.ts`: synchronized synthesized launch, impact and special-effect cues, bounded voices and immediate mute.

The server resolves a full shot and broadcasts its paths, timestamped effect/damage/terrain events and resulting state. Clients render that result rather than submitting trusted scores or terrain. Online animation lasts the authoritative shot duration; reduced-effects mode suppresses particles while retaining online timing. The scene draws terrain only on state changes, uses fixed logical dimensions, and runs no physics engine or per-frame network stream.

## Scope and limits

This is a first playable release, with private rooms rather than public matchmaking, accounts or ranked ladders. Free-tier capacity is finite; inspect usage before opening a public event. Per-socket limits protect room commands, but a large public launch also needs an account-level room-creation rate limiter/Turnstile policy.

The lazy Phaser chunk is roughly 334 KB compressed. The homepage loads the much smaller interface bundle before the engine. Desktop headless rendering is measured in the browser tests; physical midrange-phone performance still needs device testing. The server does not enforce billing quotas; use the free Cloudflare plan if avoiding usage charges is required.

The interface and battlefield use original SVG and procedural drawings; audio is synthesized. Weapon names and the 79 matching icon images come from the user-supplied [BlitWise developer blog](https://www.blitwise.com/mikes-dev-blog). Their source URLs and pack memberships are recorded in `docs/weapon-study/sources.json`. Weapon behavior and numerical tuning are reconstructed for this reverse-engineering learning project; this is not the complete original game's catalog or a recovery of its source code. See `docs/weapon-study/verification.md` for test evidence and coverage.

Cloudflare references: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

Weapon sound/animation reconstruction from the supplied [Pocket Tanks All Weapons recording](https://www.youtube.com/watch?v=CnYdKTtlbb8) is documented in [weapon-audiovisual-verification.md](docs/weapon-audiovisual-verification.md). The sounds are synthesized approximations; original waveforms and exact per-weapon animation timings have not been recovered.
