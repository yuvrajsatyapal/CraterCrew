import { describe, expect, it } from "vitest";
import { arenaView } from "../src/client/arena-view";
import { WIDTH, HEIGHT } from "../src/shared/game";

describe("full-width arena camera", () => {
  for (const [width, height] of [
    [2560, 850],
    [1920, 810],
    [844, 230],
    [375, 544],
  ]) {
    it(`maps the playable edges to the screen edges in ${width} x ${height}`, () => {
      const view = arenaView(width, height);
      expect(view.zoom).toBeGreaterThan(0);
      expect(view.left).toBeCloseTo(0);
      expect(view.top).toBeLessThanOrEqual(0);
      expect(view.left + view.width).toBeCloseTo(WIDTH);
      expect(view.top + view.height).toBeCloseTo(HEIGHT);
      expect(view.width * view.zoomX).toBeCloseTo(width);
      expect(view.height * view.zoom).toBeCloseTo(height);
      expect(view.left + view.width / 2).toBeCloseTo(WIDTH / 2);
    });
  }
});
