import { test as base, expect, type Page } from "@playwright/test";
import { WEAPONS, type WeaponId } from "../../src/shared/game";
import { createDraft } from "../../src/shared/weapon-draft";
import { REFERENCE_WEAPONS } from "../../src/shared/reference-weapons";

type Preferences = [WeaponId[], WeaponId[]];
const preferences = new WeakMap<Page, Preferences>();
const seeds = new Map<string, number>();
function preferred(file: string, title: string): Preferences {
  if (file.endsWith("weapon-audio.spec.ts"))
    return [
      ["neutron-beam", "heavy"],
      ["evac", "battery"],
    ];
  if (file.endsWith("hit-stream.spec.ts"))
    return [[title.includes("Reflex") ? "reflex-missile" : "neutron-beam"], []];
  if (file.endsWith("weapon-physics.spec.ts")) {
    if (title.includes("mixed"))
      return [["puzzle-box", "lava-flow"], ["heavy"]];
    if (title.includes("piercing"))
      return [
        ["nail-gun", "scatter"],
        ["reference-airburst", "airburst"],
      ];
    if (title.includes("pixel")) return [["heavy"], ["booster-worm"]];
    return [["lava-flow"], []];
  }
  if (file.endsWith("reference-weapons.spec.ts")) {
    const batch = /animation batch (\d+)/.exec(title);
    if (batch) {
      const ids = REFERENCE_WEAPONS.slice(
        (Number(batch[1]) - 1) * 8,
        Number(batch[1]) * 8,
      ).map((w) => w.id);
      return [
        ids.filter((_, i) => i % 2 === 0),
        ids.filter((_, i) => i % 2 === 1),
      ];
    }
    return [["concrete", "neutron-beam"], []];
  }
  if (file.endsWith("weapon-ui.spec.ts")) {
    if (title.includes("six weapon"))
      return [
        ["scatter", "digger"],
        ["heavy", "bounce", "airburst"],
      ];
    return [["heavy", "snow-cone", "icicles", "evac"], []];
  }
  if (title.includes("turbo-cannon")) return [["turbo-cannon"], []];
  if (title.includes("reflex-missile")) return [["reflex-missile"], []];
  return [["heavy"], []];
}
export const test = base.extend<{ draftPreparation: void }>({
  draftPreparation: [
    async ({ page }, use, info) => {
      const wanted = preferred(info.file, info.title);
      preferences.set(page, wanted);
      const ids = wanted.flat();
      const key = [...ids].sort().join(",");
      let seed = seeds.get(key);
      if (seed === undefined) {
        seed = 1;
        while (true) {
          const pool = createDraft(seed, 0).remaining;
          if (ids.every((id) => pool.includes(id))) break;
          if (++seed > 5_000_000)
            throw Error(`Could not find a real draft pool for ${key}`);
        }
        seeds.set(key, seed);
      }
      // Control only the random seed, then complete the real draft using UI buttons.
      await page.addInitScript((seed) => {
        const original = crypto.getRandomValues.bind(crypto);
        crypto.getRandomValues = function <T extends ArrayBufferView>(
          array: T,
        ): T {
          if (array instanceof Uint32Array && array.length === 1) {
            array[0] = seed;
            return array;
          }
          return original(array);
        };
      }, seed);
      await use();
    },
    { auto: true },
  ],
});
export { expect };
export type { Page } from "@playwright/test";
export async function finishDraft(page: Page) {
  await expect(page.locator("#weapon-draft-screen")).toBeVisible();
  if (await page.locator("#draft-random").count()) {
    await page.locator("#draft-random").click();
  } else {
    const wanted = preferences.get(page) ?? [[], []];
    for (let i = 0; i < 20; i++) {
      const buttons = page.locator("[data-draft-weapon]:enabled");
      const ids = await buttons.evaluateAll((rows) =>
        rows.map((row) => (row as HTMLElement).dataset.draftWeapon!),
      );
      const seat = i % 2;
      const chosen =
        wanted[seat].find((id) => ids.includes(id)) ??
        ids.find((id) => !wanted[1 - seat].includes(id as WeaponId))!;
      await page.locator(`[data-draft-weapon="${chosen}"]`).click();
    }
  }
  await expect(page.locator("canvas")).toBeVisible({ timeout: 20000 });
}
export async function finishOnlineDraft(first: Page, second: Page) {
  for (let i = 0; i < 20; i++) {
    const active = i % 2 === 0 ? first : second;
    await expect(active.locator("[data-draft-weapon]:enabled")).toHaveCount(
      20 - i,
    );
    await active.locator("[data-draft-weapon]:enabled").first().click();
  }
  await expect(first.locator("canvas")).toBeVisible();
  await expect(second.locator("canvas")).toBeVisible();
}
