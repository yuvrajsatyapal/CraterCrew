# Reference weapons implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. User authorized implementation in one uninterrupted pass.

**Goal:** Make each unique weapon individually listed on the supplied blog playable with its matching icon and distinct mechanics, and refine score-number feedback.

**Architecture:** A data registry feeds the arsenal and deterministic shared weapon handlers. A bounded material grid supplements the legacy surface representation; explicit simulation events drive terrain, tank movement and scoring in Phaser and online rooms.

**Tech Stack:** TypeScript, Phaser, Vitest, Playwright, Vite, Cloudflare Worker.

**Spec:** docs/shell-expansion-design.md

## Global constraints

- Preserve six existing weapon IDs and existing local, practice and online modes.
- All source-listed unique weapons must be playable; no generic renamed-shell placeholders.
- Randomness is seeded, input state is immutable, simulation timelines are bounded and JSON serializable.
- Scores reconcile exactly, self damage subtracts points, falling scores happen at landing.
- Icons match source entries, descriptions describe reconstructed behavior, no claim of exact original constants.
- No deployment; this checkout is not a Git repository, so Git commit/worktree steps are inapplicable.

## Review focus

- Persistent material state must survive network round trips and subsequent shots.
- A miss at the edge must not cause an infinite attack or timeline.
- Large multi-hit attacks must not overflow the old seven-path cache or overlap score labels unreadably.
- Displaced tanks must animate at their correct positions and settle without hanging the turn.
- Search and pack filtering must preserve ammunition, keyboard access and mobile layout.

### Task 1: Inventory and registry

**Files:** scripts/reference-inventory.py, src/shared/reference-weapons.ts, public/weapons/*, docs/weapon-study/sources.json, tests/reference-weapons.test.ts.
**Interfaces:** registry exports REFERENCE_WEAPONS with id/name/packs/icon/source/mechanic/damage/radius/ammo. game.ts reexports combined WEAPONS and WeaponId.

- [x] Extract only ico_ images with adjacent names; deduplicate repeated names and preserve pack membership.
- [x] Write and run failing registry tests: unique IDs, complete unique icon inventory, Concrete in two packs, icons resolve locally.

```ts
expect(REFERENCE_WEAPONS.filter((w) => w.name === "Concrete")).toHaveLength(1);
expect(new Set(REFERENCE_WEAPONS.map((w) => w.id)).size).toBe(
  REFERENCE_WEAPONS.length,
);
```

- [x] Implement the registry and source asset manifest; fetch public icons, inspect samples, and rerun tests.

### Task 2: Material terrain

**Files:** src/shared/materials.ts, tests/materials.test.ts.
**Interfaces:** MaterialWorld is a flat JSON array on a 6px grid, createWorld(surface), getCell(world,x,y), circle(world,x,y,r,material), line(world,from,to,r,material), surfaceHeights(world), supportY(world,x,y). Materials have explicit collision/defense properties.

- [x] Write failing tests for enclosed tunnel, floating block, line excavation, support below an overhead block, source immutability and JSON round trip.

```ts
const world = createWorld(Array(1200).fill(300));
circle(world, 600, 400, 24, 0);
expect(getCell(world, 600, 400)).toBe(0);
expect(getCell(world, 600, 350)).not.toBe(0);
```

- [x] Run tests red, implement bounded cell operations and support queries, then run green.

### Task 3: Deterministic weapon mechanics and timeline

**Files:** src/shared/weapon-simulation.ts, src/shared/game.ts, src/shared/weapon-timeline.ts, tests/weapon-mechanics.test.ts, tests/game.test.ts, tests/room.test.ts.
**Interfaces:** simulateReference(before, player, shot, weapon) returns next state, paths, blasts, events, damage and duration. ShotResult optionally contains events; Match optionally contains material world. Each event has time and typed payload; game.ts performs common validation, ammo spending and turn advance.

- [x] Write failing behavior tests for every scoped weapon. Assert each defining mechanic (e.g. Rope displacement, beam terrain penetration, trench excavation, barrier material, return path, wrap, guided target, instant counterfire), deterministic replay, JSON serialization and conservation.

```ts
const r = fire(state, 0, { angle: 45, power: 60, weapon: "danger-rope" });
expect(r.events.some((e) => e.type === "tank")).toBe(true);
expect(r).toEqual(
  fire(state, 0, { angle: 45, power: 60, weapon: "danger-rope" }),
);
```

- [x] Run tests red, implement typed event builder and bounded mechanics by family, and adapt legacy shots when a world is present.
- [x] Verify each event amount totals result.damage, room lock covers timeline plus feedback, and subsequent shots preserve world state.

### Task 4: Arsenal, battlefield effects and score stream

**Files:** src/client/main.ts, src/client/style.css, src/client/weapon-art.ts, src/client/weapon-effects.ts, src/client/arena.ts, src/client/feedback.ts, src/client/reference-effects.ts, tests/feedback.test.ts, tests/e2e/reference-weapons.spec.ts.
**Interfaces:** existing selector IDs remain; events are rendered at shared simulation timestamps; score popup pose is supplied by event instead of reconstructed radial damage.

- [x] Write failing tests for event conservation, tank positions, popup visibility bounds, search/filter selection, every icon loaded, reduced-motion completion and online handoff.

```ts
expect(scoreEvents(before, result).reduce((n, e) => n + e.amount, 0)).toBe(
  result.damage[0] + result.damage[1],
);
```

- [x] Run red; implement scrollable search/filter arsenal and corresponding icons; render material terrain and distinct event effects; refine hit number rise, stagger and fade.
- [x] Run the targeted tests green; inspect desktop and mobile captures.

### Task 5: Integration and review

**Files:** docs/weapon-study/verification.md, docs/weapon-study/progress.md, README.md.

- [x] Run npm test, npm run typecheck, npm run build and npm run test:e2e. Inspect every failure, fix with regression tests and repeat covering checks.
- [x] Review the complete change with a fresh reviewer as required by executing-plans; address material findings.
- [x] Record actual icon/catalog count, tested mechanics, browser evidence and limitations; update documentation.
