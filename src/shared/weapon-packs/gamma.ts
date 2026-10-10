import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveGamma(s: Simulation, id: ReferenceWeaponId) {
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
    case "gamma-goo": {
      const f = lob();
      s.terrain(f.time, () =>
        circle(s.world, f.point.x, f.point.y, 55, MATERIAL.air),
      );
      s.flow(
        { x: f.point.x, y: f.point.y + 40 },
        f.time + 6,
        MATERIAL.goo,
        170,
        55,
        9,
      );
      break;
    }
    case "concrete": {
      const f = lob();
      s.terrain(f.time, () =>
        circle(s.world, f.point.x, f.point.y, 65, MATERIAL.air),
      );
      s.flow(
        { x: clamp(f.point.x + direction * 90, 60, 1140), y: f.point.y },
        f.time + 14,
        MATERIAL.concrete,
        150,
        85,
        6,
      );
      break;
    }
    case "barrier-be-gone": {
      const f = lob();
      s.terrain(f.time, () =>
        circle(
          s.world,
          f.point.x,
          f.point.y,
          130,
          MATERIAL.air,
          (m) => m !== MATERIAL.dirt && m !== MATERIAL.air,
        ),
      );
      s.effect("fire", [f.point], f.time, 40, 100);
      for (let i = 0; i < 5; i++)
        s.blast(f.point, f.time + i * 6, 65, 10, false);
      break;
    }
    case "strip-mine": {
      const f = lob();
      for (let i = 0; i < 5; i++) {
        s.terrain(f.time + i * 10, () =>
          rectangle(
            s.world,
            f.point.x - 125,
            f.point.y + i * 24,
            250,
            24,
            MATERIAL.air,
          ),
        );
        s.effect(
          "steel",
          [
            { x: f.point.x - 125, y: f.point.y + i * 24 },
            { x: f.point.x + 125, y: f.point.y + i * 24 },
          ],
          f.time + i * 10,
          12,
          20,
        );
        s.blast(
          { x: f.point.x, y: f.point.y + i * 24 },
          f.time + i * 10,
          75,
          7,
          false,
        );
      }
      break;
    }
    case "sand-blast": {
      const f = lob();
      for (let i = 0; i < 6; i++) {
        const p = {
          x: f.point.x + direction * i * 22,
          y: supportY(s.world, f.point.x + direction * i * 22, f.point.y),
        };
        s.blast(p, f.time + i * 7, 28, 7);
        s.effect(
          "wave",
          [p, { x: p.x + direction * 100, y: p.y }],
          f.time + i * 7,
          10,
          16,
        );
      }
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
