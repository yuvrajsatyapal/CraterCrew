import type { Match, Player, Shot, ShotResult } from "./game";
import { REFERENCE_WEAPONS, type ReferenceWeaponId } from "./reference-weapons";
import { Simulation } from "./weapon-engine";
import { resolveDanger } from "./weapon-packs/danger";
import { resolveGamma } from "./weapon-packs/gamma";
import { resolveBooster } from "./weapon-packs/booster";
import { resolveChasm } from "./weapon-packs/chasm";
import { resolveSpark } from "./weapon-packs/spark";
import { resolveTurbo } from "./weapon-packs/turbo";
import { resolveStomper } from "./weapon-packs/stomper";
import { resolveTwenty } from "./weapon-packs/twenty";
import { resolveBattery } from "./weapon-packs/battery";
import { resolveNeutron } from "./weapon-packs/neutron";
import { resolvePuzzle } from "./weapon-packs/puzzle";
const handlers = {
  Danger: resolveDanger,
  Gamma: resolveGamma,
  Booster: resolveBooster,
  Chasm: resolveChasm,
  Spark: resolveSpark,
  Turbo: resolveTurbo,
  Stomper: resolveStomper,
  Twenty: resolveTwenty,
  Battery: resolveBattery,
  Neutron: resolveNeutron,
  Puzzle: resolvePuzzle,
};
export function simulateReference(
  before: Match,
  player: Player,
  shot: Shot,
  id: ReferenceWeaponId,
): ShotResult {
  const definition = REFERENCE_WEAPONS.find((w) => w.id === id)!;
  const simulation = new Simulation(before, player, shot, definition);
  handlers[definition.packs[0]](simulation, id);
  return simulation.finish();
}
