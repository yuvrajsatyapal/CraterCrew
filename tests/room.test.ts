import { describe, it, expect } from "vitest";
import {
  newRoom,
  joinRoom,
  command,
  disconnect,
  expire,
  type Room,
} from "../src/shared/room";

import { createDraft } from "../src/shared/weapon-draft";
function started(): Room {
  let seed = 12;
  while (
    !["neutron-beam", "hover-blocks"].every((id) =>
      createDraft(seed, 1000).remaining.some((weapon) => weapon === id),
    )
  )
    seed++;
  const room = newRoom(seed);
  joinRoom(room, "token-a", "Nova", 1000);
  joinRoom(room, "token-b", "Rook", 1000);
  command(room, "token-a", { type: "ready" }, 1000);
  command(room, "token-b", { type: "ready" }, 1000);
  for (let i = 0; i < 20; i++) {
    const d = room.draft!;
    command(
      room,
      d.turn === 0 ? "token-a" : "token-b",
      {
        type: "pick",
        weapon:
          i === 0 ? "neutron-beam" : i === 1 ? "hover-blocks" : d.remaining[0],
        revision: d.revision,
      },
      1000,
    );
  }
  return room;
}
describe("authoritative rooms", () => {
  it("starts only when both players are ready", () => {
    const r = newRoom(12);
    joinRoom(r, "a", "Nova", 1000);
    command(r, "a", { type: "ready" }, 1000);
    expect(r.phase).toBe("lobby");
    joinRoom(r, "b", "Rook", 1000);
    command(r, "b", { type: "ready" }, 1000);
    expect(r.phase).toBe("drafting");
  });
  it("rejects full rooms and unknown identities", () => {
    const r = started();
    expect(() => joinRoom(r, "c", "Third", 1001)).toThrow();
    expect(() => command(r, "x", { type: "ready" }, 1001)).toThrow();
  });
  it("rejects wrong turns and stale or duplicate actions", () => {
    const r = started();
    const shot = {
      type: "fire",
      revision: 0,
      angle: 45,
      power: 60,
      weapon: "shell",
    };
    expect(() => command(r, "token-b", shot, 1001)).toThrow();
    command(r, "token-a", shot, 1001);
    const before = structuredClone(r.match);
    expect(() => command(r, "token-a", shot, 1002)).toThrow();
    expect(r.match).toEqual(before);
  });
  it("rejoins with the same identity and pauses until reconnect", () => {
    const r = started();
    disconnect(r, "token-a", 2000);
    expect(r.paused).toBe(true);
    expect(() =>
      command(r, "token-b", { type: "move", revision: 0, direction: 1 }, 2001),
    ).toThrow();
    expect(joinRoom(r, "token-a", "Nova", 3000)).toBe(0);
    expect(r.paused).toBe(false);
  });
  it("forfeits after disconnect grace and supports rematches", () => {
    const r = started();
    disconnect(r, "token-a", 2000);
    expire(r, 40000);
    expect(r.match.winner).toBe(1);
    expect(r.phase).toBe("finished");
    joinRoom(r, "token-a", "Nova", 40001);
    command(r, "token-a", { type: "rematch" }, 40002);
    command(r, "token-b", { type: "rematch" }, 40002);
    expect(r.phase).toBe("drafting");
    expect(r.match.winner).toBe(null);
  });
  it("rejects malformed commands and enforces turn timeouts", () => {
    const r = started();
    for (const message of [
      null,
      [],
      {},
      { type: "fire", revision: 0, angle: "45", power: 60, weapon: "shell" },
    ])
      expect(() => command(r, "token-a", message, 1001)).toThrow();
    expire(r, 62000);
    expect(r.match.turn).toBe(1);
    expect(r.match.revision).toBe(1);
  });
  it("rejects actions while a projectile is still resolving", () => {
    const r = started();
    command(
      r,
      "token-a",
      { type: "fire", revision: 0, angle: 45, power: 60, weapon: "shell" },
      1001,
    );
    expect(() =>
      command(
        r,
        "token-b",
        { type: "fire", revision: 1, angle: 135, power: 60, weapon: "shell" },
        1002,
      ),
    ).toThrow();
  });
  it("does not reuse revisions across rematches", () => {
    const r = started();
    r.match.winner = 1;
    r.phase = "finished";
    const old = r.match.revision;
    command(r, "token-a", { type: "rematch" }, 2000);
    command(r, "token-b", { type: "rematch" }, 2000);
    expect(r.match.revision).toBeGreaterThan(old);
  });
});

it("holds online input through an event-only beam and preserves world state for the next shot", async () => {
  const { shotDuration } = await import("../src/shared/game");
  const r = started();
  const result = command(
    r,
    "token-a",
    { type: "fire", revision: 0, angle: 45, power: 60, weapon: "neutron-beam" },
    1001,
  )!;
  expect(result.paths).toHaveLength(0);
  expect(r.resolvingUntil).toBe(1001 + shotDuration(result));
  expect(() =>
    command(
      r,
      "token-b",
      { type: "move", revision: 1, direction: 1 },
      r.resolvingUntil - 1,
    ),
  ).toThrow();
  const restored = JSON.parse(JSON.stringify(r)) as Room;
  const next = command(
    restored,
    "token-b",
    {
      type: "fire",
      revision: 1,
      angle: 135,
      power: 60,
      weapon: "hover-blocks",
    },
    restored.resolvingUntil,
  )!;
  expect(next.state.world).toBeDefined();
  expect(next.state.shots).toBe(2);
  expect(JSON.stringify(next).length).toBeLessThan(750000);
});
