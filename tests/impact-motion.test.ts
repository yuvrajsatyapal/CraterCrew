import { describe, expect, it } from "vitest";
import { impactTerrain } from "../src/client/motion";

describe("individual projectile impacts", () => {
  const before = Array(1200).fill(300);
  const blasts = [
    { x: 100, y: 300, radius: 30, damage: 20, pathIndex: 0 },
    { x: 800, y: 300, radius: 40, damage: 20, pathIndex: 1 },
  ];
  it("opens the first crater before the second projectile lands", () => {
    const terrain = impactTerrain(before, blasts, [10, 80], 18);
    expect(terrain[100]).toBeGreaterThan(300);
    expect(terrain[800]).toBe(300);
    expect(before[100]).toBe(300);
  });
  it("does not change the ground before collision", () => {
    expect(impactTerrain(before, blasts, [10, 80], 9)).toEqual(before);
  });
});

it("finishes a digger crater at the exact authoritative depth", async () => {
  const { createMatch, fire } = await import("../src/shared/game");
  const before = createMatch(5);
  delete before.world; // Exercise the supported legacy height-only replay.
  const result = fire(before, 0, { angle: 90, power: 10, weapon: "digger" });
  const surface = impactTerrain(
    before.terrain,
    result.blasts,
    result.paths.map((p) => p.length),
    10000,
    true,
  );
  expect(surface).toEqual(result.state.terrain);
});

it("invalidates a nearly complete crater so the final ground is drawn", async () => {
  const { impactKey } = await import("../src/client/motion");
  const blasts = [{ x: 100, y: 300, radius: 30, damage: 20, pathIndex: 0 }];
  expect(impactKey(blasts, [10], 15.6)).not.toBe(impactKey(blasts, [10], 16));
  expect(impactKey(blasts, [10], 16)).toBe(impactKey(blasts, [10], 50));
});
