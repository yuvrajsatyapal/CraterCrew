import { finishDraft, finishOnlineDraft } from "./draft-fixture";
import { test, expect, type Page } from "./draft-fixture";
import type { Match } from "../../src/shared/game";
interface Diagnostics {
  mode: string;
  match: Match;
  busy: boolean;
  player: number;
  fps: number | null;
}
async function diagnostics(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { craterCrewDiagnostics: Diagnostics })
        .craterCrewDiagnostics,
  );
}
async function progress(page: Page) {
  return page.evaluate(() => {
    const { match, busy } = (
      window as unknown as { craterCrewDiagnostics: Diagnostics }
    ).craterCrewDiagnostics;
    return {
      turn: match.turn,
      shots: match.shots,
      revision: match.revision,
      winner: match.winner,
      busy,
    };
  });
}
async function instantFX(page: Page) {
  await page.addInitScript(() => localStorage.setItem("cc-motion", "reduced"));
}

async function setAim(page: Page, control: "angle" | "power", value: string) {
  if (
    (await page.locator(`#${control}-value`).textContent()) ===
    `${value}${control === "angle" ? "°" : "%"}`
  )
    return;
  await page.locator(`#${control}-edit`).click();
  await page.locator(`#${control}`).fill(value);
  await page.locator("#aim-confirm").click();
}

// Full-match tests use the visible fine-step buttons in one browser task.
// Dedicated aiming tests separately exercise every ruler/open/confirm interaction.
async function setAimInline(
  page: Page,
  control: "angle" | "power",
  value: number,
) {
  const displayed = await page.locator(`#${control}-down`).evaluate(
    (_, { control, value }) => {
      const output = document.querySelector(`#${control}-value`)!;
      const current = Number.parseInt(output.textContent!);
      const button = document.querySelector<HTMLButtonElement>(
        `#${control}-${current > value ? "down" : "up"}`,
      )!;
      for (let i = 0; i < Math.abs(current - value); i++) button.click();
      return output.textContent;
    },
    { control, value },
  );
  expect(displayed).toBe(`${value}${control === "angle" ? "°" : "%"}`);
}

test("home, local turn, weapon choice and keyboard controls", async ({
  page,
}) => {
  test.setTimeout(90000);
  await instantFX(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "CraterCrew", exact: true }),
  ).toBeVisible();
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#fire")).toBeEnabled();
  await page
    .getByRole("button", { name: "Choose weapon", exact: true })
    .click();
  await page.getByRole("button", { name: /Big Bang.*3 rounds/ }).click();
  await expect(page.locator("#ammo-label")).toHaveText("3 LEFT");
  await setAim(page, "angle", "90");
  await setAim(page, "power", "10");
  await page.locator("#fire").click();
  await expect.poll(async () => (await diagnostics(page)).match.turn).toBe(1);
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("#angle-value")).toHaveText("135°");
  const before = await diagnostics(page);
  expect(before.match.tanks[0].ammo.heavy).toBe(2);
  expect(before.match.revision).toBe(1);
  await page.locator("#manual").click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.locator(".arena-frame").click();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#power-value")).toHaveText("61%");
});
test("solo bot takes a turn and returns control", async ({ page }) => {
  // Allow the visible AI draft sequence as well as both battle turns.
  test.setTimeout(90000);
  await instantFX(page);
  await page.goto("/");
  await page.locator("#quick-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await setAimInline(page, "angle", 90);
  await setAimInline(page, "power", 10);
  await page.locator("#fire").click();
  await expect
    .poll(async () => (await diagnostics(page)).match.shots, { timeout: 20000 })
    .toBe(2);
  await expect(page.locator("#fire")).toBeEnabled();
  expect((await diagnostics(page)).match.turn).toBe(0);
  await expect(page.locator("#angle-value")).toHaveText("90°");
  await expect(page.locator("#power-value")).toHaveText("10%");
});
test("local players keep their own angles across turn cycles", async ({
  page,
}) => {
  await instantFX(page);
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await setAimInline(page, "angle", 90);
  await setAimInline(page, "power", 10);
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("#angle-value")).toHaveText("135°");
  await expect(page.locator("#power-value")).toHaveText("60%");
  await setAimInline(page, "angle", 120);
  await setAimInline(page, "power", 20);
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("#angle-value")).toHaveText("90°");
  await expect(page.locator("#power-value")).toHaveText("10%");
  await page.locator("#fire").click();
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("#angle-value")).toHaveText("120°");
  await expect(page.locator("#power-value")).toHaveText("20%");
  await page.locator("#leave-game").click();
  await page.locator("#confirm-exit").click();
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("#angle-value")).toHaveText("45°");
});
test("online players keep their angles after either player fires", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const first = await a.newPage();
    const second = await b.newPage();
    await instantFX(first);
    await instantFX(second);
    await first.goto("/");
    await first.locator("#online-play").click();
    await first.locator("#create-room").click();
    await expect(first.locator(".room-code")).toBeVisible();
    const code = await first.locator(".room-code").textContent();
    await expect(first.locator("#ready")).toBeEnabled();
    await first.locator("#ready").click();
    await second.goto(`/?room=${code}`);
    await second.locator("#join-room").click();
    await expect(second.locator("#ready")).toBeEnabled();
    await second.locator("#ready").click();
    await finishOnlineDraft(first, second);
    await expect(first.locator("#fire")).toBeEnabled();
    await setAimInline(first, "angle", 90);
    await setAimInline(first, "power", 10);
    await first.locator("#fire").click();
    await expect(second.locator("#fire")).toBeEnabled({ timeout: 20000 });
    await expect(first.locator("#angle-value")).toHaveText("90°");
    await expect(first.locator("#angle-edit")).toBeDisabled();
    await expect(first.locator("#power-edit")).toBeDisabled();
    await expect(first.locator("#power-value")).toHaveText("10%");
    await setAimInline(second, "angle", 120);
    await setAimInline(second, "power", 10);
    await second.locator("#fire").click();
    await expect(first.locator("#fire")).toBeEnabled({ timeout: 20000 });
    await expect(first.locator("#angle-value")).toHaveText("90°");
    await expect(second.locator("#angle-value")).toHaveText("120°");
    await first.reload();
    await first.locator("#join-room").click();
    await expect(first.locator("canvas")).toBeVisible({ timeout: 15000 });
    await expect(first.locator("#angle-value")).toHaveText("90°");
    await expect(first.locator("#power-value")).toHaveText("10%");
    await second.reload();
    await second.locator("#join-room").click();
    await expect(second.locator("canvas")).toBeVisible({ timeout: 15000 });
    await expect(second.locator("#angle-value")).toHaveText("120°");
    await expect(second.locator("#power-value")).toHaveText("10%");
  } finally {
    await a.close();
    await b.close();
  }
});
test("touch viewport keeps controls inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await instantFX(page);
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(page.locator("#fire")).toBeInViewport();
  await expect(page.locator("#angle-edit")).toBeInViewport();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("private online room has authoritative turns and reconnects", async ({
  browser,
}) => {
  test.setTimeout(360000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const first = await a.newPage();
  const second = await b.newPage();
  await instantFX(first);
  await instantFX(second);
  await first.goto("/");
  await first.locator("#online-play").click();
  await first.locator("#callsign").fill("Atlas");
  await first.locator("#create-room").click();
  await expect(first.locator(".room-code")).toBeVisible();
  const code = (await first.locator(".room-code").textContent())!;
  await expect(first.locator("#ready")).toBeEnabled();
  await first.locator("#ready").click();
  await second.goto(`/?room=${code}`);
  await second.locator("#callsign").fill("Echo");
  await second.locator("#join-room").click();
  await expect(second.locator("#ready")).toBeEnabled();
  await second.locator("#ready").click();
  await finishOnlineDraft(first, second);
  await expect(first.locator("#fire")).toBeEnabled();
  await expect(second.locator("#fire")).toBeDisabled();
  await setAimInline(first, "angle", 90);
  await setAimInline(first, "power", 10);
  await first.locator("#fire").click();
  await expect(second.locator("#fire")).toBeEnabled({ timeout: 20000 });
  await expect(first.locator("#fire")).toBeDisabled();
  expect((await diagnostics(first)).match).toEqual(
    (await diagnostics(second)).match,
  );
  await first.reload();
  await first.locator("#join-room").click();
  await expect(first.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(second.locator("#fire")).toBeEnabled();
  expect((await diagnostics(first)).match.revision).toBe(1);
  await expect(first.locator("#angle-value")).toHaveText("90°");
  await expect(first.locator("#power-value")).toHaveText("10%");
  await setAimInline(second, "angle", 90);
  await setAimInline(second, "power", 10);
  await second.locator("#fire").click();
  await expect(first.locator("#fire")).toBeEnabled({ timeout: 20000 });
  expect((await diagnostics(first)).match).toEqual(
    (await diagnostics(second)).match,
  );
  for (let i = 0; i < 20; i++) {
    const state = await progress(first);
    if (state.winner !== null) break;
    const current = state.turn === 0 ? first : second;
    await expect(current.locator("#fire")).toBeEnabled({ timeout: 20000 });
    await setAimInline(current, "angle", 0);
    await current.locator("#fire").click();
    await expect
      .poll(
        async () => {
          const next = await progress(first);
          return next.revision > state.revision && !next.busy;
        },
        { timeout: 20000 },
      )
      .toBe(true);
  }
  await expect(first.locator("#result-dialog")).toBeVisible();
  await expect(second.locator("#result-dialog")).toBeVisible();
  await first.locator("#rematch").click();
  await second.locator("#rematch").click();
  await finishOnlineDraft(first, second);
  await expect(first.locator("#fire")).toBeEnabled();
  await expect(second.locator("#result-dialog")).not.toBeVisible();
  expect((await diagnostics(first)).match).toEqual(
    (await diagnostics(second)).match,
  );
  expect((await diagnostics(first)).match.shots).toBe(0);
  await a.close();
  await b.close();
});
test("local match reaches victory and restarts cleanly", async ({ page }) => {
  await instantFX(page);
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  test.setTimeout(360000);
  await setAimInline(page, "power", 10);
  for (let i = 0; i < 20; i++) {
    const state = await progress(page);
    if (state.winner !== null) break;
    await setAimInline(page, "angle", 0);
    await page.locator("#fire").click();
    await expect.poll(async () => (await progress(page)).busy).toBe(false);
  }
  await expect(page.locator("#result-dialog")).toBeVisible();
  await page.locator("#rematch").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  const state = await diagnostics(page);
  expect(state.match.winner).toBe(null);
  expect(state.match.shots).toBe(0);
  expect(state.match.tanks[0].points).toBe(0);
});
test("captures the reference-style desktop design and measures rendering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await expect
    .poll(async () => (await diagnostics(page)).fps)
    .toBeGreaterThan(25);
  await page.screenshot({
    path: "test-results/battle-desktop.png",
    fullPage: true,
  });
  const data = await diagnostics(page);
  console.log(`Measured desktop headless render FPS: ${data.fps?.toFixed(1)}`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "test-results/landscape.png", fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(844);
  expect(errors).toEqual([]);
});

test("leaving during a shot cancels old callbacks before a new match", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await page.locator("#fire").click();
  await page.locator("#leave-game").click();
  await page.locator("#confirm-exit").click();
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  expect((await diagnostics(page)).match.shots).toBe(0);
  expect((await diagnostics(page)).busy).toBe(false);
  expect(await page.locator("canvas").count()).toBe(1);
  expect(errors).toEqual([]);
});

test("reference aiming panels support fine adjustment and confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await expect(page.locator("#score-0")).toHaveText("0");
  await expect(page.locator("#score-1")).toHaveText("0");
  await page.locator("#angle-edit").click();
  await expect(page.locator("#fire")).not.toBeVisible();
  await page.locator("#angle").fill("60");
  await page.locator("#aim-plus").click();
  await expect(page.locator("#ruler-value")).toHaveText("61°");
  await page.locator("#aim-minus").click();
  await page.screenshot({ path: "test-results/angle-panel.png" });
  await page.locator("#aim-confirm").click();
  await expect(page.locator("#angle-value")).toHaveText("60°");
  await page.locator("#power-edit").click();
  await page.locator("#power").fill("100");
  await page.locator("#aim-plus").click();
  await expect(page.locator("#ruler-value")).toHaveText("100%");
  await page.screenshot({ path: "test-results/power-panel.png" });
  await page.locator("#aim-confirm").click();
  await expect(page.locator("#fire")).toBeVisible();
});
test("whole battlefield and bottom controls fit short and narrow viewports", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
    { width: 500, height: 800 },
    { width: 390, height: 844 },
    { width: 375, height: 812 },
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const frame = await page.locator(".arena-frame").boundingBox();
        const canvas = await page.locator("canvas").boundingBox();
        if (!frame || !canvas) return false;
        return (
          canvas.x >= frame.x - 1 &&
          canvas.y >= frame.y - 1 &&
          canvas.x + canvas.width <= frame.x + frame.width + 1 &&
          canvas.y + canvas.height <= frame.y + frame.height + 1 &&
          Math.abs(canvas.width - frame.width) < 2 &&
          Math.abs(canvas.height - frame.height) < 2
        );
      })
      .toBe(true);
    const controls = await page.locator("#battle-controls").boundingBox();
    const shell = await page.locator(".game-shell").boundingBox();
    expect(shell!.x).toBe(0);
    expect(shell!.width).toBe(viewport.width);
    expect(controls!.width).toBe(viewport.width);
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `test-results/viewport-${viewport.width}.png`,
    });
  }
});

test("Space confirms a focused ruler button without firing a shot", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await page.locator("#angle-edit").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#aim-editor")).toBeVisible();
  await page.locator("#angle").fill("60");
  await page.locator("#aim-plus").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#ruler-value")).toHaveText("61°");
  await page.locator("#aim-confirm").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#aim-editor")).not.toBeVisible();
  expect((await diagnostics(page)).match.shots).toBe(0);
});

test("arcade weapon cycling and inline aiming operate without opening a panel", async ({
  page,
}) => {
  await instantFX(page);
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  await page.getByRole("button", { name: "Next weapon", exact: true }).click();
  await expect(page.locator("#weapon")).toHaveValue("heavy");
  await page
    .getByRole("button", { name: "Previous weapon", exact: true })
    .click();
  await expect(page.locator("#weapon")).toHaveValue("shell");
  await page
    .getByRole("button", { name: "Increase angle", exact: true })
    .click();
  await expect(page.locator("#angle-value")).toHaveText("46°");
  await page
    .getByRole("button", { name: "Decrease power", exact: true })
    .click();
  await expect(page.locator("#power-value")).toHaveText("59%");
  await expect(page.locator("#aim-editor")).not.toBeVisible();
  const locked = await page.locator("#fire").evaluate((button) => {
    (button as HTMLButtonElement).click();
    return (document.querySelector("#weapon-next") as HTMLButtonElement)
      .disabled;
  });
  expect(locked).toBe(true);
  await expect.poll(async () => (await diagnostics(page)).busy).toBe(false);
});

test("portrait arcade console has touch-sized controls and visible aim editors", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  for (const id of [
    "move-left",
    "move-right",
    "weapon-next",
    "weapon-prev",
    "angle-edit",
    "power-edit",
    "fire",
  ]) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  }
  for (const control of ["angle", "power"]) {
    await page.locator(`#${control}-edit`).click();
    await expect(page.locator("#aim-confirm")).toBeInViewport();
    await page.locator("#aim-confirm").click();
  }
  await context.close();
});

test("firing waits for tank movement to finish", async ({ page }) => {
  await page.goto("/");
  await page.locator("#local-play").click();
  await finishDraft(page);
  await expect(page.locator("#fire")).toBeEnabled();
  const { match } = await diagnostics(page);
  const tank = match.tanks[0];
  const direction =
    Math.abs(match.terrain[Math.round(tank.x + 20)] - tank.y) <= 45
      ? "right"
      : "left";
  // Capture the lock in the same browser task as the click: a 480ms drive can
  // finish before a separate automation round trip on a busy test host.
  const locked = await page.locator(`#move-${direction}`).evaluate((button) => {
    (button as HTMLButtonElement).click();
    return (document.querySelector("#fire") as HTMLButtonElement).disabled;
  });
  expect(locked).toBe(true);
  await expect(page.locator("#fire")).toBeEnabled();
  expect((await diagnostics(page)).match.tanks[0].fuel).toBe(50);
});

for (const weapon of ["turbo-cannon", "reflex-missile"]) {
  test(`${weapon} animation keeps selected angle and power across an opponent turn`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await instantFX(page);
    await page.goto("/");
    await page.locator("#local-play").click();
    await finishDraft(page);
    await expect(page.locator("#fire")).toBeEnabled();
    await setAimInline(page, "angle", 73);
    await setAimInline(page, "power", 28);
    await page.locator("#weapon-open").click();
    await page.locator(`[data-weapon="${weapon}"]`).click();
    await page.locator("#fire").click();
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 20000 });
    await setAimInline(page, "angle", 110);
    await setAimInline(page, "power", 19);
    await page.locator("#fire").click();
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 20000 });
    await expect(page.locator("#angle-value")).toHaveText("73°");
    await expect(page.locator("#power-value")).toHaveText("28%");
  });
}
