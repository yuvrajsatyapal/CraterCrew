import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveChasm(s: Simulation, id: ReferenceWeaponId) {
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
    case "chasm": {
      const f = lob();
      s.terrain(f.time, () => {
        circle(s.world, f.point.x, f.point.y + 80, 90, MATERIAL.air);
        line(
          s.world,
          f.point,
          { x: f.point.x, y: f.point.y + 120 },
          20,
          MATERIAL.air,
        );
      });
      if (Math.abs(s.tank(enemy).x - f.point.x) < 240)
        s.pull(
          enemy,
          { x: f.point.x, y: f.point.y + 100 },
          f.time + 8,
          Math.min(200, Math.abs(s.tank(enemy).x - f.point.x)),
          0,
        );
      s.effect(
        "wave",
        [
          { x: f.point.x - 90, y: f.point.y },
          { x: f.point.x + 90, y: f.point.y },
        ],
        f.time,
        35,
        80,
      );
      break;
    }
    case "bungee-bomb": {
      const f = lob();
      if (Math.hypot(f.point.x - target().x, f.point.y - target().y) < 260)
        for (let i = 0; i < 3; i++) {
          s.effect("rope", [f.point, target()], f.time + i * 30, 30, 7);
          const t = s.tank(enemy),
            x = t.x + (i % 2 ? -1 : 1) * 70;
          s.move(
            enemy,
            { x, y: supportY(s.world, x, t.y) },
            f.time + i * 30,
            28,
            100,
            1,
          );
          s.hit(enemy, 14, f.time + i * 30 + 28);
        }
      break;
    }
    case "nail-gun": {
      for (let i = 0; i < 6; i++) {
        const f = s.flight({
          pierce: true,
          gravity: 80,
          angle: shot.angle + (i - 2.5) * 1.5,
          delay: i * 4,
        });
        for (let tick = 0; tick < f.path.length; tick += 8) {
          const point = f.path[tick];
          s.terrain(i * 4 + tick, () =>
            circle(s.world, point.x, point.y, 7, MATERIAL.air),
          );
        }
        for (const p of [0, 1] as const) {
          const tick = f.path.findIndex((point, tick) => {
            const tank = s.poseAt(p, i * 4 + tick);
            return Math.hypot(point.x - tank.x, point.y - (tank.y - 14)) < 22;
          });
          if (tick >= 0) s.hit(p, 16, i * 4 + tick);
        }
        s.effect("steel", [f.path[0], f.point], i * 4, Math.min(80, f.time), 5);
      }
      break;
    }
    case "fling": {
      const f = lob(),
        t = s.tank(enemy);
      if (Math.hypot(f.point.x - t.x, f.point.y - t.y) < 200) {
        const prev = f.path.at(-2)!;
        const sign = Math.sign(f.point.x - prev.x) || direction;
        s.move(
          enemy,
          { x: t.x + sign * clamp(f.speed * 0.65, 60, 240), y: t.y },
          f.time,
          45,
          clamp(f.speed * 0.3, 40, 140),
        );
        s.hit(enemy, Math.round(f.speed / 15), f.time + 45);
      }
      break;
    }
    case "hover-blocks": {
      const f = lob();
      s.terrain(f.time, () => {
        for (let i = 0; i < 7; i++)
          rectangle(
            s.world,
            f.point.x + (i - 3) * 24,
            f.point.y - 90 - Math.abs(i - 3) * 12,
            22,
            22,
            MATERIAL.foam,
          );
      });
      s.effect("tiles", [f.point], f.time, 30, 70);
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
