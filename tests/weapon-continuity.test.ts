import { expect, it } from "vitest";
import { createMatch, fire, WIDTH } from "../src/shared/game";
import {
  applyPatch,
  createWorld,
  rectangle,
  MATERIAL,
  surfaceHeights,
  supportY,
} from "../src/shared/materials";

it("initial terrain and tank support already match the world used by added weapons", () => {
  const before = createMatch(17);
  expect(before.world).toBeDefined();
  expect(before.terrain).toEqual(surfaceHeights(before.world!));
  for (const tank of before.tanks)
    expect(tank.y).toBe(supportY(before.world!, tank.x, tank.y));
});

it("first and second mixed shots change only their timestamped material patches", () => {
  let before = createMatch(17);
  for (const weapon of ["puzzle-box", "shell", "lava-flow", "heavy"] as const) {
    const result = fire(before, before.turn, { angle: 90, power: 10, weapon });
    const replay = structuredClone(before.world ?? createWorld(before.terrain));
    const touched = new Set<number>();
    for (const event of result.events ?? [])
      if (event.type === "terrain") {
        applyPatch(replay, event.patch);
        for (const [index] of event.patch) touched.add(index % 200);
      }
    expect(replay).toEqual(result.state.world);
    for (let x = 0; x < WIDTH; x++)
      if (!touched.has(Math.floor(x / 6)))
        expect(
          result.state.terrain[x],
          `${weapon} changed untouched land at ${x}`,
        ).toBe(before.terrain[x]);
    before = result.state;
  }
});

it("original shells hit a tank body before crossing it or hitting the terrain beyond", () => {
  const state = createMatch(17);
  state.terrain = Array(WIDTH).fill(570);
  state.world = createWorld(state.terrain);
  state.wind = 0;
  state.tanks[0] = { ...state.tanks[0], x: 350, y: 570 };
  state.tanks[1] = { ...state.tanks[1], x: 450, y: 570 };
  const r = fire(state, 0, { angle: 0, power: 100, weapon: "shell" });
  expect(r.paths[0].at(-1)!.x).toBeLessThan(450);
  expect(r.damage[1]).toBeGreaterThan(0);
});

it("original fast projectiles cannot jump through a six-pixel defensive wall", () => {
  const state = createMatch(17);
  state.terrain = Array(WIDTH).fill(570);
  state.world = createWorld(state.terrain);
  state.wind = 0;
  state.tanks[0] = { ...state.tanks[0], x: 350, y: 570 };
  rectangle(state.world, 384, 70, 6, 500, MATERIAL.steel);
  const r = fire(state, 0, { angle: 0, power: 100, weapon: "shell" });
  expect(r.paths[0].at(-1)!.x).toBeGreaterThanOrEqual(384);
  expect(r.paths[0].at(-1)!.x).toBeLessThan(390);
});

it("every added weapon preserves untouched terrain through a second original shot", async () => {
  const { REFERENCE_WEAPONS } = await import("../src/shared/reference-weapons");
  for (const weapon of REFERENCE_WEAPONS) {
    const before = createMatch(17);
    const first = fire(before, 0, { angle: 45, power: 60, weapon: weapon.id });
    const second = fire(first.state, 1, {
      angle: 90,
      power: 10,
      weapon: "shell",
    });
    for (const [input, result] of [
      [before, first],
      [first.state, second],
    ] as const) {
      const replay = structuredClone(input.world!);
      const touched = new Set<number>();
      for (const event of result.events!)
        if (event.type === "terrain") {
          applyPatch(replay, event.patch);
          for (const [index] of event.patch) touched.add(index % 200);
        }
      expect(replay.cells, weapon.id).toEqual(result.state.world!.cells);
      for (let col = 0; col < 200; col++)
        if (!touched.has(col))
          expect(result.state.terrain[col * 6], weapon.id).toBe(
            input.terrain[col * 6],
          );
      for (const tank of result.state.tanks)
        expect(tank.y, weapon.id).toBe(
          supportY(result.state.world!, tank.x, tank.y),
        );
    }
  }
}, 20000);

it("Nail Gun scores contact while the piercing projectile passes the tank", () => {
  const state = createMatch(17);
  state.terrain = Array(WIDTH).fill(570);
  state.world = createWorld(state.terrain);
  state.wind = 0;
  state.tanks[0] = { ...state.tanks[0], x: 350, y: 570 };
  state.tanks[1] = { ...state.tanks[1], x: 450, y: 570 };
  const result = fire(state, 0, { angle: 0, power: 100, weapon: "nail-gun" });
  const hits = result.events!.filter(
    (e) => e.type === "damage" && e.player === 1 && e.kind === "hit",
  );
  expect(hits.length).toBeGreaterThan(0);
  for (const hit of hits) {
    expect(
      result.paths.some((path, index) => {
        const tick = hit.time - result.pathStarts![index];
        const point = path[tick];
        return point && Math.hypot(point.x - 450, point.y - 556) < 22;
      }),
    ).toBe(true);
  }
});

it("Nail Gun excavates at the projectile's arrival rather than its final exit", () => {
  const before = createMatch(17);
  const result = fire(before, 0, { angle: 0, power: 100, weapon: "nail-gun" });
  const changes = result.events!.filter((e) => e.type === "terrain");
  expect(changes.length).toBeGreaterThan(0);
  for (const event of changes)
    expect(
      result.paths.some((path, index) => {
        const point = path[event.time - result.pathStarts![index]];
        return (
          point &&
          event.patch.every(
            ([cell]) =>
              Math.hypot(
                (cell % 200) * 6 + 3 - point.x,
                Math.floor(cell / 200) * 6 + 3 - point.y,
              ) <= 7,
          )
        );
      }),
    ).toBe(true);
});

it("Reference Airburst explodes at the last displayed projectile position", () => {
  const result = fire(createMatch(17), 0, {
    angle: 45,
    power: 60,
    weapon: "reference-airburst",
  });
  const blast = result.blasts[0];
  expect(result.paths[blast.pathIndex].at(-1)).toEqual({
    x: blast.x,
    y: blast.y,
  });
  expect(blast.time).toBe(result.paths[blast.pathIndex].length - 1);
});

for (const [weapon, power] of [
  ["scatter", 20],
  ["airburst", 30],
] as const)
  it(`${weapon} cannot explode in ground already excavated by another projectile`, () => {
    const before = createMatch(1);
    const result = fire(before, 0, { angle: 15, power, weapon });
    for (const blast of result.blasts) {
      const world = structuredClone(before.world!);
      for (const event of result.events!)
        if (event.type === "terrain" && event.time < blast.time!)
          applyPatch(world, event.patch);
      const point = result.paths[blast.pathIndex].at(-1)!;
      const tankContact = before.tanks.some(
        (t) =>
          ((point.x - t.x) / 20) ** 2 + ((point.y - (t.y - 12)) / 14) ** 2 <= 1,
      );
      const row = Math.floor(point.y / 6),
        col = Math.floor(point.x / 6);
      expect(
        world.cells[row * 200 + col] !== MATERIAL.air || tankContact,
        `${weapon} path ${blast.pathIndex} collided with empty air at tick ${blast.time}`,
      ).toBe(true);
    }
  });
