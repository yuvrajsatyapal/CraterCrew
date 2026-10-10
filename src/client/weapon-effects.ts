import type Phaser from "phaser";
import {
  WEAPONS,
  WIDTH,
  clamp,
  type Blast,
  type Point,
  type WeaponId,
} from "../shared/game";
import { weaponPresentation } from "./weapon-presentation";
const tints: Partial<Record<WeaponId, number>> = {
  shell: 0xffbb70,
  heavy: 0xff6f35,
  scatter: 0xffe56d,
  bounce: 0xc999ef,
  digger: 0x90ce52,
  airburst: 0x83dceb,
};
type Graphics = Phaser.GameObjects.Graphics;
export function drawFlight(
  g: Graphics,
  path: Point[],
  elapsed: number,
  start: number,
  weapon: WeaponId,
  reduced: boolean,
) {
  const index = Math.min(path.length - 1, Math.floor(elapsed));
  const sample = path[index];
  const next = path[Math.min(path.length - 1, index + 1)];
  const fraction = clamp(elapsed - index, 0, 1);
  // Interpolate ordinary travel, but never cross a wrapped screen seam.
  const p =
    fraction === 0 || Math.abs(next.x - sample.x) > WIDTH / 2
      ? sample
      : {
          x: sample.x + (next.x - sample.x) * fraction,
          y: sample.y + (next.y - sample.y) * fraction,
        };
  const tint =
    tints[weapon] ??
    Number.parseInt(
      WEAPONS.find((w) => w.id === weapon)?.color?.slice(1) ?? "ffc35b",
      16,
    );
  const tail = weapon === "digger" ? 6 : weapon === "heavy" ? 10 : 20;
  const first = Math.max(start, index - tail);
  // Flight paths are physics samples, not visible tracer lines. Keep the
  // projectile compact; beams and ropes are separate weapon effect events.
  if (weapon === "bounce" && !reduced) {
    for (let n = first + 1; n < index; n++) {
      if (path[n].y > path[n - 1].y && path[n].y > path[n + 1].y) {
        g.lineStyle(1, tint, 0.6);
        g.strokeCircle(path[n].x, path[n].y, 4 + (index - n) * 0.8);
      }
    }
  }
  g.fillStyle(tint);
  if (weaponPresentation(weapon).family === "drill") {
    const previous = path[Math.max(start, index - 1)];
    const angle = Math.atan2(p.y - previous.y, p.x - previous.x);
    g.fillTriangle(
      p.x + Math.cos(angle) * 7,
      p.y + Math.sin(angle) * 7,
      p.x + Math.cos(angle + 2.4) * 5,
      p.y + Math.sin(angle + 2.4) * 5,
      p.x + Math.cos(angle - 2.4) * 5,
      p.y + Math.sin(angle - 2.4) * 5,
    );
  } else {
    g.fillCircle(
      p.x,
      p.y,
      weapon === "heavy"
        ? 5
        : weapon === "scatter" || weapon === "airburst"
          ? 2.5
          : 3,
    );
    g.fillStyle(0xffffff);
    g.fillCircle(p.x - 1, p.y - 1, 1.2);
  }
}
export function drawBlast(
  g: Graphics,
  blast: Blast,
  progress: number,
  weapon: WeaponId,
  seed: number,
  reduced: boolean,
) {
  const tint =
    tints[weapon] ??
    Number.parseInt(
      WEAPONS.find((w) => w.id === weapon)?.color?.slice(1) ?? "ffc35b",
      16,
    );
  const radius = blast.radius;
  const fade = 1 - progress;
  const expansion = Math.sin((progress * Math.PI) / 2);
  const family = weaponPresentation(weapon).family;
  // Energy contacts, splashes and material hits retain their own visual language.
  if (
    ["beam", "electric", "liquid", "portal", "metal", "earth", "rope"].includes(
      family,
    )
  ) {
    const contact = Math.min(18, radius * 0.3);
    const color =
      family === "beam"
        ? 0x91ddff
        : family === "electric"
          ? 0xa1f563
          : family === "liquid"
            ? tint
            : family === "portal"
              ? 0xd6a2ef
              : tint;
    g.fillStyle(color, fade);
    g.fillCircle(blast.x, blast.y, reduced ? 3 : Math.max(3, contact * fade));
    g.lineStyle(2, color, fade);
    g.strokeCircle(blast.x, blast.y, contact * expansion);
    if (!reduced)
      for (let n = 0; n < 10; n++) {
        const angle = n * 2.399 + seed;
        const distance = radius * progress * (0.3 + (n % 3) * 0.15);
        const x = blast.x + Math.cos(angle) * distance;
        const y =
          blast.y +
          Math.sin(angle) * distance -
          (family === "liquid" || family === "earth"
            ? Math.sin(progress * Math.PI) * 25
            : 0);
        if (family === "beam" || family === "electric")
          g.lineBetween(blast.x, blast.y, x, y);
        else {
          g.fillStyle(color, fade);
          g.fillCircle(x, y, family === "liquid" ? 3 : 1.5);
        }
      }
    return;
  }
  // The projectile disappears at collision: show contact immediately, before
  // the larger blast expands. Reduced motion keeps a small steady contact dot.
  if (progress < 0.18) {
    g.fillStyle(reduced ? tint : 0xfff1c9, (1 - progress / 0.18) * 0.9);
    g.fillCircle(blast.x, blast.y, reduced ? 3 : 3 + 5 * (1 - progress / 0.18));
  }
  if (family === "drill") {
    g.fillStyle(tint, fade * 0.7);
    g.fillTriangle(
      blast.x - 14 * fade,
      blast.y - radius * progress * 0.4,
      blast.x + 14 * fade,
      blast.y - radius * progress * 0.4,
      blast.x,
      blast.y + radius * expansion * 1.6,
    );
    g.lineStyle(2, 0xd7ef9a, fade);
    for (let n = 0; n < 4; n++)
      g.lineBetween(
        blast.x - 12 + n * 8,
        blast.y - progress * radius,
        blast.x + (n - 2) * 18 * progress,
        blast.y + radius * progress,
      );
  } else if (family === "burst") {
    g.lineStyle(2, tint, fade);
    for (let n = 0; n < 8; n++) {
      const angle = (n * Math.PI) / 4 + seed;
      g.lineBetween(
        blast.x + Math.cos(angle) * radius * progress * 0.3,
        blast.y + Math.sin(angle) * radius * progress * 0.3,
        blast.x + Math.cos(angle) * radius * expansion,
        blast.y + Math.sin(angle) * radius * expansion,
      );
    }
    g.fillStyle(0xffffff, fade);
    g.fillCircle(blast.x, blast.y, Math.max(1, 9 * fade));
  } else {
    g.fillStyle(progress < 0.12 ? 0xffffff : tint, fade * 0.8);
    g.fillCircle(blast.x, blast.y, radius * expansion);
    g.fillStyle(0xffe7a9, fade * 0.9);
    g.fillCircle(blast.x, blast.y, radius * expansion * 0.5);
    if (family === "heavy" && !reduced) {
      for (let n = 0; n < 5; n++) {
        g.fillStyle(0x646058, fade * 0.45);
        g.fillCircle(
          blast.x + Math.sin(n * 2 + seed) * radius * progress * 0.7,
          blast.y - radius * progress * (0.4 + n * 0.22),
          radius * (0.15 + progress * 0.22),
        );
      }
    }
  }
  g.lineStyle(family === "heavy" ? 4 : 2, tint, fade);
  g.strokeCircle(
    blast.x,
    blast.y,
    radius * expansion * (weapon === "bounce" ? 1.5 : 1.15),
  );
  if (weapon === "bounce") {
    g.lineStyle(1, 0xffffff, fade * 0.6);
    g.strokeCircle(blast.x, blast.y, radius * expansion * 0.75);
  }
  for (let n = 0; n < (reduced ? 0 : family === "heavy" ? 20 : 10); n++) {
    const angle = n * 2.399 + seed;
    const speed = radius * (0.7 + (n % 4) * 0.2);
    g.fillStyle(n % 3 === 0 ? 0x46972b : tint, fade);
    g.fillRect(
      blast.x + Math.cos(angle) * speed * progress,
      blast.y +
        Math.sin(angle) * speed * progress -
        progress * 48 +
        progress * progress * 65,
      Math.max(1, 3 * fade),
      Math.max(1, 2 * fade),
    );
  }
}
export function hitFlash(elapsed: number, time: number) {
  return clamp(1 - (elapsed - time) / 8, 0, 1);
}
