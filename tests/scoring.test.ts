import { describe, it, expect } from "vitest";
import { createMatch, fire, passTurn, MATCH_SHOTS } from "../src/shared/game";
describe("point-based volleys", () => {
  it("starts both crews at zero points without health", () => {
    const m = createMatch(2);
    expect(m.tanks.map((t) => t.points)).toEqual([0, 0]);
    expect(m.tanks[0]).not.toHaveProperty("health");
  });
  it("penalizes self hits without eliminating tanks", () => {
    const r = fire(createMatch(2), 0, {
      angle: 90,
      power: 10,
      weapon: "heavy",
    });
    expect(r.damage[0]).toBeGreaterThan(0);
    expect(r.state.tanks[0].points).toBe(-r.damage[0]);
    expect(r.state.winner).toBe(null);
  });
  it("awards opposing hit points to the shooter", () => {
    const m = createMatch(2);
    m.tanks[1].x = m.tanks[0].x;
    m.tanks[1].y = m.tanks[0].y;
    const r = fire(m, 0, { angle: 90, power: 10, weapon: "heavy" });
    expect(r.state.tanks[0].points).toBe(r.damage[1] - r.damage[0]);
    expect(r.state.tanks[1].points).toBe(0);
  });
  it("ends after ten volleys each and compares totals", () => {
    let m = createMatch(3);
    m.tanks[0].points = 20;
    m.tanks[1].points = 15;
    for (let i = 0; i < MATCH_SHOTS; i++) {
      m = passTurn(m);
      if (i < MATCH_SHOTS - 1) expect(m.winner).toBe(null);
    }
    expect(m.winner).toBe(0);
    expect(m.shots).toBe(20);
    expect(() => passTurn(m)).toThrow();
  });
  it("ties are draws and the final shot still changes the winner", () => {
    let m = createMatch(2);
    for (let i = 0; i < 20; i++) m = passTurn(m);
    expect(m.winner).toBe("draw");
    const last = createMatch(2);
    last.shots = 19;
    last.turn = 1;
    last.tanks[1].points = 1;
    const r = fire(last, 1, { angle: 90, power: 10, weapon: "heavy" });
    expect(r.state.winner).toBe(0);
  });
});
