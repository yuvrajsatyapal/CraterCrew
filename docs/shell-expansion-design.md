# Playable reference weapons and hit-number feedback

Date: 2026-10-10. Status: approved for uninterrupted implementation by the user; implemented. Verification is recorded in docs/weapon-study/verification.md.

## Requested outcome

For reverse-engineering study, add the weapons individually listed at https://www.blitwise.com/mikes-dev-blog with their corresponding weapon icons and distinct playable behavior. The user explicitly selected playable weapons rather than a names-and-icons catalog. Refine the numbers that appear above tanks when hits earn or subtract points.

The linked page is a collection of expansion announcements, not an established complete catalog of every Pocket Tanks weapon. Scope is every unique weapon individually identified on that page. Repeated entries belong to multiple packs but use one weapon identity. Additional weapons mentioned only as pack totals need another source before they can be specified.

Existing video reference recorded in this project: https://www.youtube.com/watch?v=DdqD99IEi8s. No new video attachment or URL arrived with this request. Use that reference unless the user supplies a replacement.

## Initial constraints

The game implements six weapon algorithms, six procedural icons, deterministic shared rules, and a Phaser client. Score popups already show individual collision amounts, rise and fade, and attribute fall damage separately.

Terrain currently stores one surface height per horizontal coordinate. It cannot represent enclosed tunnels, floating blocks, ceilings, liquids, or different terrain materials. Adding catalog entries alone cannot reproduce the requested weapons. Shot results currently describe projectile paths and radial blasts; ropes, continuous beams, tank movement, persistent barriers, and secondary attacks need an explicit simulation timeline.

## Proposed architecture

1. A source-linked weapon registry owns stable IDs, names, pack membership, icon assets, behavior handlers and tunable parameters. Preserve the existing six IDs for compatibility. Associate each reference weapon with the icon actually shown beside its entry; inspect image formats before deciding how to display them. Add accessible names and a local fallback when an image cannot load.
2. Shared simulation owns deterministic weapon effects. Use a bounded two-dimensional terrain/material grid for the new mechanics, with explicit collision and support queries. Seed all random behavior. Terrain drawing and tank settling consume the same representation; adapt the existing six weapons and room serialization together.
3. Each shot produces ordered, typed events for projectile motion, damage, terrain changes, tank displacement, material deposition and secondary attacks. Events include times and affected tank IDs. The client animates the event timeline; it does not recalculate damage from a visual explosion radius. Online turn duration derives from the complete timeline and its feedback tail.
4. Weapon handlers share primitives where appropriate but preserve the defining behavior of each weapon. Families include ballistic volleys and ricochets; drilling and excavation; beams and guided attacks; ropes and displacement; terrain construction and defenses; flowing materials; and tank maneuvers and reactive attacks. A different color or radius alone does not qualify as a distinct implementation.
5. Expand the existing arsenal with search and pack filters, keyboard selection, icons and ammunition state. Only implemented and verified weapons are selectable during intermediate development. Show behavior descriptions; avoid presenting invented damage constants as measurements from the original game.

## Hit-number animation

Emit a number at the affected tank's position for each actual damage event. Multiple hits create a readable upward stream with small horizontal staggering, an initial appearance accent and a fade near the end. Opponent hits add points; self-hits subtract points. Terrain damage creates no score number by itself. Fall numbers start at landing. Clamp labels into the battlefield so they remain visible near screen edges.

Displayed event amounts must sum exactly to the authoritative score change. Include continuous attacks and simultaneous hits. Reduced motion keeps labels readable with minimal travel and no bounce. Online and local animation must finish without delaying or skipping score reconciliation.

## Implementation order

1. Inventory unique named entries, pack membership and icon links; inspect the reference recording and record observable timing. Write a behavior checklist for each weapon, distinguishing observed behavior from chosen tuning.
2. Write failing tests for the terrain representation, material collision/support, event ordering, deterministic replay and room transport. Implement these foundations and migrate the six existing weapons without breaking local or online matches.
3. Implement weapons by mechanical family, with tests first for the defining behavior of every weapon. Integrate their icons and selector as each family becomes playable. Keep the source inventory as the completion checklist until every scoped entry is implemented.
4. Write failing feedback tests for event conservation, continuous attacks, self-hits, simultaneous hits and landing. Implement the hit-number refinement and event-driven rendering.
5. Run unit tests, both TypeScript checks, the production build and browser regressions. Exercise local, practice and online play; inspect the arsenal and damage feedback on desktop, portrait and landscape screens. Document final source coverage and observed differences.

## Acceptance and limits

Every unique individually listed weapon has its matching icon, a distinct functional handler and a verified defining mechanic. Repeated names do not create duplicate ammunition entries. No catalog-only placeholder is counted as completed gameplay. Network results are deterministic and bounded; all score feedback reconciles with simulation results. Existing controls, match lengths, ammunition validation and reduced-motion preferences continue to work.

The public descriptions and recording establish observable mechanics, not original source code or exact hidden constants. Implementations are reconstructions for learning; tune parameters explicitly and report unresolved differences. This design covers substantial work across multiple weapon families. No deployment is part of this request.
