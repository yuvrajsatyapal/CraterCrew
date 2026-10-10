import { test, expect } from "@playwright/test";

test("real Web Audio distinguishes laser and portal cues, respects mute, and completes turns", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("cc-audio", "on");
    localStorage.setItem("cc-motion", "reduced");
    const starts: { wave: string; frequency: number }[] = [];
    (window as any).audioStarts = starts;
    (window as any).audioImmediateStops = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      let frequency = 0;
      const set = oscillator.frequency.setValueAtTime.bind(
        oscillator.frequency,
      );
      oscillator.frequency.setValueAtTime = (value, time) => {
        frequency = value;
        return set(value, time);
      };
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (time) => {
        starts.push({ wave: oscillator.type, frequency });
        return start(time);
      };
      let scheduledEnd = 0;
      const stop = oscillator.stop.bind(oscillator);
      oscillator.stop = (time) => {
        if (time === undefined && scheduledEnd > this.currentTime)
          (window as any).audioImmediateStops++;
        if (time !== undefined) scheduledEnd = time;
        return stop(time);
      };
      return oscillator;
    };
  });
  await page.goto("/");
  await page.locator("#local-play").click();
  const fireWeapon = async (id: string) => {
    await expect(page.locator("#fire")).toBeEnabled();
    await page.locator("#weapon-open").click();
    await page.locator('[data-weapon="' + id + '"]').click();
    await page.evaluate(() => {
      (window as any).audioStarts.length = 0;
    });
    await page.locator("#fire").click();
    await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
    return page.evaluate(
      () =>
        (window as any).audioStarts as { wave: string; frequency: number }[],
    );
  };
  const beam = await fireWeapon("neutron-beam");
  expect(
    beam.some((cue) => cue.wave === "sawtooth" && cue.frequency > 900),
  ).toBe(true);
  const portal = await fireWeapon("evac");
  expect(
    portal.some((cue) => cue.wave === "sine" && cue.frequency === 180),
  ).toBe(true);
  await page.locator("#weapon-open").click();
  await page.locator('[data-weapon="heavy"]').click();
  const stopped = await page.evaluate(
    () => (window as any).audioImmediateStops as number,
  );
  await page.locator("#fire").click();
  await page.locator("#audio-top").click();
  await expect(page.locator("#audio-top")).toHaveText("Sound off");
  expect(
    await page.evaluate(() => (window as any).audioImmediateStops as number),
  ).toBeGreaterThan(stopped);
  await expect(page.locator("#fire")).toBeEnabled({ timeout: 15000 });
  expect(await fireWeapon("battery")).toEqual([]);
  expect(errors).toEqual([]);
});
