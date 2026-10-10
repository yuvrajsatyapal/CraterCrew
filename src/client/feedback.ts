import {
  clamp,
  type Match,
  type Player,
  type ShotResult,
} from "../shared/game";

export interface ScoreEvent {
  player: Player;
  amount: number;
  time: number;
  kind: "hit" | "fall";
  x?: number;
  y?: number;
  attacker?: Player;
}

/** Split the authoritative total into collision events and the landing remainder. */
export function scoreEvents(before: Match, result: ShotResult): ScoreEvent[] {
  if (result.events)
    return result.events.flatMap((e) =>
      e.type === "damage"
        ? [
            {
              player: e.player,
              amount: e.amount,
              time: e.time,
              kind: e.kind,
              x: e.x,
              y: e.y,
              attacker: e.attacker,
            },
          ]
        : [],
    );
  const events: ScoreEvent[] = [];
  for (const player of [0, 1] as const) {
    const tank = before.tanks[player];
    let direct = 0;
    for (const blast of result.blasts) {
      const distance = Math.hypot(tank.x - blast.x, tank.y - 10 - blast.y);
      const amount = Math.round(
        blast.damage * clamp(1 - distance / (blast.radius + 24), 0, 1),
      );
      if (amount)
        events.push({
          player,
          amount,
          time: blast.time ?? result.paths[blast.pathIndex].length,
          kind: "hit",
        });
      direct += amount;
    }
    const fall = result.damage[player] - direct;
    if (fall > 0)
      events.push({
        player,
        amount: fall,
        time:
          Math.max(
            0,
            ...result.blasts
              .filter((b) => Math.abs(b.x - tank.x) <= b.radius)
              .map((b) => b.time ?? result.paths[b.pathIndex].length),
          ) + 6,
        kind: "fall",
      });
  }
  return events.sort((a, b) => a.time - b.time);
}

/** Airburst paths include their common stem for collision timing, not duplicate drawing. */
export function visibleFlightPaths(result: ShotResult, elapsed: number) {
  const split = result.shot.weapon === "airburst" ? result.paths[0].length : 0;
  return result.paths.flatMap((path, index) => {
    const offset = result.pathStarts?.[index] ?? 0;
    const end =
      result.blasts.find((blast) => blast.pathIndex === index)?.time ??
      (result.pathStarts ? path.length - 1 + offset : path.length + offset);
    if (elapsed < offset || elapsed >= end) return [];
    if (split && (elapsed < split ? index !== 0 : index === 0)) return [];
    return [{ path, offset, startIndex: split && index > 0 ? split - 1 : 0 }];
  });
}

/** Cosmetic tags outlive the shot tail without extending the turn lock. */
export function popupProgress(startMs: number, nowMs: number) {
  return clamp((nowMs - startMs) / 2400, 0, 1);
}

export function scoreTagText(amount: number, self: boolean) {
  return `${self ? "−" : ""}${amount}`;
}

/** Small, constant-size reference tags rise with a gentle sideways drift. */
export function popupPose(
  origin: { x: number; y: number },
  progress: number,
  rank: number,
  reduced: boolean,
) {
  const t = clamp(progress, 0, 1);
  const stagger = rank % 3;
  return {
    x: clamp(
      origin.x +
        stagger * 12 +
        (reduced ? 0 : 12 * Math.sin(t * Math.PI * 2 + stagger)),
      20,
      1180,
    ),
    y: clamp(origin.y - 18 - stagger * 3 - t * (reduced ? 10 : 135), 18, 616),
    alpha: t < 0.85 ? 1 : clamp((1 - t) / 0.15, 0, 1),
    scale: 1,
  };
}
