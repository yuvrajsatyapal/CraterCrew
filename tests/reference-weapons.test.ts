import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { WEAPONS } from "../src/shared/game";
const inventory = JSON.parse(
  readFileSync("docs/weapon-study/sources.json", "utf8"),
) as { id: string; icon: string }[];
it("makes every unique source-listed weapon selectable with its matching icon", () => {
  expect(WEAPONS).toHaveLength(85);
  for (const item of inventory) {
    const weapon = WEAPONS.find((w) => w.id === item.id);
    expect(weapon, item.id).toBeDefined();
    expect(existsSync(`public${item.icon}`)).toBe(true);
  }
  expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(85);
});
it("deduplicates Concrete and preserves both pack memberships", () => {
  const entries = WEAPONS.filter((w) => w.name === "Concrete");
  expect(entries).toHaveLength(1);
  expect((entries[0] as unknown as { packs: string[] }).packs).toEqual([
    "Gamma",
    "Booster",
  ]);
});
