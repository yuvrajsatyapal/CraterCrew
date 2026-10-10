import { describe, it, expect } from "vitest";
describe("terrain-following movement", () => {
  it("keeps the moving tank on the intervening hill instead of cutting through it", async () => {
    const { drivePose } = await import("../src/client/motion");
    const ground = Array.from({ length: 1200 }, (_, x) =>
      x === 110 ? 260 : 300,
    );
    const pose = drivePose(
      { x: 100, y: 300, tilt: 0 },
      { x: 120, y: 300, tilt: 0 },
      0.5,
      ground,
    );
    expect(pose.x).toBe(110);
    expect(pose.y).toBe(260);
  });
});

describe("successive crater falls", () => {
  it("starts a fresh accelerating fall when another impact removes settled ground", async () => {
    const { fallStep } = await import("../src/client/motion");
    const first = fallStep(300, 310, 0, 0.2);
    expect(first).toEqual({ y: 310, velocity: 0 });
    const next = fallStep(first.y, 400, first.velocity, 0.05);
    const later = fallStep(next.y, 400, next.velocity, 0.05);
    expect(next.y).toBeGreaterThan(310);
    expect(next.y).toBeLessThan(320);
    expect(later.y - next.y).toBeGreaterThan(next.y - 310);
  });
});

it("driving under persistent overhangs follows pocket support and leaves stationary tanks in place", async () => {
  const { createWorld, circle, surfaceHeights, MATERIAL } =
    await import("../src/shared/materials");
  const { drivePose } = await import("../src/client/motion");
  const world = createWorld(Array(1200).fill(420));
  circle(world, 380, 140, 55, MATERIAL.foam);
  const surface = surfaceHeights(world),
    from = { x: 350, y: 420, tilt: 0 },
    to = { x: 370, y: 420, tilt: 0 };
  expect(drivePose(from, to, 0.5, surface, world).y).toBe(420);
  expect(drivePose(from, to, 1, surface, world).y).toBe(420);
  expect(drivePose(from, from, 0.5, surface, world)).toEqual(from);
});
