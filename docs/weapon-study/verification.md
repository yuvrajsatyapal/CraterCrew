# Reference weapon study — verification

Date: 2026-10-10. Source: https://www.blitwise.com/mikes-dev-blog.
Video reference retained from the approved earlier study: https://www.youtube.com/watch?v=DdqD99IEi8s.

## Implemented coverage

- 79 unique individually illustrated weapons from the linked page, with the corresponding 79 local icon files (about 692KB total).
- Six existing weapons retained: 85 selectable weapons in total. Source Airburst has its own ID so it remains separate from the existing Moon Rain.
- Concrete appears in both Gamma and Booster, with one stable weapon and ammunition identity.
- All reference entries dispatch to explicit handlers organized by the eleven source packs. Defining behaviors include ropes/displacement, guidance and beams, digging, construction, materials, ricochets/wrapping, tank maneuvers, continuous hits and immediate counterfire.
- Search, pack filtering, keyboard navigation and a scrollable arsenal whose heading/search/close controls remain reachable.
- A 6px material grid supplements the legacy surface compatibility field. Tunnels, overhangs and floating structures survive JSON transport and subsequent shots. Fuel movement and visual driving use support in the tank's current pocket.
- Chronological terrain operations, timestamped projectile contacts and event-time tank poses determine collision scoring and presentation. Multi-hit numbers rise, stagger and fade; self-hits subtract points, counterfire credits its shooter, and falling scores start at landing.

## Verification evidence

- Registry and behavior tests were observed failing before implementation.
- 178 unit tests passed across 12 test files on the implementation, including one case for every source-listed weapon. Tests cover seeded replay, immutability, JSON serialization, bounded paths/timelines, ammunition, unique behavior outcomes, persistent material transitions, attacker credit and damage conservation.
- Both client and Worker TypeScript checks passed; Prettier formatting check passed.
- Production build passed. Vite still reports the existing large Phaser chunk warning; no build error.
- Browser checks already passed: desktop and both phone orientations; normal-motion progressive hit scoring; manual aiming after Reflex Missile; local victory/restart; online authority/reconnect/rematch; cancellation when leaving during a shot. Headless desktop rendering measured 37.2 FPS. All 79 reference weapons and all six original weapons completed browser animation checks. Concrete material/ammunition/scores and the subsequent legacy shot synchronized between two online players. 35 unique browser scenarios have passing results. The initial full run passed 32/34: the 45-second smoke budget expired and the final resize poll timed out under parallel load. Both passed in a one-worker follow-up (18.4s and 30.6s); the added online test passed in 33.1s. The smoke budget is now 90 seconds; resize code and assertions were unchanged. Arsenal preview: `docs/previews/reference-arsenal.png`.

## Review findings and fixes

A fresh Gate 3.5 reviewer found five temporal/support defects. Regression cases reproduced them before fixes: damage labels using eventual destinations; launch blast at a future landing point; electric/contact effects firing before arrival; projectiles seeing future excavation; and visual driving jumping onto an overhang roof.

The engine now queues damage intents and resolves them against event-time tank poses and materials, captures launch origin, carries actual contact times, applies terrain operations at effective timestamps, and animates driving using pocket support. An additional exact-cell regression catches early excavation being suppressed by a future patch. Terrain callbacks are replayable: capture stable geometry and avoid random draws, counters or external mutation inside callbacks. Matter Blaster measures consumed dirt separately.

The reviewer accepted all five fixes. Independent reviewer probes covered 1,580 mountain-terrain replay cases. Final-state replay, intermediate excavation timing, collision timing and popup-pose agreement are distinct checks; a passing final-state comparison alone does not prove chronology.

## Scope

Coverage is the unique named, illustrated entries on the supplied page, which is a set of expansion announcements. Pack totals and references to hundreds of other weapons do not identify the rest of the original catalog. The original simulation constants and full behavior are not recoverable from brief public descriptions alone; this implementation uses documented reconstructed mechanics and local tuning. No original source code or sound recordings were obtained. No deployment was performed.
