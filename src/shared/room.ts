import {
  createMatch,
  fire,
  move,
  passTurn,
  shotDuration,
  type Match,
  type Player,
  type ShotResult,
  type WeaponId,
} from "./game";
export const TURN_MS = 60000,
  GRACE_MS = 30000,
  ROOM_MS = 2 * 60 * 60 * 1000;
export interface Member {
  token: string;
  name: string;
  connected: boolean;
  ready: boolean;
  rematch: boolean;
  disconnectedAt: number | null;
}
export interface Room {
  seed: number;
  members: Member[];
  match: Match;
  phase: "lobby" | "playing" | "finished";
  paused: boolean;
  resolvingUntil: number;
  deadline: number;
  expiresAt: number;
}
export function newRoom(seed: number, now = Date.now()): Room {
  return {
    seed,
    members: [],
    match: createMatch(seed),
    phase: "lobby",
    paused: false,
    resolvingUntil: 0,
    deadline: 0,
    expiresAt: now + ROOM_MS,
  };
}
export function joinRoom(
  room: Room,
  token: string,
  name: string,
  now: number,
): Player {
  if (now >= room.expiresAt) throw Error("This room has expired.");
  const existing = room.members.findIndex((m) => m.token === token);
  if (existing >= 0) {
    const m = room.members[existing];
    m.connected = true;
    m.disconnectedAt = null;
    const wasPaused = room.paused;
    room.paused = room.members.some((m) => !m.connected);
    if (wasPaused && !room.paused) room.deadline = now + TURN_MS;
    return existing as Player;
  }
  if (room.members.length >= 2 || room.phase !== "lobby")
    throw Error("This room is full.");
  room.members.push({
    token,
    name: name.trim().slice(0, 18) || "Pilot",
    connected: true,
    ready: false,
    rematch: false,
    disconnectedAt: null,
  });
  return (room.members.length - 1) as Player;
}
export function command(
  room: Room,
  token: string,
  message: unknown,
  now: number,
): ShotResult | null {
  const player = room.members.findIndex((m) => m.token === token);
  if (player < 0) throw Error("Unknown player.");
  if (!message || typeof message !== "object" || Array.isArray(message))
    throw Error("Invalid command.");
  const m = message as Record<string, unknown>;
  const member = room.members[player];
  if (m.type === "ready") {
    if (room.phase !== "lobby") throw Error("Match already started.");
    member.ready = true;
    if (
      room.members.length === 2 &&
      room.members.every((p) => p.ready && p.connected)
    ) {
      room.phase = "playing";
      room.deadline = now + TURN_MS;
    }
    return null;
  }
  if (m.type === "rematch") {
    if (room.phase !== "finished") throw Error("Finish the match first.");
    member.rematch = true;
    if (room.members.every((p) => p.rematch && p.connected)) {
      const revision = room.match.revision + 1;
      room.match = createMatch(++room.seed);
      room.match.revision = revision;
      room.phase = "playing";
      room.paused = false;
      room.resolvingUntil = 0;
      room.deadline = now + TURN_MS;
      room.members.forEach((p) => {
        p.rematch = false;
      });
    }
    return null;
  }
  if (room.phase !== "playing" || room.paused) throw Error("Match is paused.");
  if (now < room.resolvingUntil) throw Error("Wait for the shot to land.");
  if (m.revision !== room.match.revision)
    throw Error("Stale action. Wait for the latest match.");
  if (m.type === "move") {
    room.match = move(room.match, player as Player, m.direction as number);
    return null;
  }
  if (m.type === "fire") {
    const result = fire(room.match, player as Player, {
      angle: m.angle as number,
      power: m.power as number,
      weapon: m.weapon as WeaponId,
    });
    room.match = result.state;
    room.resolvingUntil = now + shotDuration(result);
    room.deadline = room.resolvingUntil + TURN_MS;
    if (room.match.winner !== null) room.phase = "finished";
    return result;
  }
  throw Error("Unknown command.");
}
export function disconnect(room: Room, token: string, now: number) {
  const m = room.members.find((m) => m.token === token);
  if (!m) return;
  m.connected = false;
  m.disconnectedAt = now;
  if (room.phase === "playing") room.paused = true;
}
export function expire(room: Room, now: number) {
  if (room.phase !== "playing") return;
  const lost = room.members.map(
    (m) =>
      !m.connected &&
      m.disconnectedAt !== null &&
      now - m.disconnectedAt >= GRACE_MS,
  );
  if (lost.some(Boolean)) {
    room.match.winner = lost.every(Boolean) ? "draw" : lost[0] ? 1 : 0;
    room.match.revision++;
    room.phase = "finished";
    room.paused = false;
    return;
  }
  if (!room.paused && now >= room.deadline) {
    room.match = passTurn(room.match);
    if (room.match.winner !== null) room.phase = "finished";
    room.deadline = now + TURN_MS;
  }
}
export function publicRoom(room: Room) {
  return {
    members: room.members.map(({ token, ...m }) => m),
    match: room.match,
    phase: room.phase,
    paused: room.paused,
    resolvingUntil: room.resolvingUntil,
    deadline: room.deadline,
  };
}
