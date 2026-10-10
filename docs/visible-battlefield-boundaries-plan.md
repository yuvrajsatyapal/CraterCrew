# Visible battlefield boundaries

The prior side-gap repair draws decorative terrain beyond the 1200-unit
simulation. Projectiles terminate at those interior edges, making the scenery
look like playable terrain with invisible walls.

The whole screen width must represent the real battlefield. Map its horizontal
edges to the canvas edges and retain the existing vertical fit and extra sky.
This allows horizontal scaling on wide screens. Remove the decorative side
ground. Keep shared physics and multiplayer state independent of viewport size.

Plan: add failing wide/narrow camera mapping regressions, apply separate
horizontal and vertical camera scales, remove side scenery, then run all unit
tests, type checks, build, formatting, and a browser camera/shot check.

Verification: the camera regressions failed before the fix. All 263 unit tests
pass afterward, along with client/Worker type checks, build, formatting, and two
Chromium tests covering layout at ten viewport sizes and animated shot playback.
The 3396-pixel browser capture shows playable ground reaching both screen edges.
The build retains its existing Phaser bundle-size warning. No deployment made.
