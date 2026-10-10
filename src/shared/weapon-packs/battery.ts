import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveBattery(s: Simulation, id: ReferenceWeaponId) {
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
    case "battery": {
      const f = s.flight({ bounces: 3 });
      for (const [i, p] of f.contacts.entries())
        s.beam(
          { x: p.x, y: p.y - 18 },
          target(),
          p.time,
          2,
          8,
          "electric",
          false,
        );
      s.blast(f.point, f.time, 30, 20, false, f.index);
      s.effect("electric", [f.point], f.time, 25, 30);
      break;
    }
    case "knockback": {
      const impacts = s.volley(6, { guided: true, speed: 350 }, 1, 23, 12);
      for (const f of impacts) {
        if (!s.reaches(enemy, f.point, f.time, 47)) continue;
        const t = s.tank(enemy);
        s.terrain(f.time, () =>
          rectangle(s.world, t.x - 22, t.y, 44, 18, MATERIAL.air),
        );
        s.move(enemy, { x: t.x, y: Math.min(610, t.y + 12) }, f.time, 10);
        s.hit(enemy, 3, f.time + 10, "fall");
      }
      break;
    }
    case "electric-putty": {
      for (let i = 0; i < 4; i++) {
        const f = s.flight({ angle: shot.angle + (i - 1.5) * 7, delay: i * 6 });
        s.terrain(f.time, () =>
          rectangle(
            s.world,
            f.point.x - 14,
            f.point.y - 18,
            28,
            28,
            MATERIAL.glue,
          ),
        );
        s.effect("electric", [f.point], f.time, 25, 30);
        s.blast(f.point, f.time, 35, 16, false, f.index);
      }
      break;
    }
    case "sparkatron": {
      const f = s.flight({ gravity: 180, bounces: 6, speed: shot.power * 10 });
      for (const [i, p] of f.contacts.entries()) {
        s.effect("spark", [p], p.time, 20, 22);
        s.blast(p, p.time, 28, 9, false);
      }
      detonate(f, 36, 25);
      break;
    }
    case "rampart": {
      const t = s.tank(),
        x = t.x + direction * 30;
      s.terrain(0, () =>
        rectangle(s.world, x - 25, t.y - 115, 50, 120, MATERIAL.concrete),
      );
      s.move(player, { x, y: t.y - 116 }, 0, 30, 15);
      const f = s.flight({
        start: { x, y: t.y - 140 },
        guided: true,
        speed: 260,
        delay: 32,
      });
      detonate(f, 35, 35);
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
