# Weapon picker power and damage

Add a compact stats line below each weapon's pack label, preserving the existing metal design and content-sized rows. Show current shot Power as a percentage (shared firing setting), and Base damage from the weapon definition. Keep pack labels separate. Explain that actual damage varies by hits and special effects rather than presenting the configured value as a guaranteed total. Update power when aiming changes. Do not change weapon physics.

Acceptance: all 85 weapons have labeled stats; Standard shows base damage 34 and default power 60%; changing power to 35% updates the picker; descriptions, packs and stats remain contained at desktop, portrait and landscape widths. Utility values are shown as zero rather than invented damage.

Plan: add browser regression first and run red; implement markup, updates and compact stats style; build/typecheck and run new regression plus existing row containment checks.

Verification: the new stats regression failed before implementation (no stat fields), then passed after implementation. Four browser checks passed, including containment at all three sizes and a power change from 60% to 35%. Both TypeScript projects and production build passed. Updated mobile preview is in `docs/previews/arsenal-details-repaired.png`.
