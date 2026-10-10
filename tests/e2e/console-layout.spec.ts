import { finishDraft } from "./draft-fixture";
import { test, expect } from "./draft-fixture";

test("console stays compact and its modules fit without overlap", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();

  for (const viewport of [
    { width: 3396, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 781, height: 900 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 375, height: 812 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const panel = (await page.locator("#battle-controls").boundingBox())!;
    const modules = await Promise.all(
      [
        ".movement",
        ".weapon-picker",
        ".angle-module",
        ".power-module",
        "#fire",
      ].map((selector) => page.locator(selector).boundingBox()),
    );
    const fire = modules[4]!;
    expect(
      Math.abs(fire.x + fire.width / 2 - viewport.width / 2),
    ).toBeLessThanOrEqual(1);
    for (const box of modules.slice(0, 2)) {
      expect(box!.x + box!.width).toBeLessThanOrEqual(fire.x);
    }
    for (const box of modules.slice(2, 4)) {
      expect(box!.x).toBeGreaterThanOrEqual(fire.x + fire.width);
    }
    if (viewport.width >= 1280) {
      expect(
        panel.height,
        `console height at ${viewport.width}`,
      ).toBeLessThanOrEqual(150);
      for (const box of modules) {
        expect(
          box!.width,
          `module width at ${viewport.width}`,
        ).toBeLessThanOrEqual(360);
      }
    }
    for (const [index, box] of modules.entries()) {
      expect(box!.x).toBeGreaterThanOrEqual(panel.x);
      expect(box!.y).toBeGreaterThanOrEqual(panel.y);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panel.x + panel.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(panel.y + panel.height);
      for (const other of modules.slice(index + 1)) {
        const overlapX =
          Math.min(box!.x + box!.width, other!.x + other!.width) -
          Math.max(box!.x, other!.x);
        const overlapY =
          Math.min(box!.y + box!.height, other!.y + other!.height) -
          Math.max(box!.y, other!.y);
        expect(
          overlapX > 1 && overlapY > 1,
          `modules overlap at ${viewport.width}`,
        ).toBe(false);
      }
    }
    const ammo = (await page.locator("#ammo-label").boundingBox())!;
    expect(ammo.y + ammo.height).toBeLessThanOrEqual(panel.y + panel.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `test-results/console-layout-${viewport.width}.png`,
    });
  }
});
