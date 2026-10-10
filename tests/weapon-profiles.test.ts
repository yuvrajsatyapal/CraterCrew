import { expect, it, vi } from "vitest";
import { Simulation } from "../src/shared/weapon-engine";
import { createMatch, fire, WEAPONS } from "../src/shared/game";
import { WEAPON_PROFILES } from "../src/client/weapon-profiles";

it("covers every selectable weapon with varied, bounded power recommendations", () => {
  expect(Object.keys(WEAPON_PROFILES).sort()).toEqual(
    WEAPONS.map((w) => w.id).sort(),
  );
  const powers = new Set<number>();
  for (const weapon of WEAPONS) {
    const profile = WEAPON_PROFILES[weapon.id];
    expect(profile.damage.length).toBeGreaterThan(0);
    if (typeof profile.power === "number") {
      expect(profile.power).toBeGreaterThanOrEqual(10);
      expect(profile.power).toBeLessThanOrEqual(100);
      powers.add(profile.power);
    }
  }
  expect(powers.size).toBeGreaterThanOrEqual(6);
});

for (const id of [
  "icicles",
  "six-shooter",
  "flying-wall",
  "barbed-wire",
  "puzzle-box",
  "howitzer",
] as const)
  it(`${id} displays the damage actually configured in its attacks`, () => {
    const blast = vi.spyOn(Simulation.prototype, "blast");
    try {
      fire(createMatch(17), 0, { weapon: id, angle: 90, power: 10 });
      // Some delayed/terrain attacks render effect events instead of projectile
      // blasts. Inspect the real resolver's damage arguments for both cases.
      const amounts = blast.mock.calls.map((call) => call[3]);
      expect(new Set(amounts).size).toBe(1);
      const expected =
        amounts.length === 1
          ? `${amounts[0]}`
          : `${amounts.length} × ${amounts[0]}`;
      expect(WEAPON_PROFILES[id].damage).toBe(expected);
    } finally {
      blast.mockRestore();
    }
  });

it("automatic defensive and teleport weapons promise no direct damage", () => {
  for (const id of [
    "snow-cone",
    "bridge",
    "bouncy-blocker",
    "evac",
    "foundation",
    "retreat",
  ] as const) {
    expect(WEAPON_PROFILES[id].power).toBe("automatic");
    expect(WEAPON_PROFILES[id].damage).toMatch(/^0 · /);
    const result = fire(createMatch(17), 0, {
      weapon: id,
      angle: 45,
      power: 60,
    });
    expect(result.blasts).toHaveLength(0);
    expect(
      result.events!.filter((e) => e.type === "damage" && e.kind === "hit"),
    ).toHaveLength(0);
  }
});
