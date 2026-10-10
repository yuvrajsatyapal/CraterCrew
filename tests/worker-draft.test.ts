import { afterEach, expect, it, vi } from "vitest";
import { GameRoom } from "../worker/index";
import { command, joinRoom, newRoom } from "../src/shared/room";

afterEach(() => vi.useRealTimers());
it("persists and broadcasts an alarm-expired draft before rejecting a late pick", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const room = newRoom(17, 0);
  joinRoom(room, "a", "Nova", 1000);
  joinRoom(room, "b", "Rook", 1000);
  command(room, "a", { type: "ready" }, 1000);
  command(room, "b", { type: "ready" }, 1000);
  const id = room.draft!.remaining[0];
  const output: string[] = [];
  const socket = {
    deserializeAttachment: () => ({ token: "a", window: 1000, count: 0 }),
    serializeAttachment() {},
    send: (data: string) => output.push(data),
  };
  const saved: unknown[] = [];
  let initialization: Promise<unknown> | undefined;
  const context = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => {
      const result = fn();
      initialization ??= result;
      return result;
    },
    storage: {
      get: async () => room,
      put: async (_key: string, value: unknown) => {
        saved.push(structuredClone(value));
      },
      setAlarm: async () => {},
    },
    getWebSockets: () => [socket],
  };
  const worker = new GameRoom(
    context as unknown as ConstructorParameters<typeof GameRoom>[0],
    { ALLOWED_ORIGINS: "" } as ConstructorParameters<typeof GameRoom>[1],
  );
  await initialization;
  vi.setSystemTime(16000);
  await worker.webSocketMessage(
    socket as unknown as WebSocket,
    JSON.stringify({ type: "pick", weapon: id, revision: 0 }),
  );
  expect(saved.length).toBeGreaterThan(0);
  const update = output
    .map((line) => JSON.parse(line))
    .find((m) => m.type === "state");
  expect(update.room.draft.revision).toBe(1);
  expect(update.room.draft.remaining).toHaveLength(19);
  expect(
    output.map((line) => JSON.parse(line)).some((m) => m.type === "error"),
  ).toBe(true);
});
