import { WIDTH, HEIGHT } from "../shared/game";

/** Fit the simulation uniformly; spare space reveals scenery around the world. */
export function arenaView(width: number, height: number) {
  const zoom = Math.min(width / WIDTH, height / HEIGHT);
  const viewWidth = width / zoom;
  const viewHeight = height / zoom;
  return {
    zoom,
    width: viewWidth,
    height: viewHeight,
    left: (WIDTH - viewWidth) / 2,
    top: HEIGHT - viewHeight,
  };
}
