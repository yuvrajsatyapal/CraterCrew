import type { WeaponEvent } from "../shared/weapon-timeline";

type TankEvent = Extract<WeaponEvent, { type: "tank" }>;
type EffectEvent = Extract<WeaponEvent, { type: "effect" }>;

/** Forward-only playback: consume each event once and keep bounded render state. */
export class WeaponReplay {
  private readonly timeline: WeaponEvent[];
  private cursor = 0;
  readonly tanks: [TankEvent | undefined, TankEvent | undefined] = [
    undefined,
    undefined,
  ];
  effects: EffectEvent[] = [];

  constructor(events: WeaponEvent[]) {
    this.timeline = [...events].sort((a, b) => a.time - b.time);
  }

  advance(elapsed: number): WeaponEvent[] {
    const due: WeaponEvent[] = [];
    while (
      this.cursor < this.timeline.length &&
      this.timeline[this.cursor].time <= elapsed
    ) {
      const event = this.timeline[this.cursor++];
      due.push(event);
      if (event.type === "tank") this.tanks[event.player] = event;
      if (event.type === "effect") this.effects.push(event);
    }
    this.effects = this.effects.filter(
      (event) => elapsed < event.time + event.duration,
    );
    return due;
  }
}
