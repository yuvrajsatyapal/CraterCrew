import {
  clamp,
  random,
  WIDTH,
  HEIGHT,
  type Match,
  type Player,
  type Point,
  type Shot,
  type ShotResult,
} from "./game";
import { REFERENCE_WEAPONS } from "./reference-weapons";
import {
  createWorld,
  applyPatch,
  getCell,
  circle,
  rectangle,
  line,
  supportY,
  surfaceHeights,
  worldPatch,
  isSolid,
  MATERIAL,
  CELL,
  WORLD_COLS,
  type Material,
  type MaterialWorld,
} from "./materials";
import {
  tankEventPose,
  eventEnd,
  type EffectKind,
  type WeaponEvent,
} from "./weapon-timeline";
type Definition = (typeof REFERENCE_WEAPONS)[number];
type FlightOptions = {
  bounces?: number;
  gravity?: number;
  wrap?: boolean;
  guided?: boolean;
  pierce?: boolean;
  start?: Point;
  target?: Point;
  speed?: number;
  delay?: number;
  angle?: number;
};

type DamageIntent = {
  player: Player;
  attacker: Player;
  time: number;
  amount: number;
  kind: "hit" | "fall";
  area?: { point: Point; radius: number };
  ray?: { from: Point; to: Point; pierce: boolean };
  material?: { kind: Material; cells: Set<number> };
};
/** A bounded deterministic event builder, shared by the Worker and local game. */
export class Simulation {
  readonly state: Match;
  readonly world: MaterialWorld;
  readonly events: WeaponEvent[] = [];
  readonly paths: Point[][] = [];
  readonly starts: number[] = [];
  readonly blasts: ShotResult["blasts"] = [];
  readonly damage: [number, number] = [0, 0];
  readonly intents: DamageIntent[] = [];
  readonly initialWorld: MaterialWorld;
  readonly terrainOperations: { time: number; mutate: () => void }[] = [];
  readonly rng: () => number;
  readonly opponent: Player;
  constructor(
    readonly before: Match,
    readonly player: Player,
    readonly shot: Shot,
    readonly weapon: Definition,
  ) {
    this.state = structuredClone(before);
    this.world = this.state.world ?? createWorld(this.state.terrain);
    this.state.world = this.world;
    this.initialWorld = { cells: this.world.cells.slice() };
    this.opponent = player === 0 ? 1 : 0;
    this.rng = random(
      before.seed +
        before.revision * 7919 +
        REFERENCE_WEAPONS.findIndex((w) => w.id === weapon.id) * 131,
    );
  }
  tank(p: Player = this.player): Point {
    const t = this.state.tanks[p];
    return { x: t.x, y: t.y };
  }
  poseAt(p: Player, time: number): Point {
    let pose: Point = { x: this.before.tanks[p].x, y: this.before.tanks[p].y };
    for (const event of this.events
      .filter((e) => e.type === "tank")
      .sort((a, b) => a.time - b.time))
      if (event.type === "tank" && event.player === p && event.time <= time)
        pose = tankEventPose(event, time);
    return pose;
  }
  private applyOperation(
    operation: { mutate: () => void },
    target: MaterialWorld,
  ) {
    const planned = this.world.cells;
    try {
      this.world.cells = target.cells;
      operation.mutate();
      target.cells = this.world.cells;
    } finally {
      this.world.cells = planned;
    }
  }
  worldAt(time: number): MaterialWorld {
    const world = { cells: this.initialWorld.cells.slice() };
    for (const operation of this.terrainOperations
      .slice()
      .sort((a, b) => a.time - b.time))
      if (operation.time <= time) this.applyOperation(operation, world);
    return world;
  }
  muzzle(p: Player = this.player): Point {
    const t = this.tank(p);
    return { x: t.x, y: t.y - 22 };
  }
  reaches(p: Player, point: Point, time: number, range = 32) {
    const pose = this.poseAt(p, time);
    return Math.hypot(point.x - pose.x, point.y - (pose.y - 12)) <= range;
  }
  effect(
    kind: EffectKind,
    points: Point[],
    time: number,
    duration = 18,
    size = 18,
  ) {
    this.events.push({ type: "effect", kind, points, time, duration, size });
  }
  terrain(time: number, mutate: () => void) {
    this.terrainOperations.push({ time, mutate });
    // Planning preview; canonical patches are generated chronologically in finish.
    mutate();
  }
  hit(
    p: Player,
    amount: number,
    time: number,
    kind: "hit" | "fall" = "hit",
    attacker: Player = this.player,
  ) {
    if (amount > 0)
      this.intents.push({ player: p, attacker, time, amount, kind });
  }

  move(p: Player, to: Point, time: number, duration = 24, arc = 0, turns = 0) {
    const from = this.poseAt(p, time),
      target = { x: clamp(to.x, 24, WIDTH - 24), y: clamp(to.y, 70, 610) };
    this.events.push({
      type: "tank",
      player: p,
      from,
      to: target,
      time,
      duration,
      arc,
      turns,
    });
    Object.assign(this.state.tanks[p], target);
  }
  settle(p: Player, time: number) {
    const t = this.tank(p),
      y = supportY(this.world, t.x, t.y);
    if (Math.abs(y - t.y) > 0.5) {
      const duration = Math.min(
        32,
        Math.max(8, Math.sqrt(Math.abs(y - t.y)) * 1.8),
      );
      this.move(p, { x: t.x, y }, time, duration);
      this.hit(p, Math.max(0, y - t.y - 28) * 0.35, time + duration, "fall");
    }
  }
  /** Trajectories can reflect on materials, wrap, guide, or drill. */
  flight(options: FlightOptions = {}): {
    point: Point;
    time: number;
    path: Point[];
    contacts: (Point & { time: number })[];
    index: number;
    speed: number;
  } {
    const origin = this.poseAt(this.player, options.delay ?? 0);
    const angle = ((options.angle ?? this.shot.angle) * Math.PI) / 180;
    const start = options.start ?? {
      x: origin.x + Math.cos(angle) * 24,
      y: origin.y - 20 - Math.sin(angle) * 24,
    };
    const speed = options.speed ?? this.shot.power * 7.8;
    let x = start.x,
      y = start.y,
      vx = Math.cos(angle) * speed,
      vy = -Math.sin(angle) * speed;
    const points: Point[] = [{ x, y }],
      contacts: (Point & { time: number })[] = [];
    const flightWorld = { cells: this.initialWorld.cells.slice() };
    const changes = this.terrainOperations
      .slice()
      .sort((a, b) => a.time - b.time);
    let changeIndex = 0;
    let remaining = options.bounces ?? 0;
    const launchTanks = new Set<Player>();
    for (const p of [0, 1] as const) {
      const pose = this.poseAt(p, options.delay ?? 0);
      if (Math.hypot(start.x - pose.x, start.y - (pose.y - 12)) < 32)
        launchTanks.add(p);
    }
    for (let step = 1; step < 560; step++) {
      const at = (options.delay ?? 0) + step;
      while (changeIndex < changes.length && changes[changeIndex].time <= at) {
        this.applyOperation(changes[changeIndex++], flightWorld);
      }
      if (options.guided) {
        const pose = this.poseAt(this.opponent, at);
        const target = options.target ?? { x: pose.x, y: pose.y - 22 },
          dx = target.x - x,
          dy = target.y - y,
          d = Math.max(1, Math.hypot(dx, dy));
        vx = vx * 0.93 + (dx / d) * speed * 0.07;
        vy = vy * 0.93 + (dy / d) * speed * 0.07;
      } else {
        vx += this.before.wind * 0.008;
        vy += (options.gravity ?? 340) * 0.025;
      }
      let nx = x + vx * 0.025,
        ny = y + vy * 0.025;
      // Sweep at half-cell intervals: fast shots cannot tunnel through a wall
      // or tank between two trajectory samples.
      let collision: Material = MATERIAL.air;
      let tankHit = false;
      if (!options.pierce) {
        const samples = Math.max(
          1,
          Math.ceil(Math.hypot(nx - x, ny - y) / (CELL / 2)),
        );
        for (let i = 1; i <= samples; i++) {
          const rawX = x + ((nx - x) * i) / samples,
            sx = options.wrap ? ((rawX % WIDTH) + WIDTH) % WIDTH : rawX,
            sy = y + ((ny - y) * i) / samples;
          collision = getCell(flightWorld, sx, sy);
          for (const p of [0, 1] as const) {
            const pose = this.poseAt(p, at);
            if (Math.hypot(sx - pose.x, sy - (pose.y - 12)) >= 32)
              launchTanks.delete(p);
            if (
              !launchTanks.has(p) &&
              ((sx - pose.x) / 20) ** 2 + ((sy - (pose.y - 12)) / 14) ** 2 <= 1
            )
              tankHit = true;
          }
          if (isSolid(collision) || tankHit) {
            nx = sx;
            ny = sy;
            break;
          }
        }
      }
      if (tankHit) {
        x = nx;
        y = ny;
        contacts.push({ x, y, time: at });
        points.push({ x, y });
        break;
      }
      if (nx < 0 || nx >= WIDTH) {
        if (options.wrap) {
          nx = (nx + WIDTH) % WIDTH;
        } else if (remaining > 0) {
          vx = -vx;
          nx = clamp(nx, 1, WIDTH - 1);
          remaining--;
          contacts.push({ x: nx, y: ny, time: at });
        } else {
          points.push({ x: nx, y: ny });
          x = nx;
          y = ny;
          break;
        }
      }
      if (ny < 2 && options.gravity === 0) {
        vy = -vy;
        ny = 2;
      }
      if (ny > HEIGHT) {
        points.push({ x: nx, y: ny });
        x = nx;
        y = ny;
        break;
      }
      const m = collision;
      if (isSolid(m) && !options.pierce) {
        contacts.push({ x: nx, y: ny, time: at });
        const rubber = m === MATERIAL.rubber || m === MATERIAL.foam;
        if (remaining > 0 || (rubber && contacts.length < 8)) {
          if (!rubber) remaining--;
          if (
            isSolid(getCell(flightWorld, nx, y)) &&
            !isSolid(getCell(flightWorld, x, ny))
          )
            vx = -vx * 0.85;
          else vy = -Math.max(80, Math.abs(vy) * 0.65);
          nx = x;
          ny = y - 3;
        } else {
          x = nx;
          y = ny;
          points.push({ x, y });
          break;
        }
      }
      x = nx;
      y = ny;
      points.push({ x, y });
      if (
        options.guided &&
        Math.hypot(
          x - (options.target ?? this.muzzle(this.opponent)).x,
          y - (options.target ?? this.muzzle(this.opponent)).y,
        ) < 10
      )
        break;
    }
    // Existing client paths remain bounded; new event-only effects have no path slot.
    const index = this.paths.length;
    if (index >= 7) throw Error("Weapon trajectory budget exceeded.");
    this.paths.push(points);
    this.starts.push(options.delay ?? 0);
    return {
      point: { x, y },
      time: (options.delay ?? 0) + points.length - 1,
      path: points,
      contacts,
      index,
      speed: Math.hypot(vx, vy),
    };
  }
  directPath(points: Point[], time = 0) {
    const index = this.paths.length;
    if (index >= 7) throw Error("Weapon trajectory budget exceeded.");
    this.paths.push(points);
    this.starts.push(time);
    return index;
  }
  blast(
    point: Point,
    time: number,
    radius: number = this.weapon.radius,
    damage: number = this.weapon.damage,
    carve = true,
    pathIndex = -1,
    attacker: Player = this.player,
  ) {
    if (point.x < 0 || point.x >= WIDTH || point.y > HEIGHT) return;
    if (pathIndex >= 0)
      this.blasts.push({ ...point, radius, damage, pathIndex, time });
    else this.effect("fire", [point], time, 18, radius);
    for (const p of [0, 1] as const)
      this.intents.push({
        player: p,
        attacker,
        time,
        amount: damage,
        kind: "hit",
        area: { point: { ...point }, radius },
      });
    if (carve)
      this.terrain(time, () =>
        circle(this.world, point.x, point.y, radius, MATERIAL.air),
      );
  }
  volley(
    count: number,
    options: FlightOptions = {},
    spread = 3,
    radius: number = this.weapon.radius,
    damage: number = this.weapon.damage,
  ) {
    const impacts = [];
    for (let i = 0; i < count; i++) {
      const f = this.flight({
        ...options,
        angle:
          (options.angle ?? this.shot.angle) + (i - (count - 1) / 2) * spread,
        delay: (options.delay ?? 0) + i * 5,
      });
      this.blast(f.point, f.time, radius, damage, true, f.index);
      impacts.push(f);
    }
    return impacts;
  }
  beam(
    from: Point,
    to: Point,
    time: number,
    pulses = 4,
    amount = this.weapon.damage / 4,
    kind: EffectKind = "beam",
    pierce = true,
    attacker: Player = this.player,
  ) {
    this.effect(kind, [from, to], time, pulses * 6 + 8, 8);
    for (const p of [0, 1] as const)
      for (let i = 0; i < pulses; i++)
        this.intents.push({
          player: p,
          attacker,
          time: time + i * 6,
          amount,
          kind: "hit",
          ray: { from: { ...from }, to: { ...to }, pierce },
        });
  }

  flow(
    center: Point,
    time: number,
    material: Material,
    width: number,
    height: number,
    damage: number,
  ) {
    // Deposit aligned cells down to support. Never replace a hill/barrier or
    // cap a deep column halfway down, leaving a floating slab.
    const level = clamp(center.y - height, 70, 600);
    const deposited = new Set<number>();
    this.terrain(time, () => {
      deposited.clear();
      let left = Math.max(0, Math.floor((center.x - width / 2) / CELL)),
        right = Math.min(WORLD_COLS, Math.ceil((center.x + width / 2) / CELL));
      const source = Math.max(
          left,
          Math.min(right - 1, Math.floor(center.x / CELL)),
        ),
        surfaceRow = Math.ceil(level / CELL);
      if (isSolid(getCell(this.world, source * CELL, surfaceRow * CELL)))
        return;
      for (let col = source - 1; col >= left; col--)
        if (isSolid(getCell(this.world, col * CELL, surfaceRow * CELL))) {
          left = col + 1;
          break;
        }
      for (let col = source + 1; col < right; col++)
        if (isSolid(getCell(this.world, col * CELL, surfaceRow * CELL))) {
          right = col;
          break;
        }
      for (let col = left; col < right; col++) {
        const floor = supportY(this.world, col * CELL, level);
        for (let row = Math.ceil(level / CELL); row * CELL < floor; row++) {
          const index = row * WORLD_COLS + col;
          if (this.world.cells[index] === MATERIAL.air) {
            this.world.cells[index] = material;
            deposited.add(index);
          }
        }
      }
    });
    this.effect(
      material === MATERIAL.lava
        ? "fire"
        : material === MATERIAL.goo
          ? "electric"
          : "wave",
      [
        { x: center.x - width / 2, y: level },
        { x: center.x + width / 2, y: level },
      ],
      time,
      30,
      height,
    );
    for (const p of [0, 1] as const) {
      for (let i = 0; i < 4; i++)
        if (damage > 0)
          this.intents.push({
            player: p,
            attacker: this.player,
            time: time + i * 6,
            amount: damage,
            kind: "hit",
            material: { kind: material, cells: deposited },
          });
    }
    return deposited;
  }
  pull(p: Player, anchor: Point, time: number, distance: number, turns = 0) {
    const t = this.tank(p),
      sign = Math.sign(anchor.x - t.x) || -1;
    const x = clamp(t.x + sign * distance, 24, WIDTH - 24),
      y = supportY(this.world, x, t.y);
    this.effect("rope", [anchor, this.muzzle(p)], time, 30, 6);
    this.move(p, { x, y }, time, 30, Math.min(100, distance / 2), turns);
  }
  finish(): ShotResult {
    this.world.cells = this.initialWorld.cells.slice();
    for (const operation of this.terrainOperations
      .slice()
      .sort((a, b) => a.time - b.time)) {
      const before = { cells: this.world.cells.slice() };
      operation.mutate();
      const patch = worldPatch(before, this.world);
      if (patch.length)
        this.events.push({ type: "terrain", time: operation.time, patch });
    }
    this.events.sort((a, b) => a.time - b.time);
    // Normalize overlapping motions from the pose actually reached at their start.
    for (const p of [0, 1] as const) {
      let previous: Extract<WeaponEvent, { type: "tank" }> | undefined;
      for (const event of this.events)
        if (event.type === "tank" && event.player === p) {
          event.from = previous
            ? tankEventPose(previous, event.time)
            : { x: this.before.tanks[p].x, y: this.before.tanks[p].y };
          previous = event;
        }
      if (previous) Object.assign(this.state.tanks[p], previous.to);
    }
    let end = Math.max(
      0,
      ...this.events.map(eventEnd),
      ...this.intents.map((e) => e.time),
      ...this.paths.map((path, i) => path.length + this.starts[i]),
    );
    for (const p of [0, 1] as const) this.settle(p, end + 2);
    const collisionWorld = { cells: this.initialWorld.cells.slice() };
    const terrainEvents = this.events
      .filter((e) => e.type === "terrain")
      .sort((a, b) => a.time - b.time);
    let terrainIndex = 0;
    for (const intent of this.intents.sort((a, b) => a.time - b.time)) {
      while (
        terrainIndex < terrainEvents.length &&
        terrainEvents[terrainIndex].time < intent.time
      ) {
        const change = terrainEvents[terrainIndex++];
        if (change.type === "terrain") applyPatch(collisionWorld, change.patch);
      }
      const pose = this.poseAt(intent.player, intent.time);
      let amount = intent.amount;
      if (intent.material !== undefined) {
        // Contact uses post-deposit terrain at this tick; the broad bounding
        // rectangle alone is not evidence that a tank is submerged.
        const contactWorld = this.worldAt(intent.time);
        if (
          ![0, -6, -12].some(
            (dy) =>
              getCell(contactWorld, pose.x, pose.y + dy) ===
                intent.material!.kind &&
              intent.material!.cells.has(
                Math.floor((pose.y + dy) / CELL) * WORLD_COLS +
                  Math.floor(pose.x / CELL),
              ),
          )
        )
          continue;
      }
      if (intent.area) {
        const { point, radius } = intent.area;
        amount *= clamp(
          1 -
            Math.hypot(pose.x - point.x, pose.y - 12 - point.y) / (radius + 24),
          0,
          1,
        );
        const cover = getCell(collisionWorld, pose.x, pose.y - 12);
        if (cover === MATERIAL.concrete || cover === MATERIAL.steel)
          amount *= 0.5;
      }
      if (intent.ray) {
        const { from, to, pierce } = intent.ray,
          dx = to.x - from.x,
          dy = to.y - from.y,
          len = dx * dx + dy * dy;
        const tank = { x: pose.x, y: pose.y - 22 };
        const u = clamp(
          ((tank.x - from.x) * dx + (tank.y - from.y) * dy) / Math.max(1, len),
          0,
          1,
        );
        if (
          Math.hypot(tank.x - from.x - u * dx, tank.y - from.y - u * dy) >=
            25 ||
          (intent.player === intent.attacker &&
            Math.hypot(tank.x - from.x, tank.y - from.y) <= 25)
        )
          continue;
        if (!pierce) {
          const steps = Math.ceil(Math.hypot(dx, dy) / 6);
          let blocked = false;
          for (let i = 1; i < steps * u; i++)
            if (
              isSolid(
                getCell(
                  collisionWorld,
                  from.x + (dx * i) / steps,
                  from.y + (dy * i) / steps,
                ),
              )
            ) {
              blocked = true;
              break;
            }
          if (blocked) continue;
        }
      }
      const n = Math.max(0, Math.round(amount));
      if (!n) continue;
      this.damage[intent.player] += n;
      this.state.tanks[intent.attacker].points +=
        intent.player === intent.attacker ? -n : n;
      this.events.push({
        type: "damage",
        time: intent.time,
        player: intent.player,
        attacker: intent.attacker,
        amount: n,
        kind: intent.kind,
        x: pose.x,
        y: pose.y,
      });
    }
    end = Math.max(end, ...this.events.map(eventEnd));
    this.state.terrain = surfaceHeights(this.world);
    this.events.sort((a, b) => a.time - b.time);
    return {
      shot: { ...this.shot },
      state: this.state,
      paths: this.paths,
      blasts: this.blasts,
      damage: this.damage,
      events: this.events,
      pathStarts: this.starts,
      durationTicks: end,
    };
  }
}
