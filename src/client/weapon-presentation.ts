import { WEAPONS, type WeaponId } from "../shared/game";
export type WeaponFamily =
  | "shell"
  | "heavy"
  | "burst"
  | "bounce"
  | "drill"
  | "beam"
  | "electric"
  | "liquid"
  | "fire"
  | "portal"
  | "metal"
  | "earth"
  | "rope";
// Reconstructed signatures, not verified original sound samples or timings.
export const WEAPON_FAMILIES = {
  shell: "shell",
  heavy: "heavy",
  scatter: "burst",
  bounce: "bounce",
  digger: "drill",
  airburst: "burst",
  "danger-rope": "rope",
  upheaval: "beam",
  "topsy-turvy": "earth",
  "displacer-beam": "beam",
  earthquake: "earth",
  "gamma-goo": "liquid",
  concrete: "earth",
  "barrier-be-gone": "fire",
  "strip-mine": "drill",
  "sand-blast": "earth",
  "booster-worm": "drill",
  "spin-lasers": "beam",
  mudrunner: "liquid",
  "grenade-towers": "burst",
  chasm: "earth",
  "bungee-bomb": "rope",
  "nail-gun": "metal",
  fling: "earth",
  "hover-blocks": "metal",
  "spark-storm": "electric",
  "laser-bots": "beam",
  "lava-flow": "fire",
  "fix-it-foam": "liquid",
  "gravity-grenade": "heavy",
  "turbo-cannon": "burst",
  "bombs-away": "burst",
  "boring-missiles": "drill",
  "crash-dive": "heavy",
  "matter-blaster": "heavy",
  stomper: "heavy",
  dash: "metal",
  mineshaft: "drill",
  "warp-missiles": "portal",
  "bump-rockets": "bounce",
  "bungee-punch": "rope",
  "sticks-and-stones": "metal",
  "coin-toss": "metal",
  bombardment: "burst",
  trench: "earth",
  "rebound-lasers": "beam",
  "ricochet-rifle": "metal",
  "bumper-bowling": "metal",
  "reflex-missile": "bounce",
  magnablobs: "electric",
  retreat: "earth",
  "super-retreat": "heavy",
  "rocket-launch": "fire",
  firefight: "burst",
  "auto-turrets": "metal",
  sinker: "earth",
  "spike-pit": "metal",
  "flash-flood": "liquid",
  "vacuum-cannon": "rope",
  foundation: "earth",
  battery: "electric",
  knockback: "metal",
  "electric-putty": "electric",
  sparkatron: "electric",
  rampart: "earth",
  "neutron-beam": "beam",
  "zap-stix": "electric",
  wrecker: "drill",
  "wiggle-worm": "drill",
  "six-shooter": "burst",
  howitzer: "heavy",
  sandstone: "earth",
  "flying-wall": "metal",
  "reference-airburst": "burst",
  flywheel: "metal",
  backflip: "earth",
  "snow-cone": "metal",
  icicles: "metal",
  bridge: "metal",
  steamroller: "metal",
  "puzzle-box": "metal",
  "bouncy-blocker": "bounce",
  evac: "portal",
  "sticker-shock": "electric",
  "barbed-wire": "rope",
} satisfies Record<WeaponId, WeaponFamily>;
const weapons = new Map(WEAPONS.map((w) => [w.id, w]));
export function weaponPresentation(weapon: WeaponId) {
  const definition = weapons.get(weapon);
  return {
    family: (WEAPON_FAMILIES[weapon] ?? "shell") as WeaponFamily,
    radius: definition?.radius ?? 35,
    tint: Number.parseInt(definition?.color?.slice(1) ?? "ffbb70", 16),
  };
}
