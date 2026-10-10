import { describe, it, expect } from "vitest";
import { createMatch, WIDTH } from "../src/shared/game";
describe("mountain landscapes", () => {
  it("generates tall mountains instead of shallow repeating waves", () => {
    for (let seed = 1; seed < 15; seed++) {
      const t = createMatch(seed).terrain;
      expect(t.length).toBe(WIDTH);
      expect(Math.max(...t) - Math.min(...t)).toBeGreaterThan(180);
      expect(Math.min(...t)).toBeLessThan(280);
      expect(t.every((y) => y >= 70 && y <= 580)).toBe(true);
    }
  });
  it("changes both peak location and silhouette between matches", () => {
    const maps = [1, 2, 3, 4, 5].map((seed) => createMatch(seed).terrain);
    const peaks = maps.map((t) => t.indexOf(Math.min(...t)));
    expect(new Set(peaks).size).toBeGreaterThan(3);
    expect(maps[0]).not.toEqual(maps[1]);
  });
});
