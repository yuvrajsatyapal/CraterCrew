import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveBooster(s: Simulation, id: ReferenceWeaponId) {
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
    case "booster-worm": {
      const start = own(),
        end = target();
      const points = Array.from({ length: 100 }, (_, i) => {
        const t = i / 99;
        return {
          x: start.x + (end.x - start.x) * t,
          y:
            start.y +
            (end.y - start.y) * t +
            Math.sin(t * Math.PI) * 90 -
            Math.sin(t * 3 * Math.PI) * 50,
        };
      });
      const index = s.directPath(points);
      for (let i = 1; i < points.length; i++)
        s.terrain(i, () =>
          line(s.world, points[i - 1], points[i], 18, MATERIAL.air),
        );
      s.effect("drill", points, 0, 99, 22);
      s.blast(end, 100, 45, 40, true, index);
      break;
    }
    case "spin-lasers": {
      for (let i = 0; i < 3; i++) {
        const f = s.flight({
          bounces: 2,
          angle: shot.angle + (i - 1) * 12,
          delay: i * 8,
        });
        for (const [j, p] of f.contacts.entries())
          s.beam(
            { x: p.x, y: p.y - 18 },
            target(),
            p.time,
            2,
            7,
            "beam",
            false,
          );
        s.effect(
          "robot",
          f.contacts.length ? f.contacts : [f.point],
          f.time,
          24,
          12,
        );
      }
      break;
    }
    case "mudrunner": {
      const from = own(),
        to = target(),
        under = { x: to.x, y: Math.min(590, to.y + 65) };
      s.terrain(0, () =>
        line(s.world, { x: from.x, y: from.y + 45 }, under, 15, MATERIAL.air),
      );
      s.effect("drill", [{ x: from.x, y: from.y + 45 }, under, to], 0, 55, 14);
      s.terrain(40, () => line(s.world, under, to, 22, MATERIAL.air));
      s.flow(to, 55, MATERIAL.water, 260, 55, 9);
      break;
    }
    case "grenade-towers": {
      const f = lob();
      for (const offset of [-50, 50])
        s.terrain(f.time, () =>
          rectangle(
            s.world,
            f.point.x + offset - 12,
            f.point.y - 105,
            24,
            110,
            MATERIAL.concrete,
          ),
        );
      for (let i = 0; i < 6; i++) {
        const f2 = s.flight({
          start: { x: f.point.x + (i % 2 ? 50 : -50), y: f.point.y - 115 },
          angle: direction > 0 ? 45 : 135,
          delay: f.time + 6 + i * 6,
          speed: 240,
          guided: true,
        });
        detonate(f2, 25, 13);
      }
      s.effect(
        "robot",
        [
          { x: f.point.x - 50, y: f.point.y - 110 },
          { x: f.point.x + 50, y: f.point.y - 110 },
        ],
        f.time,
        35,
        20,
      );
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
