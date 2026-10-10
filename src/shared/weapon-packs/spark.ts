import { clamp, WIDTH, type Point } from "../game";
import {
  circle,
  rectangle,
  line,
  supportY,
  MATERIAL,
  WORLD_COLS,
  isSolid,
  type Material,
} from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveSpark(s: Simulation, id: ReferenceWeaponId) {
  const { shot, weapon: definition, player, before } = s;
  const enemy = s.opponent;
  const target = () => s.muzzle(enemy),
    own = () => s.muzzle(),
    direction = Math.sign(s.tank(enemy).x - s.tank().x) || 1;
  const lob = () => s.flight(),
    detonate = (
      f: ReturnType<Simulation["flight"]>,
      radius: number = definition.radius,
      damage: number = definition.damage,
    ) => s.blast(f.point, f.time, radius, damage, true, f.index);
  switch (id) {
    case "spark-storm": {
      const f = lob();
      for (let i = 0; i < 6; i++) {
        const start = {
          x: f.point.x + (i - 2.5) * 32,
          y: Math.max(20, f.point.y - 180),
        };
        const piece = s.flight({
          start,
          guided: true,
          speed: 190,
          delay: f.time + i * 6,
        });
        s.blast(piece.point, piece.time, 20, 10, true, piece.index);
        s.effect("spark", [piece.point], piece.time, 20, 22);
      }
      break;
    }
    case "laser-bots": {
      const from = own(),
        to = target();
      for (let i = 0; i < 3; i++) {
        const start = { x: from.x + (i - 1) * 35, y: from.y + 20 },
          end = { x: to.x + (i - 1) * 20, y: to.y + 10 };
        s.terrain(i * 10, () => line(s.world, start, end, 10, MATERIAL.air));
        s.effect("robot", [start, end], i * 10, 60, 13);
        s.beam(end, to, 60 + i * 10, 3, 6, "beam");
      }
      break;
    }
    case "lava-flow": {
      const f = lob();
      const deposited = s.flow(f.point, f.time, MATERIAL.lava, 320, 80, 8);
      s.terrain(f.time + 30, () => {
        const cooled: number[] = [];
        for (const i of deposited)
          if (
            s.world.cells[i] === MATERIAL.lava &&
            isSolid(s.world.cells[i + WORLD_COLS] as Material)
          )
            cooled.push(i);
        for (const i of cooled) s.world.cells[i] = MATERIAL.concrete;
      });
      break;
    }
    case "fix-it-foam": {
      const f = lob();
      s.flow(f.point, f.time, MATERIAL.foam, 170, 110, 0);
      for (const p of [0, 1] as const)
        if (Math.abs(s.tank(p).x - f.point.x) < 100)
          s.move(
            p,
            {
              x: s.tank(p).x,
              y: supportY(s.world, s.tank(p).x, f.point.y - 120),
            },
            f.time,
            28,
            10,
          );
      break;
    }
    case "gravity-grenade": {
      const f = lob();
      s.terrain(f.time, () => {
        circle(s.world, f.point.x, f.point.y, 105, MATERIAL.air);
        circle(s.world, f.point.x, f.point.y - 115, 42, MATERIAL.dirt);
      });
      for (const p of [0, 1] as const)
        if (Math.abs(s.tank(p).x - f.point.x) < 230)
          s.move(
            p,
            { x: f.point.x + (p ? 18 : -18), y: f.point.y - 160 },
            f.time,
            40,
            35,
            1,
          );
      s.effect(
        "portal",
        [{ x: f.point.x, y: f.point.y - 115 }],
        f.time,
        50,
        65,
      );
      s.blast({ x: f.point.x, y: f.point.y - 120 }, f.time + 40, 55, 35, false);
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
