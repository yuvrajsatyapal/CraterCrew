import { describe, expect, it } from "vitest";
import {
  command,
  disconnect,
  expire,
  joinRoom,
  newRoom,
  publicRoom,
  TURN_MS,
} from "../src/shared/room";
import { DRAFT_PICK_MS } from "../src/shared/weapon-draft";
function drafting() {
  const room = newRoom(17, 0);
  joinRoom(room, "a", "Nova", 1000);
  joinRoom(room, "b", "Rook", 1000);
  command(room, "a", { type: "ready" }, 1000);
  command(room, "b", { type: "ready" }, 1000);
  return room;
}
function finish(room: ReturnType<typeof newRoom>, now = 1100) {
  for (let i = 0; i < 20; i++) {
    const d = room.draft!;
    command(
      room,
      d.turn === 0 ? "a" : "b",
      { type: "pick", weapon: d.remaining[0], revision: d.revision },
      now,
    );
  }
}
describe("online draft authority", () => {
  it("ready starts drafting and exposes its shared pool", () => {
    const room = drafting();
    expect(room.phase).toBe("drafting");
    expect(room.draft!.remaining).toHaveLength(20);
    expect(publicRoom(room).draft).toEqual(room.draft);
    expect(room.deadline).toBe(1000 + DRAFT_PICK_MS);
    expect(() =>
      command(
        room,
        "a",
        { type: "fire", revision: 0, weapon: "shell", angle: 45, power: 60 },
        1100,
      ),
    ).toThrow();
  });
  it("rejects wrong seat, stale packets and random completion commands", () => {
    const room = drafting();
    const pick = {
      type: "pick",
      weapon: room.draft!.remaining[0],
      revision: 0,
    };
    expect(() => command(room, "b", pick, 1100)).toThrow();
    command(room, "a", pick, 1100);
    expect(() => command(room, "a", pick, 1101)).toThrow();
    expect(() => command(room, "b", { ...pick, revision: 1 }, 1101)).toThrow();
    expect(() => command(room, "b", { type: "random" }, 1101)).toThrow();
    expect(room.draft!.remaining).toHaveLength(19);
  });
  it("times out one pick without burning multiple turns after a delayed alarm", () => {
    const room = drafting();
    expire(room, 80000);
    expect(room.draft!.picks[0]).toHaveLength(1);
    expect(room.draft!.revision).toBe(1);
    expect(room.deadline).toBe(80000 + DRAFT_PICK_MS);
  });
  it("pauses and resumes the same draft then forfeits on disconnect", () => {
    const room = drafting();
    disconnect(room, "a", 1100);
    expire(room, 17000);
    expect(room.paused).toBe(true);
    expect(room.draft!.revision).toBe(0);
    expect(() =>
      command(
        room,
        "a",
        { type: "pick", weapon: room.draft!.remaining[0], revision: 0 },
        1200,
      ),
    ).toThrow();
    joinRoom(room, "a", "Nova", 18000);
    expect(room.deadline).toBe(18000 + DRAFT_PICK_MS);
    expect(room.draft!.deadline).toBe(room.deadline);
    disconnect(room, "b", 19000);
    expire(room, 49000);
    expect(room.phase).toBe("finished");
    expect(room.match.winner).toBe(0);
  });
  it("loads only assigned ammunition and begins a fresh draft for a rematch", () => {
    const room = drafting();
    finish(room);
    expect(room.phase).toBe("playing");
    expect(room.deadline).toBe(1100 + TURN_MS);
    for (const seat of [0, 1] as const) {
      expect(
        Object.values(room.match.tanks[seat].ammo).filter((n) => n > 0),
      ).toHaveLength(10);
      expect(room.match.tanks[seat].ammo.shell).toBe(-1);
    }
    const oldPool = room.draft!.picks.flat();
    disconnect(room, "b", 1200);
    expire(room, 32000);
    joinRoom(room, "b", "Rook", 33000);
    command(room, "a", { type: "rematch" }, 34000);
    command(room, "b", { type: "rematch" }, 34000);
    expect(room.phase).toBe("drafting");
    expect(room.draft!.picks).toEqual([[], []]);
    expect(room.draft!.remaining).not.toEqual(oldPool);
  });
});
