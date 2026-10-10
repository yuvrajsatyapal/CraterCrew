import { describe, expect, it } from "vitest";
import { createMatch, fire } from "../src/shared/game";
import { scoreEvents, visibleFlightPaths } from "../src/client/feedback";

describe("collision score feedback", () => {
  it("attributes individual hits at their collision time and conserves damage including falls", () => {
    const before = createMatch(5);
    for (const weapon of [
      "shell",
      "heavy",
      "scatter",
      "bounce",
      "digger",
      "airburst",
    ] as const) {
      const result = fire(before, 0, { angle: 90, power: 10, weapon });
      const events = scoreEvents(before, result);
      for (const player of [0, 1] as const) {
        expect(
          events
            .filter((e) => e.player === player)
            .reduce((sum, e) => sum + e.amount, 0),
        ).toBe(result.damage[player]);
      }
      expect(events.every((e) => e.amount > 0)).toBe(true);
      for (const event of events.filter((e) => e.kind === "hit")) {
        expect(result.blasts.some((b) => b.time === event.time)).toBe(true);
      }
    }
  });
  it("preserves separate multi-hit collisions and delays the fall remainder", () => {
    const before = createMatch(5);
    before.tanks[0].x = 100;
    before.tanks[0].y = 300;
    before.tanks[1].x = 800;
    before.tanks[1].y = 300;
    const result = {
      shot: { angle: 45, power: 60, weapon: "scatter" as const },
      state: structuredClone(before),
      paths: [
        Array(10).fill({ x: 800, y: 290 }),
        Array(80).fill({ x: 800, y: 290 }),
      ],
      blasts: [
        { x: 800, y: 290, radius: 30, damage: 20, pathIndex: 0 },
        { x: 800, y: 290, radius: 30, damage: 20, pathIndex: 1 },
      ],
      damage: [0, 47] as [number, number],
    };
    expect(scoreEvents(before, result)).toEqual([
      { player: 1, amount: 20, time: 10, kind: "hit" },
      { player: 1, amount: 20, time: 80, kind: "hit" },
      { player: 1, amount: 7, time: 86, kind: "fall" },
    ]);
    result.blasts = [];
    result.damage = [0, 0];
    expect(scoreEvents(before, result)).toEqual([]);
  });
});

it("draws the airburst parent once before splitting into six separate fragments", () => {
  const result = fire(createMatch(9), 0, {
    angle: 60,
    power: 60,
    weapon: "airburst",
  });
  const split = result.paths[0].length;
  expect(visibleFlightPaths(result, split - 2)).toHaveLength(1);
  const fragments = visibleFlightPaths(result, split + 2);
  expect(fragments).toHaveLength(6);
  expect(fragments.every((p) => p.startIndex >= split - 1)).toBe(true);
});

it("gives hit tags a full lifetime even after the shot ends", async () => {
  const { popupProgress } = await import("../src/client/feedback");
  expect(popupProgress(1000, 999)).toBe(0);
  expect(popupProgress(1000, 1900)).toBeCloseTo(0.375);
  expect(popupProgress(1000, 3400)).toBe(1);
});

it("shows plain white hit values and a minus only for self-hit penalties", async () => {
  const { scoreTagText } = await import("../src/client/feedback");
  expect(scoreTagText(20, false)).toBe("20");
  expect(scoreTagText(20, true)).toBe("−20");
});

it("starts at the tank and rises at constant size without a lane fan", async () => {
  const { popupPose } = await import("../src/client/feedback");
  const start = popupPose({ x: 400, y: 400 }, 0, 0, false);
  expect(start.x).toBe(400);
  expect(start.y).toBe(382);
  for (const progress of [0, 0.2, 0.5, 0.9]) {
    const pose = popupPose({ x: 400, y: 400 }, progress, 0, false);
    expect(pose.scale).toBe(1);
    expect(pose.y).toBeLessThanOrEqual(start.y);
    expect(Math.abs(pose.x - 400)).toBeLessThanOrEqual(12);
  }
  expect(popupPose({ x: 400, y: 400 }, 0.5, 1, false).x).not.toBe(
    popupPose({ x: 400, y: 400 }, 0.5, 0, false).x,
  );
  expect(popupPose({ x: 400, y: 400 }, 0.5, 0, true).y).toBe(377);
  expect(popupPose({ x: 1198, y: 10 }, 0.5, 0, false).x).toBeLessThanOrEqual(
    1180,
  );
  expect(popupPose({ x: 10, y: 10 }, 1, 0, false).y).toBeGreaterThanOrEqual(18);
  expect(popupPose({ x: 400, y: 400 }, 1, 0, false).alpha).toBe(0);
});

it("removes a projectile exactly when its timestamped impact starts", () => {
  const result = fire(createMatch(17), 0, {
    angle: 90,
    power: 10,
    weapon: "puzzle-box",
  });
  const end = result.paths[0].length - 1;
  expect(visibleFlightPaths(result, end - 0.1)).toHaveLength(1);
  expect(visibleFlightPaths(result, end)).toHaveLength(0);
});

it("legacy hit feedback uses the authoritative blast time", () => {
  const before = createMatch(5);
  delete before.world;
  const result = fire(before, 0, { angle: 90, power: 10, weapon: "heavy" });
  const hits = scoreEvents(before, result).filter(
    (event) => event.kind === "hit",
  );
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0].time).toBe(result.blasts[0].time);
});
