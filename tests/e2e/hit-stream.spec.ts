import { finishDraft } from "./draft-fixture";
import { test, expect } from "./draft-fixture";
test("normal-motion multi-hit numbers appear with progressive score and finish at the authoritative total", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "full");
    localStorage.setItem("cc-audio", "off");
  });
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await page.locator("#weapon-open").click();
  await page.locator('[data-weapon="neutron-beam"]').click();
  await page.locator("#fire").click();
  await expect
    .poll(async () => Number(await page.locator("#score-0").textContent()))
    .toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/reference-hit-stream.png" });
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 10000 });
  const m = await page.evaluate(
    () => (window as any).craterCrewDiagnostics.match,
  );
  await expect(page.locator("#score-0")).toHaveText(String(m.tanks[0].points));
  expect(m.tanks[0].points).toBe(63);
});

test("manual aiming remains available after Reflex Missile auto-alignment", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "reduced");
    localStorage.setItem("cc-audio", "off");
  });
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await page.locator("#weapon-open").click();
  await page.locator('[data-weapon="reflex-missile"]').click();
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
  await page.locator("#angle-edit").click();
  await page.locator("#angle").fill("90");
  await page.locator("#aim-confirm").click();
  await page.locator("#power-edit").click();
  await page.locator("#power").fill("10");
  await page.locator("#aim-confirm").click();
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
  await expect(page.locator("#angle-value")).toHaveText("90°");
});
