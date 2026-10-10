import { WIDTH, HEIGHT } from "../shared/game";

/** Fill the screen with playable ground; spare vertical space reveals sky. */
export function arenaView(width: number, height: number) {
  const zoom = Math.min(width / WIDTH, height / HEIGHT);
  const viewWidth = WIDTH;
  const viewHeight = height / zoom;
  return {
    zoom,
    zoomX: width / WIDTH,
    width: viewWidth,
    height: viewHeight,
    left: (WIDTH - viewWidth) / 2,
    top: HEIGHT - viewHeight,
  };
}
