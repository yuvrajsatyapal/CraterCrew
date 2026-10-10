import { supportY, type MaterialWorld } from "../shared/materials";
import { clamp, terrainAt, type Blast } from "../shared/game";

export interface Pose {
  x: number;
  y: number;
  tilt: number;
}

export function fallStep(
  y: number,
  ground: number,
  velocity: number,
  seconds: number,
): { y: number; velocity: number } {
  const nextVelocity = velocity + 900 * seconds;
  const nextY = y + velocity * seconds + 450 * seconds ** 2;
  return nextY >= ground
    ? { y: ground, velocity: 0 }
    : { y: nextY, velocity: nextVelocity };
}

/** Driving follows the actual ground, including ridges between the endpoints. */
export function drivePose(
  from: Pose,
  to: Pose,
  progress: number,
  terrain: number[],
  world?: MaterialWorld,
): Pose {
  if (from.x === to.x && from.y === to.y) return { ...to };
  if (progress >= 1) return { ...to };
  const support = (x: number) =>
    world ? supportY(world, x, from.y) : terrainAt(terrain, x);
  const t = clamp(progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const x = from.x + (to.x - from.x) * eased;
  return {
    x,
    y: support(x),
    tilt: clamp(Math.atan2(support(x + 12) - support(x - 12), 24), -0.6, 0.6),
  };
}

/** Open each crater at its own collision time, using the same floor as the rules. */
export function impactTerrain(
  before: number[],
  blasts: Blast[],
  impactTimes: number[],
  elapsed: number,
  digger = false,
): number[] {
  const terrain = before.slice();
  for (const blast of blasts) {
    const progress = clamp((elapsed - impactTimes[blast.pathIndex]) / 6, 0, 1);
    if (!progress) continue;
    for (
      let x = Math.max(0, Math.floor(blast.x - blast.radius));
      x < Math.min(terrain.length, blast.x + blast.radius);
      x++
    ) {
      const floor = clamp(
        Math.max(
          before[x],
          blast.y +
            Math.sqrt(Math.max(0, blast.radius ** 2 - (x - blast.x) ** 2)) *
              (digger ? 1.6 : 1),
        ),
        70,
        610,
      );
      terrain[x] = Math.max(
        terrain[x],
        before[x] + (floor - before[x]) * progress,
      );
    }
  }
  return terrain;
}

/** The terminal cache key is reserved for fully opened craters. */
export function impactKey(
  blasts: Blast[],
  impactTimes: number[],
  elapsed: number,
): number {
  return blasts.reduce(
    (key, blast, index) =>
      key +
      Math.floor(
        clamp((elapsed - impactTimes[blast.pathIndex]) / 6, 0, 1) * 6,
      ) *
        7 ** index,
    0,
  );
}
