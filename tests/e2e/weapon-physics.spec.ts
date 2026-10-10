import { expect, test } from "@playwright/test";
import type { Match } from "../../src/shared/game";

test("normal-motion Lava Flow stays grounded and completes the turn with honest scores", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "full");
    localStorage.setItem("cc-audio", "off");
  });
  await page.goto("/");
  await page.locator("#local-play").click();
  const match = () =>
    page.evaluate(
      () =>
        (window as unknown as { craterCrewDiagnostics: { match: Match } })
          .craterCrewDiagnostics.match,
    );
  const before = await match();
  await page.locator("#weapon-open").click();
  await page.locator('[data-weapon="lava-flow"]').click();
  for (const [control, value] of [
    ["angle", "90"],
    ["power", "10"],
  ]) {
    await page.locator(`#${control}-edit`).click();
    await page.locator(`#${control}`).fill(value);
    await page.locator("#aim-confirm").click();
  }
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
  const after = await match();
  expect(after.turn).toBe(1);
  expect(after.shots).toBe(1);
  expect(after.world!.cells).toContain(6);
  expect(Math.abs(after.tanks[0].y - before.tanks[0].y)).toBeLessThanOrEqual(6);
  expect(after.tanks[0].points).toBeLessThan(0);
  expect(after.tanks[1].points).toBe(0);
  await expect(page.locator("#score-0")).toHaveText(
    String(after.tanks[0].points),
  );
  await page.screenshot({ path: "docs/previews/lava-flow-repaired.png" });
});

test("consecutive mixed weapons preserve untouched land geometry and pixels", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "full");
    localStorage.setItem("cc-audio", "off");
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#local-play").click();
  await expect(page.locator("#fire")).toBeEnabled();
  const bounds = (await page.locator("canvas").boundingBox())!;
  const clip = {
    x: Math.round(bounds.x + bounds.width * 0.49),
    y: Math.round(bounds.y + bounds.height * 0.4),
    width: Math.floor(bounds.width * 0.02),
    height: Math.floor(bounds.height * 0.55),
  };
  const originalPixels = await page.screenshot({ clip });
  const original = await page.evaluate(
    () => (window as any).craterCrewDiagnostics.match as Match,
  );
  expect(original.world).toBeDefined();
  for (const [index, weapon] of [
    "puzzle-box",
    "shell",
    "lava-flow",
    "heavy",
  ].entries()) {
    await page.locator("#weapon-open").click();
    await page.locator(`[data-weapon="${weapon}"]`).click();
    for (const [control, value] of [
      ["angle", "90"],
      ["power", "10"],
    ]) {
      await page.locator(`#${control}-edit`).click();
      await page.locator(`#${control}`).fill(value);
      await page.locator("#aim-confirm").click();
    }
    await page.locator("#fire").click();
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
    const after = await page.evaluate(
      () => (window as any).craterCrewDiagnostics.match as Match,
    );
    expect(after.shots).toBe(index + 1);
    expect(after.terrain.slice(588, 612)).toEqual(
      original.terrain.slice(588, 612),
    );
    expect(await page.screenshot({ clip })).toEqual(originalPixels);
    for (const player of [0, 1])
      await expect(page.locator(`#score-${player}`)).toHaveText(
        String(after.tanks[player].points),
      );
  }
  await page.screenshot({
    path: "docs/previews/weapon-continuity-repaired.png",
  });
  expect(errors).toEqual([]);
});

test("repaired piercing, airburst and scatter playback completes with authoritative scores", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "reduced");
    localStorage.setItem("cc-audio", "off");
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#local-play").click();
  for (const [index, weapon] of [
    "nail-gun",
    "reference-airburst",
    "scatter",
    "airburst",
  ].entries()) {
    await page.locator("#weapon-open").click();
    await page.locator(`[data-weapon="${weapon}"]`).click();
    await page.locator("#fire").click();
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
    const match = await page.evaluate(
      () => (window as any).craterCrewDiagnostics.match as Match,
    );
    expect(match.shots).toBe(index + 1);
    for (const player of [0, 1])
      await expect(page.locator(`#score-${player}`)).toHaveText(
        String(match.tanks[player].points),
      );
  }
  expect(errors).toEqual([]);
});

test("pixel terrain preserves surviving dirt under an impact and Booster Worm completes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "full");
    localStorage.setItem("cc-audio", "off");
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#local-play").click();
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("canvas")).toHaveCSS(
    "image-rendering",
    "pixelated",
  );
  const before = await page.evaluate(
    () =>
      (window as unknown as { craterCrewDiagnostics: { match: Match } })
        .craterCrewDiagnostics.match,
  );
  const bounds = (await page.locator("canvas").boundingBox())!;
  const clip = {
    x: Math.ceil(bounds.x + ((before.tanks[0].x + 6) / 1200) * bounds.width),
    y: Math.ceil(bounds.y + (624 / 640) * bounds.height),
    width: Math.max(1, Math.floor((6 / 1200) * bounds.width)),
    height: Math.max(1, Math.floor((12 / 640) * bounds.height)),
  };
  const dirtBefore = await page.screenshot({ clip });
  for (const [index, weapon] of ["heavy", "booster-worm"].entries()) {
    await page.locator("#weapon-open").click();
    await page.locator(`[data-weapon="${weapon}"]`).click();
    for (const [control, value] of [
      ["angle", "90"],
      ["power", "10"],
    ]) {
      await page.locator(`#${control}-edit`).click();
      await page.locator(`#${control}`).fill(value);
      await page.locator("#aim-confirm").click();
    }
    await page.locator("#fire").click();
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
    const after = await page.evaluate(
      () =>
        (window as unknown as { craterCrewDiagnostics: { match: Match } })
          .craterCrewDiagnostics.match,
    );
    expect(after.shots).toBe(index + 1);
    for (const player of [0, 1])
      await expect(page.locator(`#score-${player}`)).toHaveText(
        String(after.tanks[player].points),
      );
    if (index === 0)
      expect(await page.screenshot({ clip })).toEqual(dirtBefore);
  }
  await page.screenshot({ path: "docs/previews/pixel-terrain-repaired.png" });
  expect(errors).toEqual([]);
});
