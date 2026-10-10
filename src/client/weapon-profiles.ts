import type { WeaponId } from "../shared/game";

export interface WeaponProfile {
  /** Local starting suggestion; scripted/fixed-speed attacks ignore shot power. */
  power: number | "automatic" | "fixed";
  /** Direct damage from the resolver. Counts are projectiles/pulses, not guaranteed hits. */
  damage: string;
}
const p = (power: WeaponProfile["power"], damage: string): WeaponProfile => ({
  power,
  damage,
});

// Roles checked against BlitWise's pack descriptions. Numeric damage is from
// this game's resolvers, not an official Pocket Tanks balance table. Percentages
// are local starting suggestions and depend on angle, distance, wind and terrain.
export const WEAPON_PROFILES: Record<WeaponId, WeaponProfile> = {
  shell: p(60, "34"),
  heavy: p(75, "58"),
  scatter: p(65, "5 × 20"),
  bounce: p(45, "46"),
  digger: p(70, "22 + fall"),
  airburst: p(80, "6 × 16"),

  "danger-rope": p(55, "5 × 7"),
  upheaval: p("automatic", "6 × 7"),
  "topsy-turvy": p(60, "35 + fall"),
  "displacer-beam": p("automatic", "3 × 9"),
  earthquake: p("automatic", "5 × 4 · both tanks"),

  "gamma-goo": p(50, "4 × 9 · contact"),
  concrete: p(55, "4 × 6 · contact"),
  "barrier-be-gone": p(65, "5 × 10"),
  "strip-mine": p(70, "5 × 7 + fall"),
  "sand-blast": p(55, "6 × 7"),

  "booster-worm": p("automatic", "40"),
  "spin-lasers": p(45, "14 per bounce"),
  mudrunner: p("automatic", "4 × 9 · contact"),
  "grenade-towers": p(60, "6 × 13"),

  chasm: p(70, "0 · fall damage"),
  "bungee-bomb": p(55, "3 × 14"),
  "nail-gun": p(85, "6 × 16"),
  fling: p(75, "Speed-based + fall"),
  "hover-blocks": p(50, "0 · terrain"),

  "spark-storm": p(65, "6 × 10"),
  "laser-bots": p("automatic", "9 × 6"),
  "lava-flow": p(50, "4 × 8 · contact"),
  "fix-it-foam": p(40, "0 · support"),
  "gravity-grenade": p(60, "35 + fall"),

  "turbo-cannon": p("automatic", "6 × 8"),
  "bombs-away": p("automatic", "5 × 18"),
  "boring-missiles": p("automatic", "5 × 15"),
  "crash-dive": p(65, "3 × 22"),
  "matter-blaster": p(75, "20–100 · dirt-based"),

  stomper: p(60, "5 × 14"),
  dash: p("automatic", "50 · contact"),
  mineshaft: p("automatic", "55 + fall"),
  "warp-missiles": p(70, "5 × 18"),
  "bump-rockets": p("fixed", "5 × 12"),

  "bungee-punch": p(55, "30 + 35 on return"),
  "sticks-and-stones": p(60, "3 × 17 + 3 × 24"),
  "coin-toss": p(60, "30 or 90"),
  bombardment: p("automatic", "6 × 18"),
  trench: p(70, "0 · excavation"),
  "rebound-lasers": p("fixed", "12 per beam contact"),
  "ricochet-rifle": p("fixed", "15 per contact · max 90"),
  "bumper-bowling": p(80, "Speed-based"),
  "reflex-missile": p("fixed", "18"),
  magnablobs: p("fixed", "18 · attachment"),
  retreat: p("automatic", "0 · movement"),
  "super-retreat": p(55, "30"),
  "rocket-launch": p(70, "18 · launch blast"),
  firefight: p(65, "35 + 30 counterfire"),
  "auto-turrets": p("automatic", "6 × 10"),
  sinker: p("automatic", "25 fall · both tanks"),
  "spike-pit": p(55, "40 + fall"),
  "flash-flood": p(50, "4 × 8 · contact"),
  "vacuum-cannon": p("automatic", "45 + fall"),
  foundation: p("automatic", "0 · support"),

  battery: p(45, "20 + 16 per bounce"),
  knockback: p("fixed", "6 × 12 + 3 fall per hit"),
  "electric-putty": p(55, "4 × 16"),
  sparkatron: p(50, "25 + 9 per bounce"),
  rampart: p("automatic", "35"),

  "neutron-beam": p("automatic", "7 × 9"),
  "zap-stix": p("fixed", "9 × 7"),
  wrecker: p("automatic", "4 × 12"),
  "wiggle-worm": p("automatic", "42"),
  "six-shooter": p(65, "6 × 18"),
  howitzer: p(70, "52"),
  sandstone: p(50, "4 × 6 · contact"),
  "flying-wall": p(65, "7 × 16"),
  "reference-airburst": p(75, "75"),
  flywheel: p(55, "6 × 10"),
  backflip: p(60, "35 + fall"),
  "snow-cone": p("automatic", "0 · barrier"),
  icicles: p("automatic", "6 × 13"),
  bridge: p("automatic", "0 · movement"),
  steamroller: p("automatic", "55 · contact"),

  "puzzle-box": p(60, "60"),
  "bouncy-blocker": p("automatic", "0 · barrier"),
  evac: p("automatic", "0 · teleport"),
  "sticker-shock": p("fixed", "5 × 9"),
  "barbed-wire": p(45, "28"),
};

export function weaponPowerLabel(profile: WeaponProfile): string {
  return typeof profile.power === "number"
    ? `Suggested power ${profile.power}%`
    : `Power ${profile.power}`;
}
