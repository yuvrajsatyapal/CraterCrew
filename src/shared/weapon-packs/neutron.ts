import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveNeutron(s: Simulation, id: ReferenceWeaponId) {
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
    case "neutron-beam": {
      s.beam(own(), target(), 0, 7, 9, "beam", true);
      break;
    }
    case "zap-stix": {
      for (let i = 0; i < 3; i++) {
        const f = s.flight({
          bounces: 2,
          guided: true,
          speed: 300,
          delay: i * 10,
        });
        s.effect(
          "electric",
          f.contacts.length ? f.contacts : [f.point],
          f.time,
          30,
          20,
        );
        s.beam(
          { x: f.point.x, y: f.point.y - 15 },
          target(),
          f.time,
          3,
          7,
          "electric",
        );
      }
      break;
    }
    case "wrecker": {
      const origin = s.tank(enemy);
      for (let i = 0; i < 4; i++) {
        const x = origin.x + (i % 2 ? -90 : 90);
        s.move(
          enemy,
          { x, y: supportY(s.world, x, origin.y) },
          i * 25,
          25,
          45,
          0.5,
        );
        s.hit(enemy, 12, i * 25 + 24);
        s.effect("rope", [own(), s.muzzle(enemy)], i * 25, 25, 9);
      }
      break;
    }
    case "wiggle-worm": {
      const from = own(),
        to = target(),
        points = Array.from({ length: 120 }, (_, i) => {
          const t = i / 119;
          return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t + Math.sin(i * 0.22) * 28,
          };
        });
      const index = s.directPath(points);
      for (let i = 5; i < 120; i += 10) {
        s.terrain(i, () =>
          circle(s.world, points[i].x, points[i].y, 14, MATERIAL.air),
        );
      }
      s.effect(
        "drill",
        points.filter((_, i) => i % 8 === 0),
        0,
        120,
        14,
      );
      s.blast(to, 120, 36, 42, true, index);
      break;
    }
    case "six-shooter": {
      s.volley(6, { bounces: 1, speed: shot.power * 9 }, 2, 18, 18);
      break;
    }
    case "howitzer": {
      const f = s.flight({ guided: true, speed: shot.power * 8 });
      detonate(f, 50, 52);
      s.effect("steel", [f.point], f.time, 20, 35);
      break;
    }
    case "sandstone": {
      const f = lob();
      s.flow(f.point, f.time, MATERIAL.sand, 220, 70, 6);
      s.terrain(f.time + 30, () =>
        circle(s.world, f.point.x, f.point.y - 15, 34, MATERIAL.concrete),
      );
      break;
    }
    case "flying-wall": {
      const starts = own();
      for (let i = 0; i < 7; i++) {
        const f = s.flight({
          start: { x: starts.x, y: starts.y + (i - 3) * 16 },
          angle: shot.angle + (i - 3) * 3,
          speed: shot.power * 8,
          delay: 0,
        });
        detonate(f, 26, 16);
      }
      break;
    }
    case "reference-airburst": {
      const f = lob();
      const tick = Math.max(0, f.path.length - 8);
      const point = f.path[tick];
      f.path.splice(tick + 1);
      s.blast(point, tick, 100, 75, true, f.index);
      s.effect("electric", [point], tick, 28, 110);
      break;
    }
    case "flywheel": {
      const f = lob(),
        to = {
          x: f.point.x + direction * 220,
          y: Math.min(590, f.point.y + 20),
        };
      s.terrain(f.time, () => line(s.world, f.point, to, 28, MATERIAL.air));
      s.effect("steel", [f.point, to], f.time, 60, 30);
      for (let i = 0; i < 6; i++)
        s.blast(
          {
            x: f.point.x + ((to.x - f.point.x) * i) / 5,
            y: f.point.y + ((to.y - f.point.y) * i) / 5,
          },
          f.time + i * 8,
          35,
          10,
          false,
        );
      break;
    }
    case "backflip": {
      const f = lob();
      if (Math.hypot(f.point.x - target().x, f.point.y - target().y) < 250) {
        const t = s.tank(enemy),
          x = t.x - direction * 100;
        s.move(enemy, { x, y: supportY(s.world, x, t.y) }, f.time, 55, 160, -1);
        s.hit(enemy, 35, f.time + 55);
      }
      s.effect("wave", [f.point], f.time, 30, 45);
      break;
    }
    case "snow-cone": {
      const t = s.tank(enemy);
      s.terrain(0, () => {
        for (let i = 0; i < 12; i++)
          rectangle(
            s.world,
            t.x - 72 + i * 6,
            t.y - i * 6,
            144 - i * 12,
            6,
            MATERIAL.ice,
          );
      });
      s.effect("ice", [t], 0, 40, 80);
      break;
    }
    case "icicles": {
      for (let i = 0; i < 6; i++) {
        const f = s.flight({
          start: {
            x: target().x + (i - 2.5) * 25,
            y: Math.max(10, target().y - 190),
          },
          angle: 270,
          guided: true,
          speed: 320,
          delay: i * 6,
          pierce: true,
        });
        s.terrain(f.time, () =>
          line(s.world, f.path[0], f.point, 7, MATERIAL.air),
        );
        s.blast(target(), f.time, 20, 13, false, f.index);
        s.effect("ice", [f.point], f.time, 15, 22);
      }
      break;
    }
    case "bridge": {
      const t = s.tank(),
        x = clamp(t.x + direction * 230, 30, 1170),
        y = Math.max(90, Math.min(t.y, s.tank(enemy).y) - 35);
      s.terrain(0, () =>
        line(s.world, { x: t.x, y: t.y - 6 }, { x, y }, 9, MATERIAL.steel),
      );
      s.move(player, { x, y: y - 10 }, 8, 60, 0);
      s.effect("steel", [t, { x, y }], 0, 20, 12);
      break;
    }
    case "steamroller": {
      const t = s.tank(),
        x = clamp(t.x + direction * 320, 50, 1150);
      s.terrain(0, () => {
        line(
          s.world,
          { x: t.x, y: t.y - 8 },
          { x, y: t.y - 8 },
          35,
          MATERIAL.air,
        );
        circle(s.world, x + direction * 45, t.y - 25, 65, MATERIAL.dirt);
      });
      s.move(player, { x, y: supportY(s.world, x, t.y) }, 0, 70, 0);
      s.effect("steel", [t, { x, y: t.y }], 0, 70, 38);
      if (Math.abs(s.tank(enemy).x - x) < 150) s.hit(enemy, 55, 55);
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
