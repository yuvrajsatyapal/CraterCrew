import { expect, it } from "vitest";
import { WeaponReplay } from "../src/client/replay";
import type { WeaponEvent } from "../src/shared/weapon-timeline";

it("consumes each event once at its timestamp, preserving equal-time order", () => {
  const events: WeaponEvent[] = [
    { type: "aim", time: 8, player: 0, angle: 90 },
    { type: "terrain", time: 3, patch: [[1, 0]] },
    { type: "terrain", time: 3, patch: [[1, 2]] },
  ];
  const replay = new WeaponReplay(events);
  expect(replay.advance(2)).toEqual([]);
  expect(replay.advance(3)).toEqual(events.slice(1));
  expect(replay.advance(3.5)).toEqual([]);
  expect(replay.advance(20)).toEqual([events[0]]);
  expect(replay.advance(21)).toEqual([]);
  expect(events[0].time).toBe(8);
});

it("retains only active effects and the latest tank motion through frame skips", () => {
  const tank: WeaponEvent = {
    type: "tank",
    time: 5,
    player: 1,
    from: { x: 10, y: 20 },
    to: { x: 30, y: 40 },
    duration: 10,
    arc: 0,
    turns: 0,
  };
  const effect: WeaponEvent = {
    type: "effect",
    time: 6,
    duration: 3,
    points: [{ x: 10, y: 20 }],
    kind: "spark",
    size: 4,
  };
  const replay = new WeaponReplay([effect, tank]);
  replay.advance(4);
  expect(replay.tanks[1]).toBeUndefined();
  expect(replay.effects).toEqual([]);
  replay.advance(6);
  expect(replay.tanks[1]).toBe(tank);
  expect(replay.effects).toEqual([effect]);
  replay.advance(15);
  expect(replay.effects).toEqual([]);
  expect(replay.tanks[1]).toBe(tank); // Keep the final pose after landing.
});
