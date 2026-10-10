# Reference animation invariants

- ShotResult includes the authoritative shot (angle, power, weapon). Receiving clients must render from that metadata, not their local aim selection.
- Capture animation speed at shot start. Changing reduced effects must not rewind projectile flight or crater timing.
- Each projectile collision opens its own crater. Reserve the terminal terrain-cache key for progress exactly 1; rounding into it early can leave cached terrain shallower than the authoritative ground.
- Falling tanks follow the currently revealed terrain with time-based acceleration. A later blast can remove newly settled ground and start another fall.
- Do not return control until impacts and tank settling finish. Do not allow firing during a drive animation.
- Draw turret and barrel in world coordinates from the shared launch pivot so slope rotation cannot move the apparent projectile origin.
- Phaser consumes canvas pointer defaults. Explicitly focus the battlefield on pointerdown so game keyboard shortcuts work after using a dialog.
