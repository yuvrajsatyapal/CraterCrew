# Gameplay and viewport revision

User-authorized corrections, based on four supplied Pocket Tanks screenshots. Keep original CraterCrew art and assets.

1. Replace health/elimination with points: zero initial points; score opponent blast/fall impact minus self impact; ten volleys per player (20 shots including timed-out turns). Highest score wins, equal scores draw; disconnect forfeits remain. Server owns scores and round end.
2. Remove the dotted aiming projection entirely. Retain actual moving shells and explosions.
3. Animate terrain deformation at impact and tank descent with gravity-like acceleration, a small landing bounce, and hull tilt following the terrain. Smooth deliberate movement too. Reduced effects keep transitions short and avoid bounce.
4. Give gameplay the available browser viewport. Measure the arena parent and explicitly resize Phaser so the entire logical battlefield stays visible; use an aspect-preserving inner canvas area. Desktop/landscape fits without vertical cropping; portrait places the battlefield above controls.
5. Match reference interaction: compact bottom strip for movement, weapon, Fire, Angle and Power. Angle/Power buttons open a dedicated bottom ruler with numeric readout, minus/plus fine adjustment and a confirmation button. Keep accessible real range inputs, mouse/keyboard/touch support, and original visual styling.
6. Test score/end rules, skip turns, transition interpolation, full canvas bounds at desktop/portrait/landscape, adjustment controls and complete score matches including online rematch. Run type checks, unit and browser tests, production build, independent review.
