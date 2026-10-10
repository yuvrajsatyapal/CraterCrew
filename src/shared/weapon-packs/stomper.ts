import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveStomper(s: Simulation, id: ReferenceWeaponId) {
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
    case "stomper": {
      const f = lob(),
        from = s.tank();
      s.move(
        player,
        { x: f.point.x, y: supportY(s.world, f.point.x, f.point.y) },
        0,
        Math.min(100, f.time),
        120,
        2,
      );
      for (let i = 1; i <= 5; i++) {
        const t = i / 5,
          p = {
            x: from.x + (f.point.x - from.x) * t,
            y: supportY(s.world, from.x + (f.point.x - from.x) * t, from.y),
          };
        s.blast(p, Math.min(100, f.time) * t, 40, 14);
      }
      break;
    }
    case "dash": {
      const from = s.tank(),
        x = clamp(from.x + direction * 500, 24, 1176),
        y = supportY(s.world, x, from.y);
      s.move(player, { x, y }, 0, 70, 0);
      s.effect("wave", [from, { x, y }], 0, 70, 15);
      if (
        s.tank(enemy).x >= Math.min(from.x, x) &&
        s.tank(enemy).x <= Math.max(from.x, x)
      ) {
        s.hit(enemy, 50, 40);
        s.move(
          enemy,
          { x: s.tank(enemy).x + direction * 90, y: s.tank(enemy).y },
          40,
          20,
          35,
        );
      }
      break;
    }
    case "mineshaft": {
      const t = s.tank(enemy);
      s.terrain(0, () =>
        line(
          s.world,
          { x: t.x, y: 100 },
          { x: t.x, y: t.y + 85 },
          20,
          MATERIAL.air,
        ),
      );
      s.effect(
        "drill",
        [
          { x: t.x, y: 50 },
          { x: t.x, y: t.y + 85 },
        ],
        0,
        70,
        22,
      );
      s.blast(t, 65, 65, 55);
      break;
    }
    case "warp-missiles": {
      s.volley(5, { wrap: true, gravity: 100 }, 10, 28, 18);
      s.effect(
        "portal",
        [
          { x: 0, y: 250 },
          { x: WIDTH, y: 250 },
        ],
        0,
        80,
        35,
      );
      break;
    }
    case "bump-rockets": {
      const impacts = s.volley(5, { guided: true, speed: 280 }, 3, 26, 12);
      for (const [i, f] of impacts.entries()) {
        if (!s.reaches(enemy, f.point, f.time, 50)) continue;
        const t = s.tank(enemy);
        s.move(enemy, { x: t.x + direction * 25, y: t.y }, f.time, 18, 14);
        s.effect("wave", [f.point], f.time, 12, 22);
      }
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
