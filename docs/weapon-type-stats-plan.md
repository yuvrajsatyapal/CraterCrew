# Weapon-specific power and damage

Replace the shared current-power stat and placeholder catalog damage with explicit profiles covering every weapon. Suggested firing power varies by weapon role (shells, spreads, bouncers, drills, lobbed materials). Mark scripted attacks as automatic and fixed-speed projectiles as fixed; avoid assigning meaningless percentages. Suggestions are starting points, not guaranteed targeting solutions, and leave the player's chosen power editable.

Damage details must describe the existing resolver: per-projectile damage, pulse counts, utility/no direct damage, speed-dependent damage, or mixed/conditional attacks. Keep projectile and gameplay balance unchanged. UI: same compact amber stats, wrapping inside content-sized rows; a short explanation below the dialog title.

Sources reviewed: BlitWise's Pocket Tanks overview; Battery and Neutron Packs; Puzzle Pack; Twenty Pack. These establish weapon roles, auto-targeting, utility and damage behavior, but do not provide verified numeric damage tables. Numeric values come from this project's shared simulation, not claims about official Pocket Tanks balance. Suggested percentages are local recommendations based on weapon delivery type.

Plan: add failing profile coverage/mechanics regressions and update browser stats assertions; implement a typed 85-weapon profile catalog and integrate it into the picker; run unit suite, both TypeScript projects, build, and browser stats/containment/search checks at three sizes. Save a preview.

References:

- https://www.blitwise.com/pocket-tanks
- https://www.blitwise.com/mikes-dev-blog/battery-and-neutron-packs-released
- https://www.blitwise.com/mikes-dev-blog/new-weapons-puzzle-pack
- https://www.blitwise.com/mikes-dev-blog/twenty-pack

## Verification

- All 85 selectable weapons have explicit profiles. Utility, fixed-speed and automatic attacks are distinguished from suggested launch power.
- 246 unit tests across 18 files passed, including profile completeness, bounded/varied suggestions, no direct utility damage, and resolver-derived damage checks for six attack types.
- Both TypeScript projects and the production build passed. Changed files passed formatting checks.
- Three existing search/filter/icon browser checks passed at desktop, portrait and landscape sizes. The new browser stats check caught an old refresh handler replacing the recommendation labels with shared power; that handler was removed. All four final stats/row-containment browser checks then passed, including custom aim power remaining at 35% while recommendations stay weapon-specific.
- Inspected the updated mobile screenshot: `docs/previews/arsenal-details-repaired.png`.
- Suggestions are local role-based starting points; damage numbers describe this game's current mechanics. No official numeric balance table was verified, and gameplay balance was not changed.
