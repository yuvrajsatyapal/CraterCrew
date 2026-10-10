import { clamp, WIDTH, type Point } from "../game";
import {
  circle,
  rectangle,
  line,
  supportY,
  worldPatch,
  MATERIAL,
} from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveTurbo(s: Simulation, id: ReferenceWeaponId) {
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
    case "turbo-cannon": {
      for (let i = 0; i < 6; i++) s.beam(own(), target(), i * 5, 1, 8, "beam");
      s.events.push({
        type: "aim",
        time: 0,
        player,
        angle:
          (Math.atan2(own().y - target().y, target().x - own().x) * 180) /
          Math.PI,
      });
      break;
    }
    case "bombs-away": {
      const t = s.tank(),
        to = s.tank(enemy);
      s.move(player, { x: to.x + direction * 120, y: to.y }, 0, 90, 220);
      for (let i = 0; i < 5; i++) {
        const f = s.flight({
          start: {
            x: t.x + ((to.x - t.x) * (i + 1)) / 5,
            y: Math.max(20, t.y - 180),
          },
          angle: 270,
          speed: 80,
          delay: 10 + i * 12,
        });
        detonate(f, 30, 18);
      }
      break;
    }
    case "boring-missiles": {
      const t = s.tank();
      for (let i = 0; i < 5; i++) {
        const start = { x: t.x + (i - 2) * 26, y: Math.min(590, t.y + 60) },
          exit = { x: start.x, y: t.y - 30 };
        s.terrain(i * 7, () => line(s.world, start, exit, 9, MATERIAL.air));
        s.effect("drill", [start, exit], i * 7, 18, 12);
        const f = s.flight({
          start: exit,
          guided: true,
          speed: 300,
          delay: 20 + i * 7,
        });
        detonate(f, 28, 15);
      }
      break;
    }
    case "crash-dive": {
      const t = s.tank();
      s.volley(3, {}, 5, 30, 22);
      s.terrain(6, () => circle(s.world, t.x, t.y + 80, 65, MATERIAL.air));
      s.move(player, { x: t.x, y: Math.min(590, t.y + 65) }, 6, 28, 0, 0.25);
      break;
    }
    case "matter-blaster": {
      const t = s.tank();
      const sample = { cells: s.world.cells.slice() };
      circle(sample, t.x, t.y, 90, MATERIAL.air, (m) => m === MATERIAL.dirt);
      const dirt = worldPatch(s.world, sample).length;
      s.terrain(0, () =>
        circle(s.world, t.x, t.y, 90, MATERIAL.air, (m) => m === MATERIAL.dirt),
      );
      const f = s.flight({ delay: 15 });
      detonate(f, 45 + Math.min(60, dirt / 8), 20 + Math.min(80, dirt / 4));
      s.effect("portal", [own()], 0, 18, 70);
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
