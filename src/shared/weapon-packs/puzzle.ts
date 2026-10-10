import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolvePuzzle(s: Simulation, id: ReferenceWeaponId) {
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
    case "puzzle-box": {
      const f = lob();
      s.terrain(f.time, () => {
        for (let y = -2; y <= 2; y++)
          for (let x = -2; x <= 2; x++)
            if ((x + y) % 2 === 0)
              rectangle(
                s.world,
                f.point.x + x * 18,
                f.point.y + y * 18,
                16,
                16,
                MATERIAL.concrete,
              );
      });
      s.effect("tiles", [f.point], f.time, 40, 65);
      s.blast(f.point, f.time + 36, 85, 60);
      break;
    }
    case "bouncy-blocker": {
      const t = target();
      s.terrain(0, () =>
        circle(s.world, t.x - direction * 38, t.y, 42, MATERIAL.rubber),
      );
      s.effect("tiles", [{ x: t.x - direction * 38, y: t.y }], 0, 35, 45);
      break;
    }
    case "evac": {
      const from = s.tank(),
        x = 35 + s.rng() * (WIDTH - 70),
        y = supportY(s.world, x, 70);
      s.move(player, { x, y }, 0, 1, 0);
      s.effect("portal", [from, { x, y }], 0, 32, 45);
      break;
    }
    case "sticker-shock": {
      const f = s.flight({ guided: true, speed: 200 });
      if (!s.reaches(enemy, f.point, f.time)) {
        s.effect("electric", [f.point], f.time, 25, 20);
        break;
      }
      s.effect(
        "electric",
        [
          { x: target().x - 20, y: target().y },
          { x: target().x + 20, y: target().y },
          target(),
        ],
        f.time,
        50,
        25,
      );
      for (let i = 0; i < 5; i++) s.hit(enemy, 9, f.time + 20 + i * 4);
      s.terrain(f.time, () =>
        circle(s.world, target().x, target().y - 8, 14, MATERIAL.glue),
      );
      break;
    }
    case "barbed-wire": {
      const f = s.flight({ bounces: 2 });
      s.terrain(f.time, () =>
        line(
          s.world,
          { x: f.point.x - 70, y: f.point.y - 5 },
          { x: f.point.x + 70, y: f.point.y - 5 },
          8,
          MATERIAL.spikes,
        ),
      );
      s.effect(
        "rope",
        [
          { x: f.point.x - 70, y: f.point.y },
          { x: f.point.x + 70, y: f.point.y },
        ],
        f.time,
        45,
        18,
      );
      s.blast(f.point, f.time, 70, 28, false, f.index);
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
