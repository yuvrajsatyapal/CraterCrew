import { describe, expect, it } from "vitest";
import {
  createWorld,
  getCell,
  circle,
  line,
  supportY,
  surfaceHeights,
  MATERIAL,
  WORLD_CELLS,
} from "../src/shared/materials";
describe("material terrain", () => {
  it("supports enclosed tunnels and floating blocks after a JSON round trip", () => {
    const world = createWorld(Array(1200).fill(300));
    circle(world, 600, 420, 24, MATERIAL.air);
    circle(world, 600, 120, 18, MATERIAL.foam);
    const copy = JSON.parse(JSON.stringify(world));
    expect(getCell(copy, 600, 420)).toBe(MATERIAL.air);
    expect(getCell(copy, 600, 350)).toBe(MATERIAL.dirt);
    expect(getCell(copy, 600, 120)).toBe(MATERIAL.foam);
    expect(supportY(copy, 600, 420)).toBeGreaterThanOrEqual(438);
    expect(surfaceHeights(copy)[600]).toBeLessThan(150);
    expect(copy.cells).toHaveLength(WORLD_CELLS);
  });
  it("cuts connected tunnels and safely bounds writes at screen edges", () => {
    const world = createWorld(Array(1200).fill(300));
    line(world, { x: -100, y: 450 }, { x: 1400, y: 450 }, 12, MATERIAL.air);
    expect(getCell(world, 20, 450)).toBe(MATERIAL.air);
    expect(getCell(world, 600, 450)).toBe(MATERIAL.air);
    expect(getCell(world, 600, 480)).toBe(MATERIAL.dirt);
    expect(world.cells).toHaveLength(WORLD_CELLS);
    expect(getCell(world, -1, 450)).toBe(MATERIAL.air);
  });
});
