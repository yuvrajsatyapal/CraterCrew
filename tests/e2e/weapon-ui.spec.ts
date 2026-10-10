import { test, expect } from "@playwright/test";
for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`arsenal and instrument panels at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize(size);
    await page.goto("/");
    await page.locator("#local-play").click();
    await expect(page.locator("#fire")).toBeEnabled();
    await expect(page.locator("#audio-top")).toHaveText("Sound on");
    await page
      .getByRole("button", { name: "Choose weapon", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Select a weapon" }),
    ).toBeVisible();
    await page.screenshot({ path: `test-results/arsenal-${size.width}.png` });
    await page.getByRole("button", { name: /Big Bang.*3 rounds/ }).click();
    await expect(page.locator("#weapon")).toHaveValue("heavy");
    await expect(page.locator("#weapon-name")).toHaveText("Big Bang");
    await expect(page.locator("#score-0")).toHaveText("0");
    await page.locator("#angle-edit").click();
    await expect(page.locator("#angle-dial")).toBeVisible();
    await page.screenshot({ path: `test-results/angle-${size.width}.png` });
    await page.locator("#angle").fill("120");
    await expect(page.locator("#ruler-value")).toHaveText("120°");
    await page.locator("#aim-confirm").click();
    await expect(page.locator("#angle-edit")).toBeFocused();
    await page.locator("#power-edit").click();
    await expect(page.locator("#power-instrument")).toBeVisible();
    await page.screenshot({ path: `test-results/power-${size.width}.png` });
    await page.locator("#power").fill("35");
    await page.locator("#aim-confirm").click();
    await expect(page.locator("#power-value")).toHaveText("35%");
    await page.locator("#audio-top").click();
    await expect(page.locator("#audio-top")).toHaveText("Sound off");
    await page.screenshot({ path: `test-results/console-${size.width}.png` });
  });
}

test("six weapon animations finish, apply signed scores and hand off the turn", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    localStorage.setItem("cc-motion", "reduced");
    localStorage.setItem("cc-audio", "off");
  });
  await page.goto("/");
  await page.locator("#local-play").click();
  await expect(page.locator("#audio-top")).toHaveText("Sound off");
  for (const [index, name] of [
    "Standard",
    "Big Bang",
    "Starfall",
    "Skipstone",
    "Core Drill",
    "Moon Rain",
  ].entries()) {
    await expect(page.locator("#fire")).toBeEnabled();
    await page
      .getByRole("button", { name: "Choose weapon", exact: true })
      .click();
    await page.locator(".arsenal-weapon").filter({ hasText: name }).click();
    for (const [control, value] of [
      ["angle", "90"],
      ["power", "10"],
    ]) {
      await page.locator(`#${control}-edit`).click();
      await page.locator(`#${control}`).fill(value);
      await page.locator("#aim-confirm").click();
    }
    const locked = await page.locator("#fire").evaluate((button) => {
      (button as HTMLButtonElement).click();
      return (document.querySelector("#weapon-open") as HTMLButtonElement)
        .disabled;
    });
    expect(locked).toBe(true);
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
    const match = await page.evaluate(
      () =>
        (
          window as unknown as {
            craterCrewDiagnostics: {
              match: {
                shots: number;
                turn: number;
                tanks: { points: number }[];
              };
            };
          }
        ).craterCrewDiagnostics.match,
    );
    expect(match.shots).toBe(index + 1);
    expect(match.turn).toBe((index + 1) % 2);
    for (let player = 0; player < 2; player++)
      await expect(page.locator(`#score-${player}`)).toHaveText(
        String(match.tanks[player].points),
      );
  }
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`weapon details stay inside their rows at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#local-play").click();
    await page.locator("#weapon-open").click();
    const overflow = await page.locator(".arsenal-weapon").evaluateAll((rows) =>
      rows.flatMap((row) => {
        const bounds = row.getBoundingClientRect();
        return [
          ...row.querySelectorAll(
            ".arsenal-info > *, .arsenal-icon, .weapon-stock",
          ),
        ]
          .filter((child) => {
            const r = child.getBoundingClientRect();
            return (
              r.bottom > bounds.bottom + 1 ||
              r.right > bounds.right + 1 ||
              r.top < bounds.top - 1
            );
          })
          .map(
            (child) =>
              `${row.getAttribute("data-weapon")}: ${child.textContent}`,
          );
      }),
    );
    expect(overflow).toEqual([]);
    await expect(page.locator('[data-weapon="snow-cone"] small')).toHaveText(
      "Neutron",
    );
    if (viewport.width === 390) {
      await page.locator('[data-weapon="snow-cone"]').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "docs/previews/arsenal-details-repaired.png",
      });
    }
  });
}

test("weapon cards show distinct type-specific power and damage", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#local-play").click();
  await page.locator("#weapon-open").click();
  await expect(page.locator(".weapon-stats")).toHaveCount(85);
  await expect(
    page.locator('[data-weapon="shell"] .weapon-stats'),
  ).toContainText("Damage 34");
  await expect(page.locator('[data-weapon="shell"] .weapon-power')).toHaveText(
    "Suggested power 60%",
  );
  await expect(page.locator('[data-weapon="heavy"] .weapon-power')).toHaveText(
    "Suggested power 75%",
  );
  await expect(
    page.locator('[data-weapon="icicles"] .weapon-stats'),
  ).toContainText("Damage 6 × 13");
  await expect(
    page.locator('[data-weapon="evac"] .weapon-stats'),
  ).toContainText("Damage 0 · teleport");
  await page.locator("#weapon-dialog [data-close]").click();
  await page.locator("#power-edit").click();
  await page.locator("#power").fill("35");
  await page.locator("#aim-confirm").click();
  await page.locator("#weapon-open").click();
  await expect(
    page.locator('[data-weapon="snow-cone"] .weapon-power'),
  ).toHaveText("Power automatic");
  await expect(page.locator("#power-value")).toHaveText("35%");
  await expect(page.locator('[data-weapon="shell"] .weapon-power')).toHaveText(
    "Suggested power 60%",
  );
  await expect(
    page.locator('[data-weapon="shell"] .weapon-stats'),
  ).toContainText("Damage 34");
});
