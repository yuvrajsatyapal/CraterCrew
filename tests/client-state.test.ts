import { describe, it, expect } from "vitest";
import { createMatch } from "../src/shared/game";
import { completedShotState } from "../src/client/state";
describe("delayed shot completion", () => {
  it("preserves a newer timeout, forfeit or rematch snapshot", () => {
    const shot = createMatch(1);
    shot.revision = 3;
    const newer = createMatch(2);
    newer.revision = 4;
    newer.winner = 1;
    expect(completedShotState(shot, newer)).toBe(newer);
  });
  it("uses the shot result before its authoritative update arrives", () => {
    const old = createMatch(1);
    const shot = createMatch(1);
    shot.revision = 1;
    expect(completedShotState(shot, old)).toBe(shot);
    expect(completedShotState(shot)).toBe(shot);
  });
});
