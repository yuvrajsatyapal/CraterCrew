import type { Player, Point } from "./game";
export type EffectKind =
  | "beam"
  | "electric"
  | "rope"
  | "drill"
  | "wave"
  | "fire"
  | "coin"
  | "robot"
  | "tiles"
  | "portal"
  | "counterfire"
  | "spark"
  | "ice"
  | "steel"
  | "duck";
export type WeaponEvent =
  | { type: "terrain"; time: number; patch: [number, number][] }
  | {
      type: "damage";
      time: number;
      player: Player;
      attacker: Player;
      amount: number;
      kind: "hit" | "fall";
      x: number;
      y: number;
    }
  | {
      type: "tank";
      time: number;
      player: Player;
      from: Point;
      to: Point;
      duration: number;
      arc: number;
      turns: number;
    }
  | {
      type: "effect";
      time: number;
      kind: EffectKind;
      points: Point[];
      duration: number;
      size: number;
    }
  | { type: "aim"; time: number; player: Player; angle: number };
export function tankEventPose(
  event: Extract<WeaponEvent, { type: "tank" }>,
  time: number,
) {
  const t = Math.max(
    0,
    Math.min(1, (time - event.time) / Math.max(1, event.duration)),
  );
  const eased = t * t * (3 - 2 * t);
  return {
    x: event.from.x + (event.to.x - event.from.x) * eased,
    y:
      event.from.y +
      (event.to.y - event.from.y) * eased -
      Math.sin(t * Math.PI) * event.arc,
    tilt: event.turns * Math.PI * 2 * t,
  };
}
export function eventEnd(event: WeaponEvent) {
  return event.time + ("duration" in event ? event.duration : 0);
}
