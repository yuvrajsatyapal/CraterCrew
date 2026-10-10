import { expect, it } from "vitest";
import type Phaser from "phaser";
import { WEAPONS } from "../src/shared/game";
import { soundCue, effectSoundCue } from "../src/client/sound";
import { WeaponReplay } from "../src/client/replay";
import { drawReferenceEffects } from "../src/client/reference-effects";
import { drawBlast } from "../src/client/weapon-effects";

it("uses weapon-specific acoustic envelopes for the whole playable arsenal", () => {
  expect(soundCue).toBeTypeOf("function");
  for (const weapon of WEAPONS) {
    const cue = soundCue("impact", weapon.id);
    expect(cue.duration).toBeGreaterThan(0);
    expect(cue.duration).toBeLessThanOrEqual(1.2);
    expect(cue.frequency).toBeGreaterThan(0);
  }
  const laser = soundCue("impact", "neutron-beam");
  const water = soundCue("impact", "flash-flood");
  const drill = soundCue("impact", "boring-missiles");
  expect(laser).not.toEqual(water);
  expect(drill).not.toEqual(laser);
  expect(soundCue("fire", "heavy").frequency).toBeLessThan(
    soundCue("fire", "shell").frequency,
  );
});

it("dispatches special effect sound once at onset and discards expired cues after stalls", () => {
  expect(effectSoundCue).toBeTypeOf("function");
  const replay = new WeaponReplay([
    {
      type: "effect",
      kind: "electric",
      time: 10,
      duration: 20,
      size: 25,
      points: [{ x: 100, y: 200 }],
    },
    {
      type: "effect",
      kind: "portal",
      time: 50,
      duration: 12,
      size: 25,
      points: [{ x: 100, y: 200 }],
    },
  ]);
  expect(
    replay.advance(9).flatMap((e) => effectSoundCue(e, "battery", 9) ?? []),
  ).toEqual([]);
  const cues = replay
    .advance(10)
    .flatMap((e) => effectSoundCue(e, "battery", 10) ?? []);
  expect(cues).toHaveLength(1);
  expect(cues[0].wave).toBe("sawtooth");
  expect(replay.advance(11)).toEqual([]);
  expect(
    replay.advance(80).flatMap((e) => effectSoundCue(e, "battery", 80) ?? []),
  ).toEqual([]);
});

function graphics() {
  const circles: number[][] = [];
  const g = {
    fillStyle() {},
    lineStyle() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    strokePath() {},
    lineBetween() {},
    fillRect() {},
    fillCircle(...args: number[]) {
      circles.push(args);
    },
    strokeCircle(...args: number[]) {
      circles.push(args);
    },
  } as unknown as Phaser.GameObjects.Graphics;
  return { g, circles };
}

for (const kind of ["electric", "wave"] as const) {
  for (const reduced of [false, true]) {
    it(`renders a visible single-point ${kind} effect (reduced=${reduced})`, () => {
      const { g, circles } = graphics();
      drawReferenceEffects(
        g,
        [
          {
            type: "effect",
            kind,
            time: 10,
            duration: 20,
            size: 30,
            points: [{ x: 120, y: 200 }],
          },
        ],
        15,
        reduced,
      );
      expect(
        circles.some(([x, y, radius]) => x === 120 && y === 200 && radius > 0),
      ).toBe(true);
    });
  }
}

it("keeps beam collision feedback compact instead of drawing an explosive fireball", () => {
  const { g, circles } = graphics();
  drawBlast(
    g,
    { x: 120, y: 200, radius: 60, damage: 20, pathIndex: 0 },
    0.5,
    "neutron-beam",
    0,
    false,
  );
  expect(circles.length).toBeGreaterThan(0);
  expect(circles.every(([, , radius]) => radius <= 18)).toBe(true);
});

it("renders reference drilling impacts as excavation jets", () => {
  const { g } = graphics();
  let jets = 0;
  g.fillTriangle = () => {
    jets++;
    return g;
  };
  drawBlast(
    g,
    { x: 120, y: 200, radius: 30, damage: 20, pathIndex: 0 },
    0.5,
    "boring-missiles",
    0,
    false,
  );
  expect(jets).toBeGreaterThan(0);
});

it("caps effect audio to the remaining visual lifetime at reduced replay speed", () => {
  const event = {
    type: "effect",
    kind: "drill",
    time: 10,
    duration: 20,
    size: 25,
    points: [{ x: 100, y: 200 }],
  } as const;
  expect(
    effectSoundCue({ ...event, points: [...event.points] }, "digger", 15, 5)
      ?.duration,
  ).toBeLessThanOrEqual(0.075);
});
