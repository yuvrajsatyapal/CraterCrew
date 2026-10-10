import { expect, it } from "vitest";
import type Phaser from "phaser";
import {
  drawMaterialWorld,
  drawReferenceEffects,
} from "../src/client/reference-effects";
import {
  createWorld,
  circle,
  rectangle,
  MATERIAL,
} from "../src/shared/materials";
import { createMatch, fire, WIDTH } from "../src/shared/game";
import type { WeaponEvent } from "../src/shared/weapon-timeline";

function graphics() {
  let color = 0;
  const rects: { x: number; y: number; w: number; h: number; color: number }[] =
    [];
  const lines: number[][] = [];
  const circles: number[][] = [];
  return {
    rects,
    lines,
    circles,
    g: {
      clear() {},
      fillStyle(tint: number) {
        color = tint;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ x, y, w, h, color });
      },
      lineStyle() {},
      beginPath() {},
      strokePath() {},
      moveTo(x: number, y: number) {
        lines.push([x, y]);
      },
      lineTo(x: number, y: number) {
        lines.push([x, y]);
      },
      lineBetween(...args: number[]) {
        lines.push(args);
      },
      fillCircle(...args: number[]) {
        circles.push(args);
      },
    } as unknown as Phaser.GameObjects.Graphics,
  };
}
function pixel(surface: ReturnType<typeof graphics>, x: number, y: number) {
  return surface.rects
    .slice()
    .reverse()
    .find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.color;
}
it("excavation preserves the colors of every surviving dirt pixel in the crater column", () => {
  const world = createWorld(Array(WIDTH).fill(300));
  const before = graphics();
  drawMaterialWorld(before.g, world);
  circle(world, 600, 300, 60, MATERIAL.air);
  const after = graphics();
  drawMaterialWorld(after.g, JSON.parse(JSON.stringify(world)));
  for (let y = 366; y < 600; y += 2)
    for (let x = 600; x < 606; x += 2)
      expect(pixel(after, x, y), `surviving dirt at ${x},${y}`).toBe(
        pixel(before, x, y),
      );
});
it("ground grain uses crisp two-pixel blocks and stays outside excavated air", () => {
  const world = createWorld(Array(WIDTH).fill(300));
  circle(world, 600, 360, 24, MATERIAL.air);
  const surface = graphics();
  drawMaterialWorld(surface.g, world);
  expect(surface.rects.some((r) => r.w === 2 && r.h === 2)).toBe(true);
  expect(
    surface.rects.every(
      (r) => r.x % 2 === 0 && r.y % 2 === 0 && r.w % 2 === 0 && r.h % 2 === 0,
    ),
  ).toBe(true);
  expect(pixel(surface, 600, 360)).toBeUndefined();
});
it("Skipstone reflects away from a vertical defensive wall", () => {
  const state = createMatch(17);
  state.world = createWorld(Array(WIDTH).fill(570));
  state.terrain = Array(WIDTH).fill(570);
  state.wind = 0;
  state.tanks[0] = { ...state.tanks[0], x: 350, y: 570 };
  rectangle(state.world, 420, 70, 12, 500, MATERIAL.steel);
  const result = fire(state, 0, { angle: 0, power: 100, weapon: "bounce" });
  const path = result.paths[0];
  const contact = path.findIndex((p) => p.x >= 420);
  expect(contact).toBeGreaterThan(0);
  expect(path[contact + 1].x).toBeLessThan(path[contact].x);
  expect(path.slice(contact + 1).some((p) => p.x < 400)).toBe(true);
});
for (const kind of ["drill", "beam"] as const)
  it(`${kind} reveals a multi-point route only as its head reaches it`, () => {
    const surface = graphics();
    const event: WeaponEvent = {
      type: "effect",
      kind,
      time: 10,
      duration: 40,
      size: 10,
      points: [
        { x: 100, y: 200 },
        { x: 200, y: 300 },
        { x: 300, y: 200 },
      ],
    };
    drawReferenceEffects(surface.g, [event], 20, false);
    expect(
      surface.lines.every((p) => p[0] <= 150 && (p.length < 4 || p[2] <= 150)),
    ).toBe(true);
    if (kind === "drill")
      expect(surface.circles[0].slice(0, 2)).toEqual([150, 250]);
  });
it("Booster Worm's drill follows the exact projectile route", () => {
  const result = fire(createMatch(17), 0, {
    angle: 45,
    power: 60,
    weapon: "booster-worm",
  });
  const drill = result.events!.find(
    (e) => e.type === "effect" && e.kind === "drill",
  );
  expect(drill && drill.type === "effect" && drill.points).toEqual(
    result.paths[0],
  );
});

it("Booster Worm excavates a continuous corridor at each arrival tick", () => {
  const state = createMatch(17);
  state.terrain = Array(WIDTH).fill(300);
  state.world = createWorld(state.terrain);
  state.tanks[0].y = state.tanks[1].y = 300;
  const result = fire(state, 0, {
    angle: 45,
    power: 60,
    weapon: "booster-worm",
  });
  const world = structuredClone(state.world);
  for (let tick = 1; tick < result.paths[0].length; tick++) {
    for (const event of result.events!)
      if (event.type === "terrain" && event.time === tick)
        for (const [cell, material] of event.patch)
          world.cells[cell] = material;
    const point = result.paths[0][tick];
    if (point.y < 300) continue;
    const index = Math.floor(point.y / 6) * 200 + Math.floor(point.x / 6);
    expect(world.cells[index], `drill head at tick ${tick}`).toBe(MATERIAL.air);
  }
});

it("soil strata darken with depth instead of repeating bright stripes underground", () => {
  const surface = graphics();
  drawMaterialWorld(surface.g, createWorld(Array(WIDTH).fill(300)));
  let previousGreen = 255;
  for (let y = 300; y < 630; y += 6) {
    const fill = surface.rects.find(
      (r) => r.y === y && r.h === 6 && r.x <= 300 && r.x + r.w > 300,
    )!;
    const green = (fill.color >> 8) & 255;
    expect(green, `stratum at ${y}`).toBeLessThanOrEqual(previousGreen);
    previousGreen = green;
  }
});

it("a bending laser's white core follows the revealed route without a shortcut", () => {
  const paths: number[][][] = [];
  let current: number[][] = [];
  const g = {
    lineStyle() {},
    beginPath() {
      current = [];
    },
    moveTo(x: number, y: number) {
      current.push([x, y]);
    },
    lineTo(x: number, y: number) {
      current.push([x, y]);
    },
    strokePath() {
      paths.push(current);
    },
    lineBetween(x: number, y: number, tx: number, ty: number) {
      paths.push([
        [x, y],
        [tx, ty],
      ]);
    },
  } as unknown as Phaser.GameObjects.Graphics;
  drawReferenceEffects(
    g,
    [
      {
        type: "effect",
        kind: "beam",
        time: 0,
        duration: 40,
        size: 3,
        points: [
          { x: 100, y: 200 },
          { x: 200, y: 300 },
          { x: 300, y: 200 },
        ],
      },
    ],
    30,
    false,
  );
  expect(paths).toHaveLength(2);
  expect(paths[1]).toEqual(paths[0]);
});
