import type { Match } from "../shared/game";
/** A delayed visual effect must never roll authoritative state backwards. */
export function completedShotState(shot: Match, authoritative?: Match): Match {
  return authoritative && authoritative.revision >= shot.revision
    ? authoritative
    : shot;
}
