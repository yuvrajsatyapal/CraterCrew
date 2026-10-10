import {
  command,
  disconnect,
  expire,
  GRACE_MS,
  joinRoom,
  newRoom,
  publicRoom,
  type Room,
} from "../src/shared/room";
interface Env {
  ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
}
interface Attachment {
  token: string;
  player: number;
  last: number;
  window: number;
  count: number;
}
function originAllowed(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  return (
    !!origin &&
    env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .includes(origin)
  );
}
function json(data: unknown, status = 200, origin = "") {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
  });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (url.pathname === "/health") return json({ ok: true });
    if (!originAllowed(request, env))
      return json({ error: "Origin not allowed." }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        },
      });
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      // A high-entropy room code is also the invitation capability.
      const code = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      await stub.fetch(new Request("https://room/init", { method: "POST" }));
      return json({ code }, 201, origin);
    }
    const route = /^\/api\/rooms\/([a-f0-9]{16})\/connect$/.exec(url.pathname);
    if (route && request.headers.get("Upgrade")?.toLowerCase() === "websocket")
      return env.ROOMS.get(env.ROOMS.idFromName(route[1])).fetch(request);
    return json({ error: "Room route not found." }, 404, origin);
  },
} satisfies ExportedHandler<Env>;
export class GameRoom implements DurableObject {
  private room: Room | null = null;
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get<Room>("room")) || null;
    });
  }
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const url = new URL(request.url);
      if (url.pathname === "/init" && request.method === "POST") {
        if (!this.room) {
          this.room = newRoom(crypto.getRandomValues(new Uint32Array(1))[0]);
          await this.save();
        }
        return json({ ok: true });
      }
      if (!this.room) return json({ error: "Room does not exist." }, 404);
      if (!originAllowed(request, this.env))
        return json({ error: "Origin not allowed." }, 403);
      const token = url.searchParams.get("token") || "";
      const name = url.searchParams.get("name") || "Pilot";
      if (!/^[a-zA-Z0-9-]{20,80}$/.test(token))
        return json({ error: "Invalid player identity." }, 400);
      try {
        expire(this.room, Date.now());
        const player = joinRoom(this.room, token, name, Date.now());
        for (const socket of this.ctx.getWebSockets())
          if ((socket.deserializeAttachment() as Attachment).token === token)
            socket.close(4001, "Replaced by reconnect.");
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          token,
          player,
          last: 0,
          window: Date.now(),
          count: 0,
        } satisfies Attachment);
        await this.save();
        server.send(JSON.stringify({ type: "identity", player }));
        this.broadcast();
        return new Response(null, { status: 101, webSocket: client });
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error ? error.message : "Unable to join room.",
          },
          409,
        );
      }
    });
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (!this.room) return;
      try {
        if (typeof message !== "string" || message.length > 1024)
          throw Error("Message too large.");
        const attachment = socket.deserializeAttachment() as Attachment;
        const now = Date.now();
        if (now - attachment.window > 10000) {
          attachment.window = now;
          attachment.count = 0;
        }
        attachment.count++;
        socket.serializeAttachment(attachment);
        if (attachment.count > 30) throw Error("Slow down.");
        const input: unknown = JSON.parse(message);
        const beforeExpiry = `${this.room.phase}:${this.room.match.revision}:${this.room.draft?.revision}`;
        expire(this.room, now);
        // Expiration can change the turn before a late packet is rejected.
        // Persist and announce that transition even when the command fails.
        if (
          beforeExpiry !==
          `${this.room.phase}:${this.room.match.revision}:${this.room.draft?.revision}`
        ) {
          await this.save();
          this.broadcast();
        }
        const result = command(this.room, attachment.token, input, now);
        await this.save();
        this.broadcast(result ? { type: "shot", result } : undefined);
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "error",
            message:
              error instanceof Error ? error.message : "Invalid request.",
          }),
        );
      }
    });
  }
  async webSocketClose(socket: WebSocket) {
    await this.closed(socket);
  }
  async webSocketError(socket: WebSocket) {
    await this.closed(socket);
  }
  private async closed(socket: WebSocket) {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (!this.room) return;
      const a = socket.deserializeAttachment() as Attachment | null;
      if (!a) return;
      const replacement = this.ctx
        .getWebSockets()
        .some(
          (s) =>
            s !== socket &&
            (s.deserializeAttachment() as Attachment).token === a.token &&
            s.readyState === 1,
        );
      if (!replacement) disconnect(this.room, a.token, Date.now());
      await this.save();
      this.broadcast();
    });
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (!this.room) return;
      const now = Date.now();
      if (now >= this.room.expiresAt) {
        for (const s of this.ctx.getWebSockets())
          s.close(4000, "Room expired.");
        this.room = null;
        await this.ctx.storage.deleteAll();
        return;
      }
      expire(this.room, now);
      await this.save();
      this.broadcast();
    });
  }
  private broadcast(extra?: unknown) {
    if (!this.room) return;
    const update = JSON.stringify({
      type: "state",
      room: publicRoom(this.room),
    });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        if (extra) socket.send(JSON.stringify(extra));
        socket.send(update);
      } catch {
        /* Close events handle disconnected clients. */
      }
    }
  }
  private async save() {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    const events = [this.room.expiresAt];
    if (this.room.phase === "playing" || this.room.phase === "drafting") {
      if (!this.room.paused) events.push(this.room.deadline);
      for (const m of this.room.members)
        if (!m.connected && m.disconnectedAt !== null)
          events.push(m.disconnectedAt + GRACE_MS);
    }
    await this.ctx.storage.setAlarm(
      Math.max(Date.now() + 50, Math.min(...events)),
    );
  }
}
