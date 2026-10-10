import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveDanger(s: Simulation, id: ReferenceWeaponId) {
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
    case "danger-rope": {
      const f = lob();
      s.effect("rope", [f.point, target()], f.time, 36, 6);
      if (Math.hypot(f.point.x - target().x, f.point.y - target().y) < 220) {
        s.pull(enemy, f.point, f.time, 140);
        for (let i = 0; i < 5; i++) s.hit(enemy, 7, f.time + i * 6);
      }
      break;
    }
    case "upheaval": {
      const t = s.tank();
      s.terrain(0, () => line(s.world, t, { x: t.x, y: 80 }, 20, MATERIAL.air));
      s.move(player, { x: t.x, y: Math.max(100, t.y - 140) }, 0, 25);
      s.beam({ x: t.x, y: 80 }, target(), 26, 6, 7, "electric");
      break;
    }
    case "topsy-turvy": {
      const f = lob();
      s.terrain(f.time, () => {
        const cells = s.world.cells.slice();
        for (
          let x = Math.max(0, Math.floor((f.point.x - 90) / 6));
          x < Math.min(200, Math.ceil((f.point.x + 90) / 6));
          x++
        )
          for (let y = 40; y < 100; y++)
            s.world.cells[y * 200 + x] = cells[(139 - y) * 200 + x];
      });
      s.effect("tiles", [f.point], f.time, 35, 90);
      s.blast(f.point, f.time + 20, 25, 35, false);
      break;
    }
    case "displacer-beam": {
      const from = own(),
        to = target();
      s.beam(from, to, 1, 3, 9);
      s.move(
        enemy,
        { x: s.tank(enemy).x + direction * 130, y: s.tank(enemy).y },
        4,
        32,
        30,
      );
      break;
    }
    case "earthquake": {
      for (let i = 0; i < 5; i++) {
        const time = i * 12;
        s.effect(
          "wave",
          [
            { x: 0, y: 430 },
            { x: WIDTH, y: 430 },
          ],
          time,
          15,
          15,
        );
        for (const p of [0, 1] as const) {
          const t = s.tank(p);
          let x = t.x;
          for (const sign of [-1, 1])
            if (
              supportY(s.world, t.x + sign * 35, t.y) >
              supportY(s.world, x, t.y)
            )
              x = t.x + sign * 35;
          s.move(
            p,
            {
              x: x === t.x ? t.x + (i % 2 ? -1 : 1) * 12 : x,
              y: supportY(s.world, x, t.y),
            },
            time,
            12,
            18,
          );
          s.hit(p, 4, time + 12);
        }
      }
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
