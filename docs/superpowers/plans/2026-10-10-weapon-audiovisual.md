# Weapon audiovisual implementation plan

**Goal:** Reconstruct differentiated weapon sounds and animations for the existing playable arsenal, using the user's Pocket Tanks All Weapons video as the visual reference.

**Architecture:** A typed presentation registry selects acoustic and visual families. The existing authoritative replay dispatches special-effect audio once at event onset; launch and collision continue through existing callbacks. Synthesized audio uses bounded envelopes and a voice limit. No gameplay or network protocol changes.

**Tech stack:** TypeScript, Phaser, Web Audio, Vitest, Playwright.

## Scope and evidence

The user explicitly requests implementation for reverse-engineering study. Existing mechanics and plans already define the arsenal. The supplied video was opened and inspected visually; its compact projectile, expanding contact effects and individual weapon sequences inform presentation. Audio waveform access and a complete timestamp-by-timestamp audit are unavailable. This implementation is a reconstruction, not verified one-to-one reproduction. Original recordings are not copied.

## Acceptance criteria

- Every existing weapon has an explicit sound/visual family; beam, electric, water, fire, drill, teleport, metallic and explosive weapons have distinct signatures.
- Special effects play at their simulation event timestamp once, including attacks without explosion events. Skipped frames do not replay expired effects.
- Mute prevents audio creation. Browser audio remains optional; resource cleanup and a concurrent voice bound protect dense attacks.
- Single-point electricity and waves remain visible; lasers do not receive generic expanding fireballs. Reduced FX keeps useful static feedback.
- Preserve terrain, scoring, path continuity and online handoff.

## Tasks

- [ ] Add failing presentation/audio tests for coverage, different acoustic envelopes, duration bounds and replay dispatch once through skipped frames.
- [ ] Implement typed family registry, sound cue envelopes and bounded Web Audio playback; connect effect onset to Arena/main.
- [ ] Add failing rendering tests for single-point electricity/waves and beam impacts; implement corresponding effect animation improvements.
- [ ] Run targeted tests, full unit suite, typecheck, build and relevant browser regression. Record limitations and verification.

## Review focus

Dense simultaneous blasts must not create unbounded nodes. Expired cues must not sound after tab stalls. Mute preference must apply to effect callbacks. Single-point effects must visibly render. Reduced FX and remote replay must preserve authoritative timing.

This checkout has no Git repository; commit and worktree steps do not apply.
