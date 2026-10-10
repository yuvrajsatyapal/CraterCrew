import { describe, it, expect } from "vitest";
import {
  createMatch,
  fire,
  move,
  WEAPONS,
  terrainAt,
  type WeaponId,
} from "../src/shared/game";

describe("deterministic artillery rules", () => {
  it("creates reproducible terrain and safely spaced tanks", () => {
    const a = createMatch(42);
    expect(a).toEqual(createMatch(42));
    expect(a.terrain).not.toEqual(createMatch(43).terrain);
    expect(a.tanks[0].x).toBeLessThan(a.tanks[1].x);
    expect(a.tanks[0].y).toBe(terrainAt(a.terrain, a.tanks[0].x));
  });
  it("resolves reproducible bounded shots without mutating the input", () => {
    const a = createMatch(42);
    const before = structuredClone(a);
    const result = fire(a, 0, { angle: 45, power: 60, weapon: "shell" });
    expect(a).toEqual(before);
    expect(result).toEqual(
      fire(a, 0, { angle: 45, power: 60, weapon: "shell" }),
    );
    expect(result.paths[0].length).toBeGreaterThan(2);
    expect(result.paths[0].length).toBeLessThanOrEqual(900);
    expect(result.state.turn).toBe(1);
    expect(result.state.revision).toBe(1);
  });
  it("rejects wrong turns, invalid values and unknown weapons", () => {
    const state = createMatch(1);
    expect(() =>
      fire(state, 1, { angle: 45, power: 50, weapon: "shell" }),
    ).toThrow();
    for (const angle of [NaN, Infinity, -1, 181])
      expect(() =>
        fire(state, 0, { angle, power: 50, weapon: "shell" }),
      ).toThrow();
    expect(() =>
      fire(state, 0, { angle: 45, power: 0, weapon: "shell" }),
    ).toThrow();
    expect(() =>
      fire(state, 0, { angle: 45, power: 50, weapon: "hack" as WeaponId }),
    ).toThrow();
  });
  it("deforms terrain and spends special ammunition", () => {
    const state = createMatch(5);
    const result = fire(state, 0, { angle: 90, power: 10, weapon: "heavy" });
    expect(result.state.terrain).not.toEqual(state.terrain);
    expect(result.state.tanks[0].ammo.heavy).toBe(
      state.tanks[0].ammo.heavy - 1,
    );
    expect(result.state.tanks[0].y).toBe(
      terrainAt(result.state.terrain, result.state.tanks[0].x),
    );
  });
  it("caps movement by fuel and enforces arena limits", () => {
    const state = createMatch(1);
    const moved = move(state, 0, 1);
    expect(moved.tanks[0].x).toBeGreaterThan(state.tanks[0].x);
    expect(moved.tanks[0].fuel).toBeLessThan(state.tanks[0].fuel);
    expect(() => move(state, 1, 1)).toThrow();
    state.tanks[0].fuel = 0;
    expect(() => move(state, 0, 1)).toThrow();
  });
  it("rejects empty ammunition and shots after victory", () => {
    const state = createMatch(1);
    state.tanks[0].ammo.heavy = 0;
    expect(() =>
      fire(state, 0, { angle: 45, power: 50, weapon: "heavy" }),
    ).toThrow();
    state.winner = 0;
    expect(() =>
      fire(state, 0, { angle: 45, power: 50, weapon: "shell" }),
    ).toThrow();
  });
  it("all six weapons produce finite bounded paths", () => {
    for (const weapon of WEAPONS) {
      const r = fire(createMatch(99), 0, {
        angle: 45,
        power: 80,
        weapon: weapon.id,
      });
      expect(r.paths.length).toBeLessThanOrEqual(7);
      expect(
        r.paths.every((path) =>
          path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
        ),
      ).toBe(true);
      expect(r.state.terrain.every((y) => y >= 70 && y <= 610)).toBe(true);
    }
  });
  it("repeated self hits leave tanks active until all volleys are spent", () => {
    let state = createMatch(2);
    for (let i = 0; i < 6; i++)
      state = fire(state, state.turn, {
        angle: 90,
        power: 10,
        weapon: "heavy",
      }).state;
    expect(state.winner).toBe(null);
    expect(state.tanks[0].points).toBeLessThan(0);
    expect(state.tanks[1].points).toBeLessThan(0);
  });
});

describe("shot presentation metadata", () => {
  it("carries the authoritative weapon and aim so the receiving player renders the same shot", () => {
    const shot = { angle: 90, power: 10, weapon: "digger" as const };
    const result = fire(createMatch(5), 0, shot);
    expect(JSON.parse(JSON.stringify(result)).shot).toEqual({
      angle: 90,
      power: 10,
      weapon: "digger",
    });
  });
});

it("saves each player's last submitted angle and power in match state", () => {
  const before = createMatch(42);
  const first = fire(before, 0, { angle: 73, power: 28, weapon: "shell" });
  const second = fire(first.state, 1, {
    angle: 110,
    power: 19,
    weapon: "shell",
  });
  expect(second.state.tanks[0]).toHaveProperty("lastAim", {
    angle: 73,
    power: 28,
  });
  expect(second.state.tanks[1]).toHaveProperty("lastAim", {
    angle: 110,
    power: 19,
  });
  expect(before.tanks[0]).not.toHaveProperty("lastAim");
});
