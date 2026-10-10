import type Phaser from "phaser";
import {
  CELL,
  WORLD_COLS,
  WORLD_ROWS,
  MATERIAL_COLORS,
  type MaterialWorld,
} from "../shared/materials";
import type { WeaponEvent } from "../shared/weapon-timeline";
type Graphics = Phaser.GameObjects.Graphics;
export function drawMaterialWorld(g: Graphics, world: MaterialWorld) {
  g.clear();
  const dirtSurface =
    world.dirtSurface ??
    Array.from({ length: WORLD_COLS }, (_, col) => {
      let row = 0;
      while (row < WORLD_ROWS && world.cells[row * WORLD_COLS + col] !== 1)
        row++;
      return row;
    });
  const tintAt = (row: number, col: number, material: number) => {
    if (material !== 1) return MATERIAL_COLORS[material] ?? MATERIAL_COLORS[1];
    const depth = row - dirtSurface[col];
    return depth === 0
      ? 0x70b53a
      : depth < 8
        ? 0x46972b
        : depth < 12
          ? 0x3c8525
          : depth < 20
            ? 0x327321
            : depth < 32
              ? 0x28621b
              : depth < 48
                ? 0x204f16
                : 0x173e10;
  };
  for (let row = 0; row < WORLD_ROWS; row++) {
    let x = 0;
    while (x < WORLD_COLS) {
      const m = world.cells[row * WORLD_COLS + x],
        begin = x,
        tint = tintAt(row, x, m);
      while (
        x < WORLD_COLS &&
        world.cells[row * WORLD_COLS + x] === m &&
        tintAt(row, x, m) === tint
      )
        x++;
      if (!m) continue;
      g.fillStyle(tint, m === 8 ? 0.65 : 1);
      g.fillRect(begin * CELL, row * CELL, (x - begin) * CELL, CELL);
    }
  }
  // Grain is anchored to world coordinates, so replay and excavation never
  // shuffle it. Every chip is contained inside an occupied collision cell.
  for (let row = 0; row < WORLD_ROWS; row++)
    for (let col = 0; col < WORLD_COLS; col++) {
      if (world.cells[row * WORLD_COLS + col] !== 1) continue;
      const hash = ((col * 73856093) ^ (row * 19349663)) >>> 0;
      if (hash % 3 !== 0) continue;
      const tint = tintAt(row, col, 1);
      g.fillStyle(tint + (hash % 2 ? 0x080b04 : -0x060803));
      g.fillRect(
        col * CELL + ((hash >>> 8) % 3) * 2,
        row * CELL + ((hash >>> 4) % 3) * 2,
        2,
        2,
      );
    }
}
export function drawReferenceEffects(
  g: Graphics,
  events: WeaponEvent[],
  elapsed: number,
  reduced: boolean,
) {
  for (const event of events) {
    if (event.type !== "effect") continue;
    const age = elapsed - event.time,
      t = age / event.duration;
    if (t < 0 || t >= 1 || !event.points.length) continue;
    let points = event.points;
    // Multi-point travel effects reveal their route with the projectile.
    // A two-point attack beam is instantaneous by design.
    if (
      event.kind === "drill" ||
      (event.kind === "beam" && points.length > 2)
    ) {
      const position = t * (points.length - 1),
        index = Math.floor(position),
        fraction = position - index,
        from = points[index],
        to = points[Math.min(points.length - 1, index + 1)];
      points = points.slice(0, index + 1).concat({
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
      });
    }
    const first = points[0],
      last = points.at(-1)!,
      fade = Math.min(1, (1 - t) * 3);
    // Contact electricity often has one point, so a polyline alone is invisible.
    if (event.kind === "electric" && points.length === 1) {
      g.lineStyle(2, 0xa1f563, fade);
      g.strokeCircle(
        first.x,
        first.y,
        event.size * (reduced ? 0.45 : 0.25 + t * 0.7),
      );
      g.fillStyle(0xf1ffd0, fade);
      g.fillCircle(first.x, first.y, 3);
      if (!reduced)
        for (let n = 0; n < 10; n++) {
          const angle = (n * Math.PI) / 5;
          const radius = event.size * (0.4 + 0.2 * Math.sin(age * 1.3 + n));
          g.lineBetween(
            first.x,
            first.y,
            first.x + Math.cos(angle) * radius,
            first.y + Math.sin(angle) * radius,
          );
        }
      continue;
    }
    if (
      event.kind === "beam" ||
      event.kind === "electric" ||
      event.kind === "rope" ||
      event.kind === "drill" ||
      event.kind === "counterfire"
    ) {
      const tint =
        event.kind === "electric"
          ? 0xa1f563
          : event.kind === "rope"
            ? 0xe9a054
            : event.kind === "drill"
              ? 0xb9cf72
              : event.kind === "counterfire"
                ? 0xff804d
                : 0x91ddff;
      g.lineStyle(event.kind === "beam" ? 5 : 2, tint, fade);
      g.beginPath();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i === 0) g.moveTo(p.x, p.y);
        else if (event.kind === "electric" && !reduced) {
          const previous = points[i - 1];
          for (let n = 1; n <= 12; n++)
            g.lineTo(
              previous.x + ((p.x - previous.x) * n) / 12,
              previous.y +
                ((p.y - previous.y) * n) / 12 +
                (n < 12 ? Math.sin(age * 2 + n * 7) * 7 : 0),
            );
        } else if (event.kind === "rope" && !reduced) {
          const previous = points[i - 1];
          for (let n = 1; n <= 16; n++) {
            const fraction = n / 16;
            g.lineTo(
              previous.x + (p.x - previous.x) * fraction,
              previous.y +
                (p.y - previous.y) * fraction +
                Math.sin(fraction * Math.PI) * event.size * (1 - t),
            );
          }
        } else g.lineTo(p.x, p.y);
      }
      g.strokePath();
      if (event.kind === "beam") {
        g.lineStyle(1, 0xffffff, fade);
        g.beginPath();
        g.moveTo(first.x, first.y);
        for (const point of points.slice(1)) g.lineTo(point.x, point.y);
        g.strokePath();
      }
      if (event.kind === "drill") {
        g.fillStyle(0xe4cf6b, fade);
        g.fillCircle(last.x, last.y, event.size * 0.5);
      }
    } else if (event.kind === "wave") {
      g.lineStyle(3, 0x84cbd4, fade);
      if (points.length === 1) {
        for (let n = 0; n < (reduced ? 1 : 3); n++) {
          g.strokeCircle(
            first.x,
            first.y,
            event.size * (reduced ? 0.45 : (t + n / 3) % 1),
          );
        }
        continue;
      }
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const x = first.x + ((last.x - first.x) * i) / 30,
          y =
            first.y +
            ((last.y - first.y) * i) / 30 +
            (reduced ? 0 : Math.sin(i + age * 0.4) * event.size * 0.3);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    } else if (event.kind === "portal") {
      g.lineStyle(3, 0xd6a2ef, fade);
      for (const p of points) {
        g.strokeCircle(
          p.x,
          p.y,
          event.size * (0.3 + Math.sin(t * Math.PI) * 0.7),
        );
        g.strokeCircle(p.x, p.y, event.size * (0.2 + t * 0.4));
      }
    } else if (event.kind === "robot" || event.kind === "duck") {
      const p = {
        x: first.x + (last.x - first.x) * t,
        y: first.y + (last.y - first.y) * t,
      };
      g.fillStyle(event.kind === "duck" ? 0xffdf52 : 0x95b3c1, fade);
      g.fillCircle(p.x, p.y, event.size * 0.55);
      g.fillRect(
        p.x - event.size * 0.8,
        p.y,
        event.size * 1.6,
        event.size * 0.4,
      );
      g.fillStyle(event.kind === "duck" ? 0xed863c : 0xff654c, fade);
      g.fillRect(p.x + event.size * 0.2, p.y - 4, event.size * 0.6, 4);
    } else if (event.kind === "tiles") {
      for (let x = -2; x <= 2; x++)
        for (let y = -2; y <= 2; y++) {
          g.fillStyle(
            [0xeba853, 0x8dc864, 0xc799e1, 0x70d2e7][Math.abs(x + y) % 4],
            fade,
          );
          g.fillRect(
            first.x + (x * event.size) / 3,
            first.y + (y * event.size) / 3,
            event.size / 4,
            event.size / 4,
          );
        }
    } else if (event.kind === "coin") {
      g.fillStyle(event.size > 25 ? 0xffdc5c : 0xaec1ce, fade);
      g.fillEllipse(
        first.x,
        first.y - 18 * Math.sin(t * Math.PI),
        Math.max(3, Math.abs(Math.cos(t * 8 * Math.PI)) * event.size),
        event.size,
      );
      g.lineStyle(2, 0xffffff, fade);
      g.strokeCircle(first.x, first.y, event.size * 0.3);
    } else if (event.kind === "steel" || event.kind === "ice") {
      g.lineStyle(
        event.kind === "steel" ? 4 : 2,
        event.kind === "ice" ? 0xc0f4ff : 0xd0d4df,
        fade,
      );
      for (const p of points) {
        g.lineBetween(
          p.x - event.size / 2,
          p.y + event.size / 2,
          p.x + event.size / 2,
          p.y - event.size / 2,
        );
        g.strokeCircle(p.x, p.y, event.size * (0.3 + t * 0.5));
      }
    } else {
      for (const p of points) {
        g.fillStyle(event.kind === "spark" ? 0xdeff64 : 0xff9141, fade * 0.7);
        g.fillCircle(p.x, p.y, event.size * Math.sin(t * Math.PI));
        if (!reduced)
          for (let n = 0; n < 8; n++) {
            const angle = (n * Math.PI) / 4 + age * 0.08;
            g.fillStyle(n % 2 ? 0xffd55c : 0xffffff, fade);
            g.fillCircle(
              p.x + Math.cos(angle) * event.size * t,
              p.y + Math.sin(angle) * event.size * t - age * 0.5,
              2,
            );
          }
      }
    }
  }
}
