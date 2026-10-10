import {
  createWorld,
  CELL,
  worldPatch,
  circle,
  getCell,
  isSolid,
  supportY,
  surfaceHeights,
  MATERIAL,
  type MaterialWorld,
} from "./materials";
import { simulateReference } from "./weapon-simulation";
import type { WeaponEvent } from "./weapon-timeline";
import { REFERENCE_WEAPONS, type ReferenceWeaponId } from "./reference-weapons";
export const WIDTH = 1200;
export const HEIGHT = 640;
export const VOLLEYS = 10,
  MATCH_SHOTS = VOLLEYS * 2;
export const SHOT_TAIL_MS = 900;
export type Player = 0 | 1;
export type WeaponId =
  | "shell"
  | "heavy"
  | "scatter"
  | "bounce"
  | "digger"
  | "airburst"
  | ReferenceWeaponId;
export const WEAPONS: {
  id: WeaponId;
  name: string;
  icon: string;
  description: string;
  damage: number;
  radius: number;
  ammo: number;
  packs?: readonly string[];
  source?: string;
  color?: string;
}[] = [
  {
    id: "shell",
    name: "Standard",
    icon: "01",
    description: "Reliable all-round shell · unlimited",
    damage: 34,
    radius: 35,
    ammo: -1,
  },
  {
    id: "heavy",
    name: "Big Bang",
    icon: "02",
    description: "Heavy damage. A crater to match.",
    damage: 58,
    radius: 62,
    ammo: 3,
  },
  {
    id: "scatter",
    name: "Starfall",
    icon: "03",
    description: "Five shells. One very bad day.",
    damage: 20,
    radius: 27,
    ammo: 3,
  },
  {
    id: "bounce",
    name: "Skipstone",
    icon: "04",
    description: "Bounces twice before detonating.",
    damage: 46,
    radius: 44,
    ammo: 3,
  },
  {
    id: "digger",
    name: "Core Drill",
    icon: "05",
    description: "Carves deep. Let gravity do the rest.",
    damage: 22,
    radius: 78,
    ammo: 3,
  },
  {
    id: "airburst",
    name: "Moon Rain",
    icon: "06",
    description: "Splits at the apex into six fragments.",
    damage: 16,
    radius: 24,
    ammo: 3,
  },
  ...REFERENCE_WEAPONS,
];
export interface Point {
  x: number;
  y: number;
}
export interface Tank extends Point {
  points: number;
  fuel: number;
  stuck?: number;
  aimAngle?: number;
  lastAim?: Pick<Shot, "angle" | "power">;
  ammo: Record<WeaponId, number>;
}
export interface Match {
  seed: number;
  terrain: number[];
  world?: MaterialWorld;
  tanks: [Tank, Tank];
  turn: Player;
  wind: number;
  revision: number;
  winner: Player | "draw" | null;
  shots: number;
}
export interface Shot {
  angle: number;
  power: number;
  weapon: WeaponId;
}
export interface Blast extends Point {
  radius: number;
  damage: number;
  pathIndex: number;
  time?: number;
}
export interface ShotResult {
  shot: Shot;
  state: Match;
  paths: Point[][];
  blasts: Blast[];
  damage: [number, number];
  events?: WeaponEvent[];
  pathStarts?: number[];
  durationTicks?: number;
}
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function terrainAt(terrain: number[], x: number): number {
  return terrain[clamp(Math.round(x), 0, WIDTH - 1)];
}
export function mountainTerrain(seed: number): number[] {
  const rng = random(seed);
  const center = 0.3 + rng() * 0.4;
  const width = 0.14 + rng() * 0.12;
  const height = 330 + rng() * 100;
  const form = Math.floor(rng() * 3);
  const knots = Array.from({ length: 13 }, (_, i) => {
    const u = i / 12;
    let rise = height * Math.exp(-Math.pow((u - center) / width, 2));
    if (form === 1)
      rise = Math.max(
        rise,
        (height - 65) *
          Math.exp(-Math.pow((u - (center < 0.5 ? 0.76 : 0.24)) / 0.17, 2)),
      );
    if (form === 2)
      rise = height * Math.max(0, 1 - Math.abs(u - center) / (width * 1.8));
    return clamp(555 - rise + (rng() - 0.5) * 40, 85, 575);
  });
  const result = Array.from({ length: WIDTH }, (_, x) => {
    const p = (x / (WIDTH - 1)) * 12;
    const i = Math.min(11, Math.floor(p));
    return knots[i] + (knots[i + 1] - knots[i]) * (p - i);
  });
  // Midpoint displacement adds independent detail at several spatial scales.
  for (
    let span = 128, amplitude = 36;
    span >= 4;
    span = Math.floor(span / 2), amplitude *= 0.52
  ) {
    const noise = Array.from(
      { length: Math.ceil(WIDTH / span) + 1 },
      () => (rng() - 0.5) * amplitude * 2,
    );
    for (let x = 0; x < WIDTH; x++) {
      const p = x / span,
        i = Math.floor(p);
      result[x] += noise[i] + (noise[i + 1] - noise[i]) * (p - i);
    }
  }
  // Different seeds create different terraces without repeating a sine wave.
  const terrace = 2 + Math.floor(rng() * 3);
  return result.map((y) => clamp(Math.round(y / terrace) * terrace, 70, 580));
}
export function createMatch(seed: number): Match {
  const rng = random(seed);
  const world = createWorld(mountainTerrain(seed).map((y) => Math.min(y, 576)));
  const terrain = surfaceHeights(world);
  const tank = (x: number): Tank => ({
    x,
    y: terrainAt(terrain, x),
    points: 0,
    fuel: 60,
    ammo: Object.fromEntries(WEAPONS.map((w) => [w.id, w.ammo])) as Record<
      WeaponId,
      number
    >,
  });
  return {
    seed,
    terrain,
    world,
    tanks: [tank(190), tank(1010)],
    turn: 0,
    wind: Math.round((rng() - 0.5) * 16),
    revision: 0,
    winner: null,
    shots: 0,
  };
}
function canAct(state: Match, player: Player) {
  if (state.winner !== null) throw Error("This match is over.");
  if (state.turn !== player) throw Error("Wait for your turn.");
}
export function move(state: Match, player: Player, direction: number): Match {
  canAct(state, player);
  if (state.tanks[player].stuck)
    throw Error("This tank is immobilized by magnetic glue.");
  if (direction !== 1 && direction !== -1) throw Error("Invalid movement.");
  if (state.tanks[player].fuel < 10)
    throw Error("No movement fuel left this turn.");
  const next = structuredClone(state);
  const t = next.tanks[player];
  const other = next.tanks[player === 0 ? 1 : 0];
  const x = clamp(t.x + direction * 20, 30, WIDTH - 30);
  if (
    Math.abs(other.x - x) < 50 ||
    Math.abs(
      (next.world ? supportY(next.world, x, t.y) : terrainAt(next.terrain, x)) -
        t.y,
    ) > 45 ||
    x === t.x
  )
    throw Error("That slope is too steep.");
  t.x = x;
  t.y = next.world ? supportY(next.world, x, t.y) : terrainAt(next.terrain, x);
  t.fuel -= 10;
  next.revision++;
  return next;
}
export function preview(state: Match, shot: Shot): Point[] {
  return trace(state, shot.angle, shot.power, 0)[0].slice(0, 26);
}
function trace(
  state: Match,
  angle: number,
  power: number,
  bounces: number,
  start?: Point,
  velocity?: Point,
  priorImpacts: Blast[] = [],
  delay = 0,
): [Point[], Point] {
  const tank = state.tanks[state.turn];
  const radians = (angle * Math.PI) / 180;
  let x = start?.x ?? tank.x + Math.cos(radians) * 24;
  let y = start?.y ?? tank.y - 20 - Math.sin(radians) * 24;
  let vx = velocity?.x ?? Math.cos(radians) * power * 7.8;
  let vy = velocity?.y ?? -Math.sin(radians) * power * 7.8;
  const path: Point[] = [{ x, y }];
  let bounceCount = 0;
  const flightWorld =
    state.world && priorImpacts.length
      ? { cells: state.world.cells.slice() }
      : state.world;
  const changes = priorImpacts.slice().sort((a, b) => a.time! - b.time!);
  let changeIndex = 0;
  const launchTanks = new Set<Player>();
  for (const p of [0, 1] as const) {
    const pose = state.tanks[p];
    if (Math.hypot(x - pose.x, y - (pose.y - 12)) < 32) launchTanks.add(p);
  }
  for (let i = 0; i < 899 - delay; i++) {
    const previous = { x, y };
    // Simultaneous contacts see the same pre-impact terrain. Earlier impacts
    // have already excavated their craters when this projectile arrives.
    while (
      flightWorld &&
      changeIndex < changes.length &&
      changes[changeIndex].time! < i + 1 + delay
    ) {
      const blast = changes[changeIndex++];
      circle(flightWorld, blast.x, blast.y, blast.radius, MATERIAL.air);
    }
    vx += state.wind * 0.32 * 0.025;
    vy += 340 * 0.025;
    const nx = x + vx * 0.025,
      ny = y + vy * 0.025;
    const samples = Math.max(
      1,
      Math.ceil(Math.hypot(nx - x, ny - y) / (CELL / 2)),
    );
    let terrainHit = false,
      tankHit = false;
    let contact = { x: nx, y: ny };
    for (let sample = 1; sample <= samples; sample++) {
      const sx = x + ((nx - x) * sample) / samples;
      const sy = y + ((ny - y) * sample) / samples;
      terrainHit = flightWorld
        ? isSolid(getCell(flightWorld, sx, sy))
        : sy >= terrainAt(state.terrain, sx);
      for (const p of [0, 1] as const) {
        const pose = state.tanks[p];
        if (Math.hypot(sx - pose.x, sy - (pose.y - 12)) >= 32)
          launchTanks.delete(p);
        if (
          !launchTanks.has(p) &&
          ((sx - pose.x) / 20) ** 2 + ((sy - (pose.y - 12)) / 14) ** 2 <= 1
        )
          tankHit = true;
      }
      if (terrainHit || tankHit) {
        contact = { x: sx, y: sy };
        break;
      }
    }
    x = contact.x;
    y = contact.y;
    if (tankHit) {
      path.push({ x, y });
      break;
    }
    if (x < 0 || x >= WIDTH || y > HEIGHT) {
      path.push({ x, y });
      break;
    }
    if (terrainHit) {
      y = state.world ? y : terrainAt(state.terrain, x);
      path.push({ x, y });
      if (bounceCount < bounces && Math.abs(vx) > 10) {
        bounceCount++;
        const wall =
          flightWorld &&
          isSolid(getCell(flightWorld, x, previous.y)) &&
          !isSolid(getCell(flightWorld, previous.x, y));
        if (wall) {
          vx = -vx * 0.72;
          x = previous.x;
          y = previous.y;
        } else {
          vy = -Math.max(100, Math.abs(vy) * 0.52);
          vx *= 0.72;
          x = previous.x;
          y = previous.y - 3;
        }
        continue;
      }
      break;
    }
    path.push({ x, y });
  }
  return [path, { x, y }];
}
export function fire(state: Match, player: Player, shot: Shot): ShotResult {
  canAct(state, player);
  if (
    !Number.isFinite(shot.angle) ||
    shot.angle < 0 ||
    shot.angle > 180 ||
    !Number.isFinite(shot.power) ||
    shot.power < 10 ||
    shot.power > 100
  )
    throw Error("Aim outside allowed range.");
  const weapon = WEAPONS.find((w) => w.id === shot.weapon);
  if (!weapon) throw Error("Unknown weapon.");
  if (state.tanks[player].ammo[weapon.id] === 0)
    throw Error("This weapon is out of ammo.");
  const reference = REFERENCE_WEAPONS.find((w) => w.id === shot.weapon);
  if (reference) {
    const result = simulateReference(state, player, shot, reference.id);
    result.state.tanks[player].lastAim = {
      angle: shot.angle,
      power: shot.power,
    };
    result.state.tanks[player].ammo[weapon.id]--;
    advanceTurn(result.state);
    result.state.wind = Math.round(
      (random(state.seed + result.state.shots * 7919)() - 0.5) * 16,
    );
    return result;
  }
  const next = structuredClone(state);
  next.tanks[player].lastAim = { angle: shot.angle, power: shot.power };
  const paths: Point[][] = [];
  const blasts: Blast[] = [];
  let priorImpacts: Blast[] = [];
  const add = (
    angle: number,
    power: number,
    bounces = 0,
    start?: Point,
    velocity?: Point,
    delay = 0,
  ) => {
    const index = paths.length;
    const [path, impact] = trace(
      state,
      angle,
      power,
      bounces,
      start,
      velocity,
      priorImpacts.filter((b) => b.pathIndex !== index),
      delay,
    );
    paths.push(path);
    if (impact.x >= 0 && impact.x < WIDTH && impact.y <= HEIGHT)
      blasts.push({
        ...impact,
        radius: weapon.radius,
        damage: weapon.damage,
        pathIndex: paths.length - 1,
        time: path.length - 1,
      });
  };
  // At most six colliding projectiles: each pass incorporates every earlier
  // impact, including impacts generated later in array order. Causal chains
  // can contain at most one impact from each projectile.
  const passes =
    state.world && (weapon.id === "scatter" || weapon.id === "airburst")
      ? 7
      : 1;
  for (let pass = 0; pass < passes; pass++) {
    paths.length = 0;
    blasts.length = 0;
    if (weapon.id === "scatter")
      for (let i = -2; i <= 2; i++)
        add(clamp(shot.angle + i * 3, 0, 180), shot.power * (1 + i * 0.035));
    else if (weapon.id === "airburst") {
      const [full] = trace(state, shot.angle, shot.power, 0);
      let apex = 0;
      for (let i = 1; i < full.length; i++)
        if (full[i].y < full[apex].y) apex = i;
      const stem = full.slice(0, apex + 1);
      paths.push(stem);
      const point = full[apex];
      // Six descending fragments plus the central stem stay within seven paths.
      for (let i = 0; i < 6; i++) {
        add(
          shot.angle,
          shot.power,
          0,
          point,
          {
            x:
              (i - 2.5) * 75 +
              Math.cos((shot.angle * Math.PI) / 180) * shot.power * 2,
            y: 30,
          },
          stem.length - 1,
        );
        paths[paths.length - 1] = stem
          .slice(0, -1)
          .concat(paths[paths.length - 1])
          .slice(0, 900);
        const blast = blasts.find((b) => b.pathIndex === paths.length - 1);
        if (blast) blast.time = paths[paths.length - 1].length - 1;
      }
    } else add(shot.angle, shot.power, weapon.id === "bounce" ? 2 : 0);
    const stable = JSON.stringify(blasts) === JSON.stringify(priorImpacts);
    priorImpacts = blasts.map((blast) => ({ ...blast }));
    if (stable) break;
  }
  const damage: [number, number] = [0, 0];
  const events: WeaponEvent[] = [];
  for (const blast of [...blasts].sort(
    (a, b) => paths[a.pathIndex].length - paths[b.pathIndex].length,
  )) {
    const time = blast.time ?? paths[blast.pathIndex].length;
    if (next.world) {
      const previous = { cells: next.world.cells.slice() };
      circle(
        next.world,
        blast.x,
        blast.y,
        blast.radius * (weapon.id === "digger" ? 1.6 : 1),
        MATERIAL.air,
      );
      const patch = worldPatch(previous, next.world);
      if (patch.length) events.push({ type: "terrain", time, patch });
    }
    for (let p = 0; p < 2; p++) {
      const t = next.tanks[p];
      const distance = Math.hypot(t.x - blast.x, t.y - 10 - blast.y);
      const amount = Math.round(
        blast.damage * clamp(1 - distance / (blast.radius + 24), 0, 1),
      );
      damage[p] += amount;
      if (next.world && amount)
        events.push({
          type: "damage",
          time,
          player: p as Player,
          attacker: player,
          amount,
          kind: "hit",
          x: t.x,
          y: t.y,
        });
    }
    for (
      let x = Math.max(0, Math.floor(blast.x - blast.radius));
      x < Math.min(WIDTH, blast.x + blast.radius);
      x++
    ) {
      const dx = x - blast.x;
      const floor =
        blast.y +
        Math.sqrt(Math.max(0, blast.radius ** 2 - dx ** 2)) *
          (weapon.id === "digger" ? 1.6 : 1);
      next.terrain[x] = clamp(Math.max(next.terrain[x], floor), 70, 610);
    }
  }
  if (next.world) next.terrain = surfaceHeights(next.world);
  for (let p = 0; p < 2; p++) {
    const t = next.tanks[p];
    const newY = next.world
      ? supportY(next.world, t.x, t.y)
      : terrainAt(next.terrain, t.x);
    const fall = Math.round(Math.max(0, newY - t.y - 28) * 0.35);
    damage[p] += fall;
    if (next.world && newY !== t.y) {
      const time = Math.max(0, ...paths.map((p) => p.length)) + 2;
      events.push({
        type: "tank",
        time,
        player: p as Player,
        from: { x: t.x, y: t.y },
        to: { x: t.x, y: newY },
        duration: 20,
        arc: 0,
        turns: 0,
      });
      if (fall)
        events.push({
          type: "damage",
          time: time + 20,
          player: p as Player,
          attacker: player,
          amount: fall,
          kind: "fall",
          x: t.x,
          y: newY,
        });
    }
    t.y = newY;
  }
  if (weapon.ammo !== -1) next.tanks[player].ammo[weapon.id]--;
  next.tanks[player].points += damage[player === 0 ? 1 : 0] - damage[player];
  advanceTurn(next);
  next.wind = Math.round((random(state.seed + next.shots * 7919)() - 0.5) * 16);
  const result: ShotResult = {
    shot: { ...shot },
    state: next,
    paths,
    blasts,
    damage,
  };
  if (next.world) {
    events.sort((a, b) => a.time - b.time);
    result.events = events;
    result.durationTicks = Math.max(
      0,
      ...paths.map((p) => p.length),
      ...events.map((e) => e.time + ("duration" in e ? e.duration : 0)),
    );
  }
  return result;
}
function advanceTurn(state: Match) {
  state.turn = state.turn === 0 ? 1 : 0;
  const active = state.tanks[state.turn];
  if (active.stuck) active.stuck--;
  active.fuel = active.stuck ? 0 : 60;
  state.revision++;
  state.shots++;
  if (state.shots >= MATCH_SHOTS)
    state.winner =
      state.tanks[0].points === state.tanks[1].points
        ? "draw"
        : state.tanks[0].points > state.tanks[1].points
          ? 0
          : 1;
}
export function passTurn(state: Match): Match {
  canAct(state, state.turn);
  const next = structuredClone(state);
  advanceTurn(next);
  return next;
}
export function shotDuration(result: ShotResult): number {
  return (
    (result.durationTicks ??
      Math.max(
        0,
        ...result.paths.map((p, i) => p.length + (result.pathStarts?.[i] ?? 0)),
      )) *
      25 +
    SHOT_TAIL_MS
  );
}
export function botShot(state: Match): Shot {
  const player = state.turn;
  const target = state.tanks[player === 0 ? 1 : 0];
  const rng = random(state.seed + state.revision * 97);
  let best = { angle: 45, power: 60, weapon: "shell" as WeaponId };
  let distance = Infinity;
  for (let angle = 25; angle <= 155; angle += 5)
    for (let power = 30; power <= 100; power += 5) {
      const [, impact] = trace(state, angle, power, 0);
      const d = Math.hypot(impact.x - target.x, impact.y - target.y);
      if (d < distance) {
        distance = d;
        best = { angle, power, weapon: "shell" };
      }
    }
  const available = WEAPONS.filter((w) => state.tanks[player].ammo[w.id] !== 0);
  best.weapon = available[Math.floor(rng() * available.length)].id;
  best.angle = clamp(best.angle + (rng() - 0.5) * 5, 0, 180);
  return best;
}
