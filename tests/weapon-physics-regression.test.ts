import { describe, expect, it } from "vitest";
import { createMatch, fire, WIDTH } from "../src/shared/game";
import {
  createWorld,
  getCell,
  rectangle,
  MATERIAL,
} from "../src/shared/materials";
import { REFERENCE_WEAPONS } from "../src/shared/reference-weapons";
import { Simulation } from "../src/shared/weapon-engine";

function simulation() {
  const state = createMatch(17);
  state.terrain = Array(WIDTH).fill(570);
  state.world = createWorld(state.terrain);
  state.wind = 0;
  state.tanks[0] = { ...state.tanks[0], x: 350, y: 570 };
  state.tanks[1] = { ...state.tanks[1], x: 720, y: 570 };
  return new Simulation(
    state,
    0,
    { angle: 0, power: 100, weapon: "lava-flow" },
    REFERENCE_WEAPONS.find((w) => w.id === "lava-flow")!,
  );
}

describe("shared weapon physics regressions", () => {
  it("a new flow cannot claim damage from an unrelated old lava pool", () => {
    const s = simulation();
    rectangle(s.world, 708, 540, 30, 30, MATERIAL.lava);
    s.initialWorld.cells = s.world.cells.slice();
    s.flow({ x: 350, y: 570 }, 0, MATERIAL.lava, 100, 80, 8);
    expect(s.finish().damage[1]).toBe(0);
  });
  it("Lava Flow cooling leaves unrelated old lava pools unchanged", () => {
    const s = simulation();
    rectangle(s.before.world!, 1080, 540, 30, 30, MATERIAL.lava);
    const r = fire(s.before, 0, { angle: 90, power: 10, weapon: "lava-flow" });
    expect(getCell(r.state.world!, 1090, 565)).toBe(MATERIAL.lava);
  });
  it("a wrapped shot collides with barriers immediately across the screen seam", () => {
    const s = simulation();
    rectangle(s.world, 0, 70, 6, 500, MATERIAL.steel);
    s.initialWorld.cells = s.world.cells.slice();
    const f = s.flight({
      start: { x: 1190, y: 300 },
      speed: 900,
      gravity: 0,
      wrap: true,
    });
    expect(f.point.x).toBeGreaterThanOrEqual(0);
    expect(f.point.x).toBeLessThan(6);
    expect(f.time).toBe(1);
  });
  it("Lava Flow cools deposited lava without drawing a concrete bar through hills or empty air", () => {
    const state = createMatch(17);
    const r = fire(state, 0, { angle: 90, power: 10, weapon: "lava-flow" });
    const cooling = r.events!.filter((e) => e.type === "terrain").at(-1)!;
    expect(cooling.type).toBe("terrain");
    if (cooling.type !== "terrain") return;
    const world = createWorld(state.terrain);
    for (const event of r.events!) {
      if (event === cooling) break;
      if (event.type === "terrain")
        for (const [i, m] of event.patch) world.cells[i] = m;
    }
    for (const [i, material] of cooling.patch)
      if (material === MATERIAL.concrete) {
        expect(world.cells[i]).toBe(MATERIAL.lava);
        expect(world.cells[i + 200]).toBe(MATERIAL.dirt);
      }
  });
  it("flow cannot cross a ridge above its surface to fill an isolated valley", () => {
    const s = simulation();
    rectangle(s.world, 540, 240, 12, 330, MATERIAL.steel);
    s.initialWorld.cells = s.world.cells.slice();
    s.flow({ x: 600, y: 350 }, 0, MATERIAL.lava, 320, 80, 8);
    const r = s.finish();
    expect(getCell(r.state.world!, 480, 400)).toBe(MATERIAL.air);
    expect(getCell(r.state.world!, 600, 400)).toBe(MATERIAL.lava);
  });
  for (const weapon of [
    "magnablobs",
    "sticker-shock",
    "knockback",
    "bump-rockets",
  ] as const)
    it(`${weapon} cannot damage or displace a distant tank when intercepted by a wall`, () => {
      const s = simulation();
      rectangle(s.before.world!, 420, 70, 240, 500, MATERIAL.steel);
      const r = fire(s.before, 0, { angle: 10, power: 40, weapon });
      expect(r.damage[1]).toBe(0);
      expect(r.state.tanks[1].x).toBe(720);
      expect(r.state.tanks[1].y).toBe(570);
      expect(r.state.tanks[1].stuck ?? 0).toBe(0);
    });
  it("flow fills down to valley floors instead of leaving suspended rectangles", () => {
    const s = simulation();
    s.flow({ x: 600, y: 300 }, 0, MATERIAL.lava, 320, 80, 8);
    const r = s.finish();
    expect(getCell(r.state.world!, 600, 560)).toBe(MATERIAL.lava);
    expect(getCell(r.state.world!, 600, 575)).toBe(MATERIAL.dirt);
  });
  it("flow preserves hills and defensive material instead of painting over them", () => {
    const s = simulation();
    rectangle(s.world, 480, 260, 36, 310, MATERIAL.dirt);
    rectangle(s.world, 540, 300, 12, 270, MATERIAL.steel);
    s.initialWorld.cells = s.world.cells.slice();
    s.flow({ x: 601, y: 350 }, 0, MATERIAL.lava, 320, 80, 8);
    const r = s.finish();
    expect(getCell(r.state.world!, 480, 320)).toBe(MATERIAL.dirt);
    expect(getCell(r.state.world!, 546, 320)).toBe(MATERIAL.steel);
  });
  it("flow does not damage a tank sheltered in a dry pocket", () => {
    const s = simulation();
    s.state.tanks[1].y = s.before.tanks[1].y = 180;
    rectangle(s.world, 708, 180, 30, 390, MATERIAL.steel);
    rectangle(s.world, 708, 120, 30, 6, MATERIAL.steel);
    s.initialWorld.cells = s.world.cells.slice();
    s.flow({ x: 650, y: 200 }, 0, MATERIAL.water, 320, 80, 8);
    const r = s.finish();
    expect(
      r.events!.filter(
        (e) => e.type === "damage" && e.player === 1 && e.kind === "hit",
      ),
    ).toEqual([]);
  });
  it("lava remains a liquid rather than lifting tanks onto a solid slab", () => {
    const s = simulation();
    s.flow({ x: 720, y: 570 }, 0, MATERIAL.lava, 200, 80, 8);
    const r = s.finish();
    expect(r.state.tanks[1].y).toBe(570);
    expect(r.damage[1]).toBeGreaterThan(0);
  });
  it("fast projectiles collide with a six-pixel barrier between tick endpoints", () => {
    const s = simulation();
    rectangle(s.world, 390, 450, 6, 120, MATERIAL.steel);
    s.initialWorld.cells = s.world.cells.slice();
    const f = s.flight({ start: { x: 350, y: 500 }, speed: 1800, gravity: 0 });
    expect(f.point.x).toBeGreaterThanOrEqual(390);
    expect(f.point.x).toBeLessThan(396);
  });
  it("shots hit tank bodies before continuing into the ground or out of the arena", () => {
    const s = simulation();
    const f = s.flight({ start: { x: 650, y: 550 }, speed: 1800, gravity: 0 });
    expect(f.point.x).toBeGreaterThanOrEqual(700);
    expect(f.point.x).toBeLessThanOrEqual(740);
    s.blast(f.point, f.time, 30, 40);
    expect(s.finish().damage[1]).toBeGreaterThan(0);
  });
});
