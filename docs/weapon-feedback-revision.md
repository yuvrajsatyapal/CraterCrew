# Weapon controls and feedback revision

2026-10-09. Continuation of the approved reference visual revision, requested by the user for reverse-engineering study.

Reference observation: inspected the supplied YouTube recording at weapon selection, 0:58, 1:08 and around 2:30. It uses beveled gray-green console modules, black readouts, orange Fire, a red segmented power gauge, weapon icons and a stream of small white score numbers rising above a struck tank. Weapon effects differ. Exact sound waveforms and the entire original catalog are not established by these observations.

## Design and implementation

- Keep the battlefield and console proportions. Replace the visible native weapon dropdown with a metal weapon readout opening an in-game arsenal dialog. Show six existing weapons with illustrated icons, descriptions, damage/crater stats, selected state and available ammunition. Retain the hidden select as the existing state boundary; keyboard cycling remains available.
- Improve angle adjustment with a graduated semicircular dial and live barrel pointer, plus the accessible 0–180 range. Power uses a large segmented red bar and numeric display. Both keep fine-step controls, confirmation, bounds and touch access; use the existing console slot to preserve battlefield visibility.
- Render distinct shell, heavy, scatter, bounce, drill and airburst flight/impact signatures. Airburst draws its shared stem once and starts fragments at the split; bounce marks contacts; blast rings, smoke, fragments and drill jets differ per weapon.
- Build score events from each actual blast using the authoritative damage formula. Show small signed numbers rising from the affected tank at each collision; attribute the remaining fall damage at landing. Totals reconcile to the server result, including self-hit penalties. Scoreboard counts events while resolving and converges to authoritative state at turn handoff.
- Synthesized cannon noise plus a pitched low thump; weapon-specific impact noise and a short metallic tank-hit accent. Sound defaults on for new users, retains explicit mute preference, unlocks through user input, and plays firing for remote/bot shots at animation start.
- Test first: event timing/conservation, airburst split visibility, weapon chooser selection/no accidental fire, aiming panel interaction, audio preference, shot lockout. Then unit suite, type checks, build, browser regression and mobile/desktop visual inspection.

No original assets or audio samples are copied. Six implemented weapon algorithms remain the existing game rules; presentation is a studied approximation, not full catalog or pixel-exact replication.
