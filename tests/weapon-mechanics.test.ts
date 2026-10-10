import { describe, expect, it } from "vitest";
import {
  createMatch,
  fire,
  WEAPONS,
  shotDuration,
  type WeaponId,
  WIDTH,
} from "../src/shared/game";
import { REFERENCE_WEAPONS } from "../src/shared/reference-weapons";
import { MATERIAL, createWorld } from "../src/shared/materials";
import { scoreEvents } from "../src/client/feedback";
function battlefield() {
  const state = createMatch(17);
  state.terrain = Array(WIDTH).fill(420);
  state.world = createWorld(state.terrain);
  state.tanks[0].x = 350;
  state.tanks[1].x = 720;
  state.tanks.forEach((t) => (t.y = 420));
  return state;
}
function shot(id: string) {
  return fire(battlefield(), 0, {
    angle: 35,
    power: 38,
    weapon: id as WeaponId,
  });
}
describe("source-listed playable weapons", () => {
  for (const weapon of REFERENCE_WEAPONS)
    it(`${weapon.name} resolves deterministic bounded events and conserves actual score`, () => {
      const state = battlefield(),
        before = structuredClone(state);
      const result = fire(state, 0, {
        angle: 35,
        power: 38,
        weapon: weapon.id,
      });
      expect(result.events?.length, weapon.id).toBeGreaterThan(0);
      expect(state).toEqual(before);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(JSON.stringify(result).length).toBeLessThan(750000);
      expect(result).toEqual(
        fire(state, 0, { angle: 35, power: 38, weapon: weapon.id }),
      );
      expect(result.state.world?.cells.length).toBe(21400);
      expect(
        result.paths.every(
          (p) => p.length <= 900 && p.every((v) => Number.isFinite(v.x + v.y)),
        ),
      ).toBe(true);
      expect(shotDuration(result)).toBeLessThanOrEqual(30000);
      expect(result.state.tanks[0].ammo[weapon.id]).toBe(2);
      const scores = scoreEvents(state, result);
      for (const p of [0, 1] as const)
        expect(
          scores
            .filter((e) => e.player === p)
            .reduce((n, e) => n + e.amount, 0),
        ).toBe(result.damage[p]);
    });
  it("does not implement the catalog as renamed copies of one shell", () => {
    const signatures = REFERENCE_WEAPONS.map((w) => {
      const r = shot(w.id);
      return JSON.stringify([
        r.paths,
        r.state.terrain,
        r.state.tanks.map((t) => [t.x, t.y, t.fuel]),
        r.damage,
        r.events?.filter((e) => e.type === "tank" || e.type === "terrain"),
      ]);
    });
    expect(new Set(signatures).size).toBe(79);
  });
});
const materialWeapons: [string, number][] = [
  ["concrete", MATERIAL.concrete],
  ["hover-blocks", MATERIAL.foam],
  ["lava-flow", MATERIAL.lava],
  ["fix-it-foam", MATERIAL.foam],
  ["magnablobs", MATERIAL.glue],
  ["super-retreat", MATERIAL.rubber],
  ["foundation", MATERIAL.concrete],
  ["electric-putty", MATERIAL.glue],
  ["rampart", MATERIAL.concrete],
  ["sandstone", MATERIAL.sand],
  ["snow-cone", MATERIAL.ice],
  ["bridge", MATERIAL.steel],
  ["bouncy-blocker", MATERIAL.rubber],
  ["barbed-wire", MATERIAL.spikes],
];
for (const [id, material] of materialWeapons)
  it(`${id} leaves functional persistent material`, () => {
    expect(shot(id).state.world!.cells).toContain(material);
  });
for (const id of [
  "danger-rope",
  "upheaval",
  "earthquake",
  "chasm",
  "bungee-bomb",
  "fling",
  "gravity-grenade",
  "bombs-away",
  "crash-dive",
  "stomper",
  "dash",
  "bungee-punch",
  "retreat",
  "super-retreat",
  "rocket-launch",
  "sinker",
  "vacuum-cannon",
  "rampart",
  "wrecker",
  "backflip",
  "bridge",
  "steamroller",
  "evac",
])
  it(`${id} animates actual tank displacement`, () => {
    expect(shot(id).events?.some((e) => e.type === "tank")).toBe(true);
  });
it("a trench removes a connected stretch of terrain instead of one circular crater", () => {
  const r = shot("trench");
  expect(
    r.state.world!.cells.filter(
      (m, i) => m === 0 && Math.floor(i / 200) * 6 >= 420,
    ).length,
  ).toBeGreaterThan(500);
});
it("Neutron Beam bypasses terrain and delivers several actual hits", () => {
  const r = shot("neutron-beam");
  expect(r.damage[1]).toBeGreaterThan(0);
  expect(r.events?.filter((e) => e.type === "damage").length).toBeGreaterThan(
    1,
  );
});
it("a miss can return as a Bungee Punch while Six Shooter waits for its second collision", () => {
  expect(
    shot("bungee-punch").events?.some(
      (e) => e.type === "effect" && e.kind === "rope",
    ),
  ).toBe(true);
  expect(shot("six-shooter").paths.length).toBe(6);
});
it("Firefight returns immediate fire without consuming a second turn", () => {
  const r = shot("firefight");
  expect(
    r.events?.some((e) => e.type === "effect" && e.kind === "counterfire"),
  ).toBe(true);
  expect(r.state.shots).toBe(1);
  expect(r.state.turn).toBe(1);
});
it("subsequent legacy shots retain material terrain and bounded state", () => {
  const r = shot("hover-blocks");
  const next = fire(r.state, 1, { angle: 120, power: 45, weapon: "shell" });
  expect(next.state.world).toBeDefined();
  expect(next.state.world!.cells).toContain(MATERIAL.foam);
});

it("timeline terrain replay and final tank poses agree with authoritative state", async () => {
  const { createWorld, applyPatch } = await import("../src/shared/materials");
  for (const weapon of REFERENCE_WEAPONS) {
    const before = battlefield(),
      r = fire(before, 0, { angle: 35, power: 38, weapon: weapon.id });
    const world = createWorld(before.terrain);
    for (const event of r.events!)
      if (event.type === "terrain") applyPatch(world, event.patch);
    expect(world.cells, weapon.id).toEqual(r.state.world!.cells);
    for (const p of [0, 1] as const) {
      const moves = r.events!.filter(
        (e) => e.type === "tank" && e.player === p,
      );
      if (moves.length) {
        const last = moves.at(-1)!;
        if (last.type === "tank") {
          expect(r.state.tanks[p].x, weapon.id).toBe(last.to.x);
          expect(r.state.tanks[p].y, weapon.id).toBe(last.to.y);
        }
      }
    }
  }
});
it("credits counterfire to its shooter and keeps displayed score events honest", () => {
  const before = battlefield(),
    r = shot("firefight");
  for (const p of [0, 1] as const) {
    const delta = r
      .events!.filter((e) => e.type === "damage" && e.attacker === p)
      .reduce(
        (sum, e) =>
          e.type === "damage"
            ? sum + (e.player === p ? -e.amount : e.amount)
            : sum,
        0,
      );
    expect(r.state.tanks[p].points - before.tanks[p].points).toBe(delta);
  }
});

it("mining robots and seeking rods damage the tank they have reached", () => {
  expect(shot("laser-bots").damage[1]).toBeGreaterThan(0);
  expect(shot("zap-stix").damage[1]).toBeGreaterThan(0);
});
it("legacy shots after a reference weapon carry material patches and authoritative score events", () => {
  const first = shot("hover-blocks");
  const next = fire(first.state, 1, { angle: 90, power: 10, weapon: "heavy" });
  expect(next.events?.some((e) => e.type === "terrain")).toBe(true);
  expect(next.events?.some((e) => e.type === "damage")).toBe(true);
});
it("movement under an overhang follows the pocket floor instead of teleporting to the roof", async () => {
  const { createWorld, circle, surfaceHeights } =
    await import("../src/shared/materials");
  const { move } = await import("../src/shared/game");
  const state = battlefield();
  state.world = createWorld(state.terrain);
  circle(state.world, 380, 140, 55, MATERIAL.foam);
  state.terrain = surfaceHeights(state.world);
  const next = move(state, 0, 1);
  expect(next.tanks[0].y).toBe(420);
});

it("attaches damage numbers to the actual tank pose at each hit during a rope pull", async () => {
  const { tankEventPose } = await import("../src/shared/weapon-timeline");
  const r = shot("danger-rope");
  const pull = r.events!.find((e) => e.type === "tank" && e.player === 1)!;
  expect(pull?.type).toBe("tank");
  if (pull.type !== "tank") return;
  const during = r.events!.filter(
    (e) =>
      e.type === "damage" &&
      e.player === 1 &&
      e.time >= pull.time &&
      e.time < pull.time + pull.duration,
  );
  expect(during.length).toBeGreaterThan(0);
  for (const hit of during)
    if (hit.type === "damage") {
      const pose = tankEventPose(pull, hit.time);
      expect(hit.x).toBeCloseTo(pose.x);
      expect(hit.y).toBeCloseTo(pose.y);
    }
});

it("Rocket Launch excavates its departure point at launch time, rather than its future landing point", () => {
  const r = shot("rocket-launch");
  const fire = r.events!.find(
    (e) => e.type === "effect" && e.kind === "fire" && e.time === 0,
  )!;
  expect(fire.type).toBe("effect");
  if (fire.type === "effect") expect(fire.points[0].x).toBe(350);
  expect(r.damage[0]).toBeGreaterThan(0);
});
it("contact lasers wait until their projectiles reach the contact position", () => {
  for (const id of ["battery", "spin-lasers", "sparkatron"]) {
    const before = createMatch(2),
      r = fire(before, 0, { angle: 60, power: 80, weapon: id as WeaponId });
    for (const e of r.events!)
      if (
        e.type === "effect" &&
        ["beam", "electric", "spark"].includes(e.kind)
      ) {
        const p = e.points[0];
        const arrivals = r.paths.flatMap((path, index) =>
          path.flatMap((q, t) =>
            Math.hypot(q.x - p.x, q.y - (p.y + 18)) < 20
              ? [t + (r.pathStarts?.[index] ?? 0)]
              : [],
          ),
        );
        if (arrivals.length)
          expect(e.time, id).toBeGreaterThanOrEqual(Math.min(...arrivals) - 2);
      }
  }
});

it("Flying Wall shells cannot cross dirt removed by an explosion that has not happened yet", async () => {
  const { createWorld, applyPatch, getCell, isSolid } =
    await import("../src/shared/materials");
  const before = createMatch(1),
    r = fire(before, 0, { angle: 20, power: 60, weapon: "flying-wall" });
  for (const [index, path] of r.paths.entries()) {
    const world = createWorld(before.terrain);
    let previous = 0;
    const changes = r.events!.filter((e) => e.type === "terrain");
    for (let step = 3; step < path.length - 1; step++) {
      const time = step + (r.pathStarts?.[index] ?? 0);
      while (previous < changes.length && changes[previous].time <= time) {
        const e = changes[previous++];
        if (e.type === "terrain") applyPatch(world, e.patch);
      }
      expect(
        isSolid(getCell(world, path[step].x, path[step].y)),
        `path ${index} tick ${step}`,
      ).toBe(false);
    }
  }
});

it("Flying Wall excavates each blast at its own timestamp, including earlier impacts generated later", async () => {
  const { createWorld, applyPatch, getCell, MATERIAL } =
    await import("../src/shared/materials");
  const before = createMatch(1),
    r = fire(before, 0, { angle: 20, power: 60, weapon: "flying-wall" });
  const blast = r.blasts.find((b) => b.pathIndex === 5)!;
  const world = createWorld(before.terrain);
  for (const event of r.events!)
    if (event.type === "terrain" && event.time <= blast.time!)
      applyPatch(world, event.patch);
  // Collision now resolves at the first swept contact rather than a later
  // endpoint. Assert excavation at the actual impact, not the old coordinates.
  expect(getCell(world, blast.x, blast.y)).toBe(MATERIAL.air);
});
