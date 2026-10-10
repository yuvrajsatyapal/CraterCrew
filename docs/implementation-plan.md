# CraterCrew implementation plan

Goal: an original playable browser artillery game with solo, local and private online play.
Spec: docs/cratercrew-design.md. Execution: native, uninterrupted, explicitly requested by user.

Architecture: shared deterministic TypeScript rules, Phaser rendering with HTML controls, Worker routing and a SQLite Durable Object per room. Cloudflare Pages hosts the Vite build.

1. Write Vitest rule tests first: seeded terrain, action validation, immutable shot results, deformation, ammunition, damage, turns, victory, bounded trajectories. Run red. Implement src/shared/game.ts, run green.
2. Write room-state tests first: identity, ready/start, stale actions, reconnect, forfeit, rematch. Implement src/shared/room.ts and worker/index.ts. Run tests and Worker type checks.
3. Build the client: src/client/main.ts owns menus, controls and transport; src/client/arena.ts owns Phaser rendering/animation; src/client/style.css owns responsive layout. Use moon-quarry visual direction, cyan/orange identification, keyboard/touch controls, reduced motion and sound toggles. No remote assets.
4. Write Playwright flows for solo/local and two online browser contexts with a local Wrangler server. Run against production Vite output, fix failures. Check portrait and landscape layouts.
5. Verify TypeScript, Vitest, production build and browser flows. Add deployment configuration, README and environment example. Record measured performance and any deployment limitations.

Review focus: malformed network input must fail safely; duplicate actions must not consume ammunition; eviction/reconnect must preserve turns; dead tanks must end the match; touch controls must not overflow portrait screens.
