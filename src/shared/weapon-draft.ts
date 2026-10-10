import {
  random,
  WEAPONS,
  type Match,
  type Player,
  type WeaponId,
} from "./game";

export const DRAFT_PICK_MS = 15_000;
export interface WeaponDraft {
  seed: number;
  remaining: WeaponId[];
  picks: [WeaponId[], WeaponId[]];
  turn: Player;
  revision: number;
  deadline: number;
}
export function createDraft(seed: number, now: number): WeaponDraft {
  const pool = WEAPONS.filter((w) => w.id !== "shell").map((w) => w.id);
  const rng = random(seed ^ 0x64726166);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    seed,
    remaining: pool.slice(0, 20),
    picks: [[], []],
    turn: 0,
    revision: 0,
    deadline: now + DRAFT_PICK_MS,
  };
}
function assign(draft: WeaponDraft, id: WeaponId, now: number): WeaponDraft {
  if (!draft.remaining.includes(id)) throw Error("Choose an available weapon.");
  const remaining = draft.remaining.filter((w) => w !== id);
  const picks: WeaponDraft["picks"] = [
    [...draft.picks[0]],
    [...draft.picks[1]],
  ];
  picks[draft.turn].push(id);
  return {
    ...draft,
    remaining,
    picks,
    turn: (1 - draft.turn) as Player,
    revision: draft.revision + 1,
    deadline: remaining.length ? now + DRAFT_PICK_MS : 0,
  };
}
export function pickWeapon(
  draft: WeaponDraft,
  player: Player,
  id: WeaponId,
  revision: number,
  now: number,
): WeaponDraft {
  if (revision !== draft.revision)
    throw Error("Stale pick. Wait for the latest draft.");
  if (player !== draft.turn) throw Error("Wait for your weapon pick.");
  if (now >= draft.deadline) throw Error("The pick timer has expired.");
  return assign(draft, id, now);
}
export function randomPick(draft: WeaponDraft, now: number): WeaponDraft {
  if (!draft.remaining.length) throw Error("Draft already complete.");
  const rng = random(draft.seed ^ Math.imul(draft.revision + 1, 0x9e3779b1));
  return assign(
    draft,
    draft.remaining[Math.floor(rng() * draft.remaining.length)],
    now,
  );
}
export function completeRandomly(draft: WeaponDraft, now: number): WeaponDraft {
  while (draft.remaining.length) draft = randomPick(draft, now);
  return draft;
}
export function applyDraft(match: Match, draft: WeaponDraft): Match {
  if (draft.remaining.length || draft.picks.some((p) => p.length !== 10))
    throw Error("Finish choosing weapons first.");
  return {
    ...match,
    tanks: match.tanks.map((tank, seat) => ({
      ...tank,
      ammo: Object.fromEntries(
        WEAPONS.map((w) => [
          w.id,
          w.id === "shell" ? -1 : draft.picks[seat].includes(w.id) ? w.ammo : 0,
        ]),
      ),
    })) as Match["tanks"],
  };
}
