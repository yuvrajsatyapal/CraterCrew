import { finishOnlineDraft } from "./draft-fixture";
import type { Match, WeaponId } from "../../src/shared/game";
import { test, expect } from "@playwright/test";

test("drafted reference weapon synchronizes both online players", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const first = await a.newPage();
    const second = await b.newPage();
    for (const page of [first, second])
      await page.addInitScript(() => {
        localStorage.setItem("cc-motion", "reduced");
        localStorage.setItem("cc-audio", "off");
      });
    await first.goto("/");
    await first.locator("#online-play").click();
    await first.locator("#create-room").click();
    await expect(first.locator(".room-code")).toBeVisible();
    const code = await first.locator(".room-code").textContent();
    await first.locator("#ready").click();
    await second.goto(`/?room=${code}`);
    await second.locator("#join-room").click();
    await second.locator("#ready").click();
    const chosen = await first
      .locator("[data-draft-weapon]")
      .first()
      .getAttribute("data-draft-weapon");
    await finishOnlineDraft(first, second);
    await expect(first.locator("#fire")).toBeEnabled();
    await first.locator("#weapon-open").click();
    await first.getByRole("searchbox", { name: "Search weapons" }).fill("");
    await first.locator(`[data-weapon="${chosen}"]`).click();
    await first.locator("#fire").click();
    await expect(second.locator("#fire")).toBeEnabled({ timeout: 20000 });
    const state = async (page: typeof first) =>
      page.evaluate(
        () =>
          (window as unknown as { craterCrewDiagnostics: { match: Match } })
            .craterCrewDiagnostics.match,
      );
    const authoritative = await state(first);
    expect(authoritative.shots).toBe(1);
    expect(authoritative.tanks[0].ammo[chosen as WeaponId]).toBe(2);
    expect(authoritative.world).toBeDefined();
    await expect.poll(() => state(second)).toEqual(authoritative);
    for (const page of [first, second])
      for (const player of [0, 1])
        await expect(page.locator(`#score-${player}`)).toHaveText(
          String(authoritative.tanks[player].points),
        );
    await second.locator("#fire").click();
    await expect(first.locator("#fire")).toBeEnabled({ timeout: 20000 });
    expect((await state(first)).shots).toBe(2);
    await expect.poll(() => state(second)).toEqual(await state(first));
  } finally {
    await a.close();
    await b.close();
  }
});
