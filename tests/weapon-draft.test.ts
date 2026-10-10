import { describe, expect, it } from "vitest";
import { createMatch, WEAPONS } from "../src/shared/game";
import {
  applyDraft,
  completeRandomly,
  createDraft,
  DRAFT_PICK_MS,
  pickWeapon,
  randomPick,
} from "../src/shared/weapon-draft";

describe("weapon draft", () => {
  it("samples twenty unique specials deterministically", () => {
    const draft = createDraft(12, 1000);
    expect(draft.remaining).toHaveLength(20);
    expect(new Set(draft.remaining).size).toBe(20);
    expect(draft.remaining).not.toContain("shell");
    expect(draft).toEqual(createDraft(12, 1000));
    expect(draft.remaining).not.toEqual(createDraft(13, 1000).remaining);
    expect(draft.deadline).toBe(1000 + DRAFT_PICK_MS);
  });
  it("moves picks exclusively to alternating seats and resets the timer", () => {
    const original = createDraft(12, 1000);
    const id = original.remaining[0];
    const next = pickWeapon(original, 0, id, 0, 2000);
    expect(original.remaining).toHaveLength(20);
    expect(next.remaining).toHaveLength(19);
    expect(next.picks).toEqual([[id], []]);
    expect(next.turn).toBe(1);
    expect(next.revision).toBe(1);
    expect(next.deadline).toBe(2000 + DRAFT_PICK_MS);
    expect(() => pickWeapon(next, 0, next.remaining[0], 1, 2001)).toThrow();
    expect(() => pickWeapon(next, 1, id, 1, 2001)).toThrow();
    expect(() => pickWeapon(next, 1, next.remaining[0], 0, 2001)).toThrow();
    expect(() =>
      pickWeapon(next, 1, next.remaining[0], 1, next.deadline),
    ).toThrow();
  });
  it("random completion preserves picks and splits ten per player", () => {
    let draft = createDraft(123, 1000);
    const first = draft.remaining[0];
    draft = pickWeapon(draft, 0, first, 0, 1100);
    const done = completeRandomly(draft, 1200);
    expect(done.remaining).toEqual([]);
    expect(done.picks.map((p) => p.length)).toEqual([10, 10]);
    expect(done.picks[0][0]).toBe(first);
    expect(new Set(done.picks.flat()).size).toBe(20);
    expect(done.deadline).toBe(0);
    expect(() => randomPick(done, 2000)).toThrow();
  });
  it("timeout automatically picks deterministically at the current time", () => {
    const draft = createDraft(88, 1000);
    const next = randomPick(draft, draft.deadline);
    expect(next.picks[0]).toHaveLength(1);
    expect(next.deadline).toBe(draft.deadline + DRAFT_PICK_MS);
    expect(next).toEqual(randomPick(draft, draft.deadline));
  });
  it("only grants drafted specials plus the unlimited standard shell", () => {
    const match = createMatch(1);
    expect(() => applyDraft(match, createDraft(1, 0))).toThrow();
    const draft = completeRandomly(createDraft(1, 0), 0);
    const loaded = applyDraft(match, draft);
    for (const seat of [0, 1] as const) {
      for (const weapon of WEAPONS) {
        expect(loaded.tanks[seat].ammo[weapon.id]).toBe(
          weapon.id === "shell"
            ? -1
            : draft.picks[seat].includes(weapon.id)
              ? weapon.ammo
              : 0,
        );
      }
    }
    expect(match.tanks[0].ammo.heavy).toBe(3);
  });
});
