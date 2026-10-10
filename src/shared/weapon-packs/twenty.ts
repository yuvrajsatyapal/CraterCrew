import { clamp, WIDTH, type Point } from "../game";
import { circle, rectangle, line, supportY, MATERIAL } from "../materials";
import type { ReferenceWeaponId } from "../reference-weapons";
import type { Simulation } from "../weapon-engine";
export function resolveTwenty(s: Simulation, id: ReferenceWeaponId) {
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
    case "bungee-punch": {
      const f = lob();
      detonate(f, 35, 30);
      s.effect("rope", [own(), f.point], 0, f.time, 6);
      if (Math.hypot(f.point.x - target().x, f.point.y - target().y) > 55) {
        const returned = s.flight({
          start: f.point,
          target: target(),
          guided: true,
          speed: 320,
          delay: f.time + 12,
        });
        s.effect(
          "rope",
          [f.point, own(), target()],
          f.time,
          returned.time - f.time,
          7,
        );
        detonate(returned, 45, 35);
      }
      break;
    }
    case "sticks-and-stones": {
      for (let i = 0; i < 3; i++) {
        const f = s.flight({
          bounces: 2,
          angle: shot.angle + (i - 1) * 10,
          delay: i * 8,
        });
        detonate(f, 35, 17);
        s.effect("steel", [f.point], f.time, 25, 22);
      }
      for (let i = 0; i < 3; i++) {
        const f = s.flight({
          angle: shot.angle + (i - 1) * 4,
          delay: 15 + i * 8,
        });
        s.blast(f.point, f.time + 30, 45, 24, true, f.index);
      }
      break;
    }
    case "coin-toss": {
      const f = lob(),
        gold = s.rng() >= 0.5;
      s.effect("coin", [f.point], f.time, 26, gold ? 36 : 18);
      detonate(f, 45, gold ? 90 : 30);
      break;
    }
    case "bombardment": {
      for (let i = 0; i < 6; i++) {
        const f = s.flight({
          start: { x: i % 2 ? WIDTH - 10 : 10, y: 30 + i * 20 },
          guided: true,
          speed: 390,
          delay: i * 10,
        });
        detonate(f, 35, 18);
      }
      break;
    }
    case "trench": {
      const f = lob(),
        from = s.tank();
      s.terrain(f.time, () =>
        rectangle(
          s.world,
          Math.min(from.x, f.point.x),
          Math.min(from.y, f.point.y) - 6,
          Math.max(60, Math.abs(f.point.x - from.x)),
          140,
          MATERIAL.air,
        ),
      );
      s.effect(
        "drill",
        [from, { x: f.point.x, y: f.point.y + 140 }],
        f.time,
        35,
        30,
      );
      break;
    }
    case "rebound-lasers": {
      const f = s.flight({ gravity: 0, bounces: 7, speed: 600 });
      for (let i = 1; i < f.path.length; i += 12)
        s.beam(
          f.path[i - 1],
          f.path[Math.min(f.path.length - 1, i + 12)],
          i,
          1,
          12,
          "beam",
          true,
        );
      s.effect(
        "beam",
        f.path.filter((_, i) => i % 10 === 0),
        0,
        Math.min(560, f.time),
        3,
      );
      break;
    }
    case "ricochet-rifle": {
      const f = s.flight({ gravity: 0, bounces: 12, speed: 900 });
      for (const p of [0, 1] as const) {
        const hits = f.path.filter(
          (q) => Math.hypot(q.x - s.tank(p).x, q.y - s.tank(p).y + 18) < 20,
        ).length;
        if (hits) s.hit(p, Math.min(90, hits * 15), f.time);
      }
      s.effect("steel", f.contacts, 0, Math.min(560, f.time), 7);
      break;
    }
    case "bumper-bowling": {
      const f = s.flight({
        bounces: 4,
        angle: direction > 0 ? 8 : 172,
        speed: shot.power * 9,
      });
      detonate(f, 40, clamp(f.speed / 6, 15, 100));
      for (const p of [0, 1] as const)
        if (
          f.path.some(
            (q) => Math.hypot(q.x - s.tank(p).x, q.y - s.tank(p).y + 12) < 24,
          )
        )
          s.hit(p, f.speed / 9, f.time);
      s.effect("steel", f.contacts, 0, Math.min(560, f.time), 25);
      break;
    }
    case "reflex-missile": {
      const f = s.flight({ guided: true, speed: 230 });
      detonate(f, 22, 18);
      const angle = clamp(
        (Math.atan2(own().y - target().y, target().x - own().x) * 180) /
          Math.PI,
        0,
        180,
      );
      s.state.tanks[player].aimAngle = angle;
      s.events.push({ type: "aim", time: f.time, player, angle });
      break;
    }
    case "magnablobs": {
      const f = s.flight({ guided: true, speed: 210 });
      s.terrain(f.time, () =>
        circle(s.world, f.point.x, f.point.y, 28, MATERIAL.glue),
      );
      s.effect("electric", [f.point], f.time, 40, 35);
      if (s.reaches(enemy, f.point, f.time)) {
        s.state.tanks[enemy].stuck = 2;
        s.state.tanks[enemy].fuel = 0;
        s.hit(enemy, 18, f.time);
      }
      break;
    }
    case "retreat": {
      const t = s.tank(),
        x = s.tank(enemy).x < WIDTH / 2 ? WIDTH - 40 : 40;
      s.move(player, { x, y: supportY(s.world, x, 70) }, 0, 50, 65);
      s.effect("wave", [t, { x, y: t.y }], 0, 50, 18);
      break;
    }
    case "super-retreat": {
      const t = s.tank(),
        x = s.tank(enemy).x < WIDTH / 2 ? WIDTH - 60 : 60;
      s.move(player, { x, y: supportY(s.world, x, 70) }, 0, 45, 80);
      s.terrain(45, () =>
        circle(
          s.world,
          x + direction * 45,
          s.tank().y - 22,
          35,
          MATERIAL.rubber,
        ),
      );
      const f = s.flight({
        start: { x: x, y: s.tank().y - 65 },
        angle: direction > 0 ? 35 : 145,
        delay: 46,
      });
      detonate(f, 35, 30);
      s.effect("wave", [t, s.tank()], 0, 45, 25);
      break;
    }
    case "rocket-launch": {
      const origin = own();
      const f = lob();
      s.move(
        player,
        {
          x: clamp(f.point.x, 24, 1176),
          y: supportY(s.world, f.point.x, Math.max(70, f.point.y - 20)),
        },
        0,
        Math.min(100, f.time),
        180,
      );
      s.blast(origin, 0, 28, 18);
      s.effect("fire", [origin], 0, 18, 30);
      break;
    }
    case "firefight": {
      const f = lob();
      detonate(f, 35, 35);
      const from = target(),
        to = own();
      s.effect("counterfire", [from, to], f.time + 6, 24, 20);
      const reply = s.flight({
        start: from,
        angle: direction > 0 ? 145 : 35,
        guided: true,
        target: to,
        speed: 310,
        delay: f.time + 6,
      });
      s.blast(reply.point, reply.time, 35, 30, true, reply.index, enemy);
      break;
    }
    case "auto-turrets": {
      const t = s.tank();
      for (let i = 0; i < 6; i++) {
        const start = { x: t.x + (i - 2.5) * 28, y: t.y - 25 };
        s.effect("robot", [start], i * 5, 65, 18);
        const f = s.flight({
          start,
          guided: true,
          speed: 260,
          delay: 15 + i * 5,
        });
        detonate(f, 22, 10);
      }
      break;
    }
    case "sinker": {
      for (const p of [0, 1] as const) {
        const t = s.tank(p);
        s.terrain(0, () =>
          rectangle(
            s.world,
            t.x - 28,
            t.y - 10,
            56,
            Math.min(160, 610 - t.y),
            MATERIAL.air,
          ),
        );
        s.move(p, { x: t.x, y: Math.min(610, t.y + 140) }, 1, 35);
        s.hit(p, 25, 36, "fall");
      }
      s.effect("drill", [s.tank(), s.tank(enemy)], 0, 36, 30);
      break;
    }
    case "spike-pit": {
      const f = lob();
      s.terrain(f.time, () => {
        rectangle(
          s.world,
          f.point.x - 45,
          f.point.y - 8,
          90,
          155,
          MATERIAL.air,
        );
        rectangle(
          s.world,
          f.point.x - 45,
          Math.min(594, f.point.y + 140),
          90,
          12,
          MATERIAL.spikes,
        );
      });
      s.effect(
        "steel",
        [{ x: f.point.x, y: Math.min(590, f.point.y + 140) }],
        f.time,
        35,
        40,
      );
      for (const p of [0, 1] as const)
        if (Math.abs(s.tank(p).x - f.point.x) < 65) s.hit(p, 40, f.time + 25);
      break;
    }
    case "flash-flood": {
      const f = lob();
      s.flow(
        { x: WIDTH / 2, y: Math.max(...before.terrain) },
        f.time,
        MATERIAL.water,
        WIDTH,
        65,
        8,
      );
      s.effect(
        "duck",
        [
          { x: 5, y: 400 },
          { x: 1195, y: 400 },
        ],
        f.time,
        95,
        18,
      );
      for (const p of [0, 1] as const)
        s.move(
          p,
          { x: s.tank(p).x + direction * 45, y: s.tank(p).y },
          f.time + 20,
          35,
          20,
        );
      break;
    }
    case "vacuum-cannon": {
      const from = own();
      s.pull(enemy, from, 0, Math.min(220, Math.abs(target().x - from.x) - 40));
      const t = s.tank(enemy);
      s.move(
        enemy,
        {
          x: t.x + direction * 290,
          y: supportY(s.world, t.x + direction * 290, t.y),
        },
        32,
        40,
        170,
        1,
      );
      s.hit(enemy, 45, 72);
      s.effect("wave", [from, s.tank(enemy)], 32, 40, 40);
      break;
    }
    case "foundation": {
      s.terrain(0, () =>
        rectangle(s.world, 0, 570, WIDTH, 40, MATERIAL.concrete),
      );
      s.effect(
        "tiles",
        [
          { x: 0, y: 570 },
          { x: WIDTH, y: 570 },
        ],
        0,
        35,
        40,
      );
      break;
    }
    default:
      throw Error(`Unexpected weapon ${id}`);
  }
}
