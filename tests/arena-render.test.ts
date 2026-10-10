import { describe, it, expect, vi } from "vitest";
// Phaser requires a browser at import time. Capture only the graphics boundary;
// the terrain and barrel drawing methods below are the production renderer.
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { Arena } from "../src/client/arena";
import { createMatch, WIDTH, HEIGHT } from "../src/shared/game";

class Graphics {
  paths: number[][][] = [];
  path: number[][] = [];
  barrels: number[][] = [];
  clear() {
    this.paths = [];
    this.barrels = [];
  }
  fillRect() {}
  fillStyle() {}
  lineStyle() {}
  fillEllipse() {}
  beginPath() {
    this.path = [];
  }
  moveTo(x: number, y: number) {
    this.path.push([x, y]);
  }
  lineTo(x: number, y: number) {
    this.path.push([x, y]);
  }
  closePath() {}
  fillPath() {
    this.paths.push(this.path);
  }
  strokePath() {}
  lineBetween(...line: number[]) {
    this.barrels.push(line);
  }
}

// Access private drawing methods without adding test hooks to production code.
function renderer() {
  const arena = new Arena();
  const surface = new Graphics();
  const aim = new Graphics();
  const draw = arena as unknown as {
    terrain: Graphics;
    aim: Graphics;
    match: ReturnType<typeof createMatch>;
    drawTerrain(terrain: number[]): void;
    drawAim(): void;
  };
  draw.terrain = surface;
  draw.aim = aim;
  draw.match = createMatch(1);
  return { arena, draw, surface, aim };
}

describe("terrain fill geometry", () => {
  it("keeps shaded layers above the floor on low ground and deep craters", () => {
    const { draw, surface } = renderer();
    const terrain = Array.from({ length: WIDTH }, (_, x) =>
      x < 200 ? 580 : x < 300 ? 610 : 100,
    );
    draw.drawTerrain(terrain);
    expect(surface.paths).toHaveLength(6);
    for (const path of surface.paths) {
      expect(path.every(([x, y]) => x >= 0 && x <= WIDTH && y <= HEIGHT)).toBe(
        true,
      );
    }
    expect(surface.paths[0]).toContainEqual([250, 610]);
    expect(terrain[250]).toBe(610);
  });
});

describe("barrel angles", () => {
  it("keeps a player's selected barrel direction while the opponent aims", () => {
    const { arena, draw, aim } = renderer();
    arena.setAim({ angle: 73, power: 55, weapon: "shell" });
    draw.drawAim();
    draw.match.turn = 1;
    arena.setAim({ angle: 118, power: 40, weapon: "shell" });
    draw.drawAim();
    const [x, y, tipX, tipY] = aim.barrels[0];
    expect((Math.atan2(y - tipY, tipX - x) * 180) / Math.PI).toBeCloseTo(73);
    const [x1, y1, tipX1, tipY1] = aim.barrels[2];
    expect((Math.atan2(y1 - tipY1, tipX1 - x1) * 180) / Math.PI).toBeCloseTo(
      118,
    );
  });
});

it("commits an interrupted online shot before rendering the next shot", async () => {
  const { fire } = await import("../src/shared/game");
  const { arena, draw } = renderer();
  const first = fire(draw.match, 0, { angle: 90, power: 10, weapon: "digger" });
  const internals = arena as unknown as {
    animation: unknown;
    drawTanks: () => void;
    poses: { x: number; y: number }[];
  };
  internals.drawTanks = () => {};
  internals.animation = { result: first, done: () => {} };
  arena.cancelAnimation(true);
  expect(draw.match.turn).toBe(1);
  expect(draw.match.terrain).toEqual(first.state.terrain);
  expect(internals.poses[0].y).toBe(first.state.tanks[0].y);
});

it("legacy crater playback opens at the authoritative collision tick", async () => {
  const { fire } = await import("../src/shared/game");
  const { arena, draw } = renderer();
  delete draw.match.world;
  const result = fire(draw.match, 0, { angle: 90, power: 10, weapon: "heavy" });
  const internal = arena as unknown as {
    time: { now: number };
    animation: { impactTimes: number[] };
  };
  internal.time = { now: 0 };
  arena.animate(result, () => {});
  expect(internal.animation.impactTimes[0]).toBe(result.blasts[0].time);
});
