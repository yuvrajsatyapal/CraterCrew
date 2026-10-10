import { expect, it } from "vitest";
import type Phaser from "phaser";
import { drawMaterialWorld } from "../src/client/reference-effects";
import { drawFlight } from "../src/client/weapon-effects";
import { createWorld } from "../src/shared/materials";

it("material terrain shades hills by local depth instead of horizontal screen stripes", () => {
  let color = 0;
  const rectangles: { x: number; y: number; width: number; color: number }[] =
    [];
  const g = {
    clear() {},
    fillStyle(tint: number) {
      color = tint;
    },
    fillRect(x: number, y: number, width: number) {
      rectangles.push({ x, y, width, color });
    },
  } as unknown as Phaser.GameObjects.Graphics;
  drawMaterialWorld(
    g,
    createWorld(Array.from({ length: 1200 }, (_, x) => (x < 600 ? 300 : 420))),
  );
  const tintAt = (x: number, y: number) =>
    rectangles.find((r) => r.y === y && r.x <= x && r.x + r.width > x)!.color;
  expect(tintAt(300, 342)).toBe(tintAt(900, 462));
  expect(tintAt(300, 342)).not.toBe(tintAt(300, 348));
});

it("a wrapped projectile never draws a trail across the entire battlefield", () => {
  const segments: number[][] = [];
  let previous = [0, 0];
  const g = {
    lineStyle() {},
    beginPath() {},
    strokePath() {},
    fillStyle() {},
    fillCircle() {},
    moveTo(x: number, y: number) {
      previous = [x, y];
    },
    lineTo(x: number, y: number) {
      segments.push([...previous, x, y]);
      previous = [x, y];
    },
  } as unknown as Phaser.GameObjects.Graphics;
  drawFlight(
    g,
    [
      { x: 1180, y: 200 },
      { x: 1195, y: 201 },
      { x: 10, y: 202 },
      { x: 25, y: 203 },
    ],
    3,
    0,
    "warp-gate",
    false,
  );
  expect(segments.every(([x, , nextX]) => Math.abs(x - nextX) < 600)).toBe(
    true,
  );
  expect(segments).toHaveLength(0);
});

it("projectile heads interpolate between physics samples", () => {
  const circles: number[][] = [];
  const g = {
    lineStyle() {},
    beginPath() {},
    strokePath() {},
    fillStyle() {},
    moveTo() {},
    lineTo() {},
    fillCircle(...args: number[]) {
      circles.push(args);
    },
  } as unknown as Phaser.GameObjects.Graphics;
  drawFlight(
    g,
    [
      { x: 100, y: 200 },
      { x: 120, y: 210 },
    ],
    0.5,
    0,
    "shell",
    false,
  );
  expect(circles[0].slice(0, 2)).toEqual([110, 205]);
});

for (const weapon of [
  "shell",
  "heavy",
  "scatter",
  "bounce",
  "digger",
  "airburst",
  "gamma-goo",
  "warp-gate",
] as const) {
  for (const reduced of [false, true]) {
    it(`${weapon} draws a colored moving head without a flight line (reduced=${reduced})`, () => {
      let tint = 0;
      const heads: { x: number; y: number; tint: number }[] = [];
      const segments: number[][] = [];
      const g = {
        lineStyle() {},
        beginPath() {},
        moveTo() {},
        strokePath() {},
        strokeCircle() {},
        lineTo(...point: number[]) {
          segments.push(point);
        },
        fillStyle(color: number) {
          tint = color;
        },
        fillCircle(x: number, y: number) {
          heads.push({ x, y, tint });
        },
        fillTriangle(x: number, y: number) {
          heads.push({ x, y, tint });
        },
      } as unknown as Phaser.GameObjects.Graphics;
      drawFlight(
        g,
        [
          { x: 100, y: 200 },
          { x: 120, y: 210 },
          { x: 140, y: 220 },
        ],
        1.5,
        0,
        weapon,
        reduced,
      );
      expect(segments).toEqual([]);
      expect(
        heads.some(
          (h) =>
            h.tint !== 0xffffff &&
            Math.abs(h.x - 130) <= 7 &&
            Math.abs(h.y - 215) <= 7,
        ),
      ).toBe(true);
    });
  }
}

it("draws visible feedback at the exact collision frame", async () => {
  const { drawBlast } = await import("../src/client/weapon-effects");
  for (const reduced of [false, true]) {
    const circles: number[][] = [];
    const g = {
      fillStyle() {},
      lineStyle() {},
      strokeCircle() {},
      fillRect() {},
      fillCircle(...args: number[]) {
        circles.push(args);
      },
    } as unknown as Phaser.GameObjects.Graphics;
    drawBlast(
      g,
      { x: 123, y: 345, radius: 30, damage: 20, pathIndex: 0 },
      0,
      "shell",
      0,
      reduced,
    );
    expect(
      circles.some(([x, y, radius]) => x === 123 && y === 345 && radius >= 3),
    ).toBe(true);
  }
});
