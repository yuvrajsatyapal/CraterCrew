/** Six-pixel cells preserve tunnels, overhangs and persistent defensive materials. */
export const CELL = 6,
  WORLD_COLS = 200,
  WORLD_ROWS = 107;
export const WORLD_CELLS = WORLD_COLS * WORLD_ROWS;
export const MATERIAL = {
  air: 0,
  dirt: 1,
  concrete: 2,
  rubber: 3,
  glue: 4,
  foam: 5,
  lava: 6,
  goo: 7,
  water: 8,
  ice: 9,
  steel: 10,
  spikes: 11,
  sand: 12,
} as const;
export type Material = (typeof MATERIAL)[keyof typeof MATERIAL];
export interface MaterialWorld {
  cells: number[];
  /** Immutable hill-relative strata; excavation must not repaint surviving dirt. */
  dirtSurface?: number[];
}
export const MATERIAL_COLORS = [
  0x000000, 0x426b25, 0x898e88, 0xd397ba, 0x768a45, 0xcbe8b9, 0xff682e,
  0x72ef45, 0x4298df, 0xa7e6ff, 0xb1b4c2, 0xc1b09c, 0xd8b66b,
];
export function createWorld(surface: number[]): MaterialWorld {
  return {
    dirtSurface: Array.from({ length: WORLD_COLS }, (_, x) =>
      Math.ceil(surface[Math.min(surface.length - 1, x * CELL)] / CELL),
    ),
    cells: Array.from({ length: WORLD_CELLS }, (_, i) => {
      const x = i % WORLD_COLS,
        y = Math.floor(i / WORLD_COLS);
      return y * CELL >= surface[Math.min(surface.length - 1, x * CELL)]
        ? MATERIAL.dirt
        : MATERIAL.air;
    }),
  };
}
export function getCell(world: MaterialWorld, x: number, y: number): Material {
  if (x < 0 || x >= 1200 || y < 0 || y >= WORLD_ROWS * CELL)
    return MATERIAL.air;
  return (world.cells[
    Math.floor(y / CELL) * WORLD_COLS + Math.floor(x / CELL)
  ] ?? MATERIAL.air) as Material;
}
export function circle(
  world: MaterialWorld,
  x: number,
  y: number,
  radius: number,
  material: Material,
  only?: (m: Material) => boolean,
) {
  const left = Math.max(0, Math.floor((x - radius) / CELL)),
    right = Math.min(WORLD_COLS - 1, Math.ceil((x + radius) / CELL));
  const top = Math.max(0, Math.floor((y - radius) / CELL)),
    bottom = Math.min(101, Math.ceil((y + radius) / CELL));
  for (let cy = top; cy <= bottom; cy++)
    for (let cx = left; cx <= right; cx++) {
      if (
        Math.hypot(cx * CELL + CELL / 2 - x, cy * CELL + CELL / 2 - y) > radius
      )
        continue;
      const i = cy * WORLD_COLS + cx;
      if (!only || only(world.cells[i] as Material)) world.cells[i] = material;
    }
}
export function rectangle(
  world: MaterialWorld,
  x: number,
  y: number,
  width: number,
  height: number,
  material: Material,
) {
  for (
    let cy = Math.max(0, Math.floor(y / CELL));
    cy < Math.min(102, Math.ceil((y + height) / CELL));
    cy++
  )
    for (
      let cx = Math.max(0, Math.floor(x / CELL));
      cx < Math.min(WORLD_COLS, Math.ceil((x + width) / CELL));
      cx++
    )
      world.cells[cy * WORLD_COLS + cx] = material;
}
export function line(
  world: MaterialWorld,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  material: Material,
) {
  const steps = Math.min(
    400,
    Math.max(
      1,
      Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(3, radius)),
    ),
  );
  for (let i = 0; i <= steps; i++)
    circle(
      world,
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
      radius,
      material,
    );
}
export function isSolid(material: Material) {
  return (
    material !== MATERIAL.air &&
    material !== MATERIAL.water &&
    material !== MATERIAL.lava &&
    material !== MATERIAL.goo
  );
}
/** Find support beneath this particular pocket, rather than the topmost overhead roof. */
export function supportY(world: MaterialWorld, x: number, y: number) {
  let cy = Math.max(0, Math.min(101, Math.floor(y / CELL)));
  if (isSolid(getCell(world, x, cy * CELL)))
    while (cy > 0 && isSolid(getCell(world, x, (cy - 1) * CELL))) cy--;
  else while (cy < 102 && !isSolid(getCell(world, x, cy * CELL))) cy++;
  return Math.max(70, Math.min(610, cy * CELL));
}
export function surfaceHeights(world: MaterialWorld): number[] {
  const heights = Array.from({ length: WORLD_COLS }, (_, x) => {
    let y = 0;
    while (y < 102 && !isSolid(getCell(world, x * CELL, y * CELL))) y++;
    return Math.max(70, Math.min(610, y * CELL));
  });
  return Array.from({ length: 1200 }, (_, x) => heights[Math.floor(x / CELL)]);
}
export function worldPatch(
  before: MaterialWorld,
  after: MaterialWorld,
): [number, number][] {
  const patch: [number, number][] = [];
  for (let i = 0; i < WORLD_CELLS; i++)
    if (before.cells[i] !== after.cells[i]) patch.push([i, after.cells[i]]);
  return patch;
}
export function applyPatch(
  world: MaterialWorld,
  patch: readonly (readonly [number, number])[],
) {
  for (const [i, value] of patch)
    if (i >= 0 && i < WORLD_CELLS) world.cells[i] = value;
}
