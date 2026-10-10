import type { Match, WeaponId } from "../../src/shared/game";
import type { WeaponDraft } from "../../src/shared/weapon-draft";
type QAWindow = Window & {
  craterCrewDiagnostics: { match: Match; draft: WeaponDraft };
};
import { test, expect } from "@playwright/test";
for (const width of [375, 768, 1440]) {
  test(`draft has 20 unique choices, clock and responsive inventories at ${width}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator("#local-play").click();
    await expect(
      page.getByRole("heading", { name: "Weapon Shop" }),
    ).toBeVisible();
    await expect(page.locator("[data-draft-weapon]")).toHaveCount(20);
    expect(
      new Set(
        await page
          .locator("[data-draft-weapon]")
          .evaluateAll((rows) =>
            rows.map((r) => (r as HTMLElement).dataset.draftWeapon),
          ),
      ).size,
    ).toBe(20);
    await expect(page.locator("#draft-clock")).toContainText("15");
    await expect(page.locator("#draft-turn")).toContainText("Nova");
    await page.screenshot({
      path: `test-results/weapon-draft-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const id = await page
      .locator("[data-draft-weapon]")
      .first()
      .getAttribute("data-draft-weapon");
    await page.locator("[data-draft-weapon]").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-draft-weapon]")).toHaveCount(19);
    await expect(page.locator("#draft-inventory-0 li")).toHaveCount(1);
    await expect(page.locator("#draft-turn")).toContainText("Rook");
    await expect(page.locator(`[data-draft-weapon="${id}"]`)).toHaveCount(0);
    for (let i = 0; i < 19; i++)
      await page.locator("[data-draft-weapon]:enabled").first().click();
    await expect(page.locator("#fire")).toBeEnabled();
    await page.locator("#weapon-open").click();
    await expect(page.locator(".arsenal-weapon:visible")).toHaveCount(11);
    expect(errors).toEqual([]);
  });
}
test("solo Random preserves selected weapon and assigns ten specials to both tanks", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#quick-play").click();
  const selected = await page
    .locator("[data-draft-weapon]")
    .first()
    .getAttribute("data-draft-weapon");
  await page.locator("[data-draft-weapon]").first().click();
  await expect(page.locator("#draft-turn")).toContainText("Rook");
  await page.locator("#draft-random").click();
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 20000 });
  const tanks = await page.evaluate(
    () => (window as unknown as QAWindow).craterCrewDiagnostics.match.tanks,
  );
  expect(tanks[0].ammo[selected as WeaponId]).toBeGreaterThan(0);
  for (const tank of tanks) {
    expect(
      Object.values(tank.ammo).filter((n) => (n as number) > 0),
    ).toHaveLength(10);
    expect(tank.ammo.shell).toBe(-1);
  }
});
test("timer auto-picks and leaving cancels pending draft callbacks", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.locator("#local-play").click();
  await page.clock.fastForward(15_100);
  await expect(page.locator("#draft-inventory-0 li")).toHaveCount(1);
  await expect(page.locator("#draft-turn")).toContainText("Rook");
  await expect(page.locator("#draft-clock")).toContainText("15");
  await page.locator("#draft-menu").click();
  await expect(page.locator("#quick-play")).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.locator("#quick-play")).toBeVisible();
  await page.locator("#local-play").click();
  await expect(page.locator("[data-draft-weapon]")).toHaveCount(20);
  await expect(page.locator("#draft-inventory-0 li")).toHaveCount(0);
});
test("solo bot drafts on its turn", async ({ page }) => {
  await page.goto("/");
  await page.locator("#solo-play").click();
  await page.locator("[data-draft-weapon]").first().click();
  await expect(page.locator("#draft-inventory-1 li")).toHaveCount(1);
  await expect(page.locator("#draft-turn")).toContainText("Nova");
});
test("online draft synchronizes picks, reconnects, and starts both battles", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const first = await a.newPage(),
      second = await b.newPage();
    await first.goto("/");
    await first.locator("#online-play").click();
    await first.locator("#create-room").click();
    await expect(first.locator("#ready")).toBeEnabled();
    const code = await first.locator(".room-code").textContent();
    await first.locator("#ready").click();
    await second.goto(`/?room=${code}`);
    await second.locator("#join-room").click();
    await expect(second.locator("#ready")).toBeEnabled();
    await second.locator("#ready").click();
    await expect(first.locator("[data-draft-weapon]:enabled")).toHaveCount(20);
    await expect(second.locator("[data-draft-weapon]:enabled")).toHaveCount(0);
    const weapon = await first
      .locator("[data-draft-weapon]")
      .first()
      .getAttribute("data-draft-weapon");
    await first.locator("[data-draft-weapon]").first().click();
    await expect(second.locator("#draft-inventory-0 li")).toHaveCount(1);
    await expect(second.locator(`[data-draft-weapon="${weapon}"]`)).toHaveCount(
      0,
    );
    await first.reload();
    await first.locator("#join-room").click();
    await expect(first.locator("#draft-inventory-0 li")).toHaveCount(1);
    for (let i = 1; i < 20; i++) {
      const active = i % 2 === 0 ? first : second;
      await expect(active.locator("[data-draft-weapon]:enabled")).toHaveCount(
        20 - i,
      );
      await active.locator("[data-draft-weapon]:enabled").first().click();
    }
    await expect(first.locator("#fire")).toBeEnabled();
    await expect(second.locator("#fire")).toBeDisabled();
    expect(
      await first.evaluate(
        () => (window as unknown as QAWindow).craterCrewDiagnostics.match,
      ),
    ).toEqual(
      await second.evaluate(
        () => (window as unknown as QAWindow).craterCrewDiagnostics.match,
      ),
    );
    await second.reload();
    await second.locator("#join-room").click();
    await expect(second.locator("canvas")).toBeVisible();
    expect(
      await second.evaluate(
        () =>
          (window as unknown as QAWindow).craterCrewDiagnostics.draft.picks[1]
            .length,
      ),
    ).toBe(10);
    await first.locator("#fire").click();
    await expect(second.locator("#fire")).toBeEnabled({ timeout: 20000 });
    await second.locator("#weapon-open").click();
    await expect(second.locator(".arsenal-weapon:visible")).toHaveCount(11);
  } finally {
    await a.close();
    await b.close();
  }
});

test("solo keyboard focus returns after the bot picks and selections are announced", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#quick-play").click();
  await page.locator("[data-draft-weapon]").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#draft-inventory-1 li")).toHaveCount(1);
  await expect(page.locator("[data-draft-weapon]:focus")).toHaveCount(1);
  await expect(page.locator("#draft-announcement")).toContainText("chose");
});

test("phone draft clock stays visible while choosing from the bottom of the pool", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.locator("#local-play").click();
  await page.locator("[data-draft-weapon]").last().scrollIntoViewIfNeeded();
  await expect(page.locator("#draft-clock")).toBeInViewport();
});

test("Random visibly deals each weapon and pauses on completed inventories", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.locator("#quick-play").click();
  await page.locator("[data-draft-weapon]").first().click();
  const original = await page
    .locator("#draft-inventory-0 li")
    .first()
    .textContent();
  await page.locator("#draft-random").click();
  await expect(page.locator("#weapon-draft-screen")).toBeVisible();
  await expect(page.locator("#fire")).toHaveCount(0);
  await expect(page.locator("#draft-random")).toBeDisabled();
  await expect(page.locator("[data-draft-weapon]:enabled")).toHaveCount(0);
  await expect(page.locator("#draft-turn")).toContainText("AI");
  await page.clock.runFor(500);
  await expect(page.locator("#draft-inventory-1 li")).toHaveCount(1);
  await expect(page.locator("#draft-inventory-0 li")).toHaveCount(1);
  await expect(page.locator("[data-draft-weapon]")).toHaveCount(18);
  for (let i = 0; i < 18; i++) await page.clock.runFor(500);
  await expect(page.locator("#draft-inventory-0 li")).toHaveCount(10);
  await expect(page.locator("#draft-inventory-1 li")).toHaveCount(10);
  await expect(page.locator("#draft-inventory-0 li").first()).toHaveText(
    original!,
  );
  await expect(page.locator("#draft-turn")).toContainText("ready");
  await expect(page.locator("#draft-inventory-0 li").last()).toBeInViewport();
  await expect(page.locator("#draft-inventory-1 li").last()).toBeInViewport();
  await page.screenshot({ path: "test-results/random-loadouts-phone.png" });
  await expect(page.locator("#fire")).toHaveCount(0);
  await page.clock.runFor(1600);
  await expect(page.locator("#fire")).toBeEnabled();
});
test("leaving during Random distribution cancels AI dealing and delayed battle entry", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.locator("#quick-play").click();
  await page.locator("#draft-random").click();
  await expect(page.locator("#weapon-draft-screen")).toBeVisible();
  await page.clock.runFor(500);
  await page.locator("#draft-menu").click();
  await page.clock.runFor(20_000);
  await expect(page.locator("#quick-play")).toBeVisible();
  await expect(page.locator("#fire")).toHaveCount(0);
  await page.locator("#quick-play").click();
  await expect(page.locator("[data-draft-weapon]:enabled")).toHaveCount(20);
  await expect(page.locator("#draft-random")).toBeEnabled();
});

test("phone Random brings both receiving inventories into view", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.locator("#quick-play").click();
  await page.locator("#draft-random").click();
  const receivingPanelsVisible = await page
    .locator(".draft-inventory")
    .evaluateAll((panels) =>
      panels.map((panel) => {
        const bounds = panel.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
      }),
    );
  expect(receivingPanelsVisible).toEqual([true, true]);
  await expect(page.locator("#draft-inventory-0")).toBeInViewport();
  await expect(page.locator("#draft-inventory-1")).toBeInViewport();
});
