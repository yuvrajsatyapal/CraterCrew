import { finishDraft } from "./draft-fixture";
import { REFERENCE_WEAPONS } from "../../src/shared/reference-weapons";
import { test, expect } from "./draft-fixture";
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
  { width: 844, height: 390 },
])
  test(`reference arsenal search, icons and filters at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#local-play").click();
    await finishDraft(page);
    await page.locator("#weapon-open").click();
    await expect(page.locator(".arsenal-weapon")).toHaveCount(85);
    await page
      .getByRole("searchbox", { name: "Search weapons" })
      .fill("concrete");
    await expect(page.locator(".arsenal-weapon:visible")).toHaveCount(1);
    await page
      .getByRole("combobox", { name: "Weapon pack" })
      .selectOption("Booster");
    await expect(page.locator(".arsenal-weapon:visible")).toHaveCount(1);
    await page.locator('[data-weapon="concrete"]').click();
    await expect(page.locator("#weapon-name")).toHaveText("Concrete");
    await page.locator("#weapon-open").click();
    await page.getByRole("searchbox", { name: "Search weapons" }).fill("");
    await page
      .getByRole("combobox", { name: "Weapon pack" })
      .selectOption("all");
    await expect(page.locator(".arsenal-weapon:visible")).toHaveCount(11);
    await page.locator('[data-weapon="neutron-beam"]').scrollIntoViewIfNeeded();
    await expect(page.locator("#weapon-dialog .dialog-close")).toBeInViewport();
    await page.screenshot({
      path: `test-results/reference-arsenal-${viewport.width}.png`,
    });
    await expect
      .poll(async () =>
        page
          .locator('[data-weapon="neutron-beam"] img')
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.locator('[data-weapon="neutron-beam"]').click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
for (let batch = 0; batch < 10; batch++)
  test(`reference weapon animation batch ${batch + 1}`, async ({ page }) => {
    test.setTimeout(240000); // Eight per-weapon waits plus UI interactions on busy hosts.
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem("cc-motion", "reduced");
      localStorage.setItem("cc-audio", "off");
    });
    await page.goto("/");
    await page.locator("#local-play").click();
    await finishDraft(page);
    for (const [i, weapon] of REFERENCE_WEAPONS.slice(
      batch * 8,
      batch * 8 + 8,
    ).entries())
      await test.step(weapon.name, async () => {
        await expect(page.locator("#fire"), weapon.id).toBeEnabled({
          timeout: 15000,
        });
        await page.locator("#weapon-open").click();
        await page.locator(`[data-weapon="${weapon.id}"]`).click();
        await page.locator("#fire").click();
        await expect(page.locator("#fire"), weapon.id).toBeEnabled({
          timeout: 15000,
        });
        const m = await page.evaluate(
          () => (window as any).craterCrewDiagnostics.match,
        );
        expect(m.shots, weapon.id).toBe(i + 1);
        for (const p of [0, 1])
          await expect(page.locator(`#score-${p}`)).toHaveText(
            String(m.tanks[p].points),
          );
      });
    expect(errors).toEqual([]);
  });
