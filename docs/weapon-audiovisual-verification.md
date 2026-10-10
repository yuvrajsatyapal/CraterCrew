# Weapon sound and animation reconstruction

Reference: [Pocket Tanks All Weapons](https://www.youtube.com/watch?v=CnYdKTtlbb8), supplied by the user and opened in the browser on 2026-10-10.

The video was inspected visually. Its original audio waveforms and a complete weapon-by-weapon timestamp audit were not available. This change is an audiovisual reconstruction for the existing 85-weapon arsenal, not a verified one-to-one reproduction of all weapons in the recording. No original audio samples were extracted.

## Implementation

- src/client/weapon-presentation.ts explicitly assigns every playable weapon to an acoustic and visual family. TypeScript checks complete coverage. Radius tunes launch/impact pitch; authoritative event spacing gives multi-hit attacks their own rhythm.
- src/client/sound.ts synthesizes shell thumps, heavy booms, burst pops, bounce tones, drilling chatter, laser sweeps, electrical crackle, liquid pulses, fire noise, rising teleport tones, metallic impacts, earth rumble and rope snaps.
- Arena dispatches special-effect cues once when replay advances across their timestamp. Expired effects are silent after frame stalls. Cue duration uses the actual replay speed, including 5 ms local Reduced FX and 25 ms online/normal playback.
- Sixteen concurrent voices are allowed; older voices disconnect when the limit is reached. Nodes disconnect at completion. Sound off cancels existing voices immediately and suppresses subsequent cues.
- Reference drill impacts use excavation jets; burst weapons use fragment spokes and heavy weapons add smoke. Energy contacts stay compact; material/liquid impacts scatter matching particles. Single-point electricity and waves render visibly. Ropes sag and tighten during playback.
- Existing physics, damage, terrain and network messages are unchanged.

## Verification

- Nine focused audiovisual regressions were observed failing before their fixes and then passing.
- Full unit suite: 255 tests passed.
- TypeScript checks and production build passed. Vite reports its existing large Phaser chunk warning.
- Changed source and test files pass Prettier.
- Independent review found playback-speed and mute-transition bugs; both received regressions and fixes.
- Browser verification is in progress: native Web Audio launch/effect/mute behavior, all 79 reference weapon animations, three viewport sizes, and two-client online replay.

One overlapping Playwright run collided on trace artifacts; it was stopped and the affected suite restarted as one process. That was a test-output collision, not a game failure.
