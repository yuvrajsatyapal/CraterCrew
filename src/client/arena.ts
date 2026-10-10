import {
  createWorld,
  applyPatch,
  supportY,
  type MaterialWorld,
} from "../shared/materials";
import { WeaponReplay } from "./replay";
import { tankEventPose } from "../shared/weapon-timeline";
import { drawMaterialWorld, drawReferenceEffects } from "./reference-effects";
import Phaser from "phaser";
import {
  WIDTH,
  HEIGHT,
  terrainAt,
  clamp,
  type Match,
  type Shot,
  type ShotResult,
  type WeaponId,
  type Player,
} from "../shared/game";
import {
  drivePose,
  impactTerrain,
  impactKey,
  fallStep,
  type Pose,
} from "./motion";
import {
  scoreEvents,
  visibleFlightPaths,
  popupProgress,
  popupPose,
  type ScoreEvent,
} from "./feedback";
import { drawFlight, drawBlast, hitFlash } from "./weapon-effects";
import { effectSoundCue, type SoundCue } from "./sound";
const COLORS = [0x88c939, 0xe6a13a];
export class Arena extends Phaser.Scene {
  private terrain!: Phaser.GameObjects.Graphics;
  private tankBodies: Phaser.GameObjects.Container[] = [];
  private poses: Pose[] = [];
  private moving: {
    from: Pose[];
    to: Pose[];
    start: number;
    duration: number;
  } | null = null;
  private aim!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private backdrop!: Phaser.GameObjects.Graphics;
  private scoreLabels: Phaser.GameObjects.Text[] = [];
  private lastTerrain: number[] | null = null;
  private match: Match | null = null;
  private playerAngles: [number, number] = [45, 135];
  private shot: Shot = { angle: 45, power: 60, weapon: "shell" };
  private animation: {
    result: ShotResult;
    start: number;
    done: () => void;
    before: Match;
    terrainKey: number;
    stepMs: number;
    lastTime: number;
    velocities: number[];
    sounded: Set<number>;
    impactTimes: number[];
    scores: ScoreEvent[];
    scored: Set<number>;
    popups: {
      label: Phaser.GameObjects.Text;
      start: number;
      x: number;
      y: number;
      rank: number;
    }[];
    scoreDelta: number;
    scoreTotals: [number, number];
    world?: MaterialWorld;
    replay?: WeaponReplay;
  } | null = null;
  private readyResolve!: () => void;
  readonly ready: Promise<void>;
  reducedMotion = false;
  onlineTiming = false;
  onImpact: (weapon: WeaponId, hit: boolean) => void = () => {};
  onEffectSound: (cue: SoundCue) => void = () => {};
  onScore: (player: Player, points: number) => void = () => {};
  onMovementComplete: () => void = () => {};
  get isMoving() {
    return this.moving !== null;
  }
  constructor() {
    super("Arena");
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }
  create() {
    this.backdrop = this.add.graphics();
    this.drawBackdrop();
    this.terrain = this.add.graphics();
    this.tankBodies = [0, 1].map(() =>
      this.add.container(0, 0, [this.add.graphics()]),
    );
    this.aim = this.add.graphics();
    this.effects = this.add.graphics();
    this.readyResolve();
    if (this.match) this.render(this.match, this.shot);
  }
  private drawBackdrop() {
    const g = this.backdrop;
    g.fillStyle(0x000000);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    // The reference's black sky opens into a purple band near the ground.
    for (let y = 210; y < HEIGHT; y += 2) {
      const t = (y - 210) / (HEIGHT - 210);
      const r = Math.round(99 * t),
        green = Math.round(25 * t),
        b = Math.round(145 * t);
      g.fillStyle((r << 16) | (green << 8) | b);
      g.fillRect(0, y, WIDTH, 2);
    }
  }
  render(match: Match, shot: Shot, angles?: readonly [number, number]) {
    if (!this.terrain || this.animation) return;
    const target = match.tanks.map((t) => ({
      x: t.x,
      y: t.y,
      tilt: this.slope(match, t.x),
    }));
    if (
      this.poses.length &&
      target.some(
        (p, i) =>
          Math.abs(p.y - this.poses[i].y) > 0.1 ||
          Math.abs(p.x - this.poses[i].x) > 0.1,
      )
    )
      this.moving = {
        from: this.poses.map((p) => ({ ...p })),
        to: target,
        start: this.time.now,
        duration: this.reducedMotion ? 100 : 480,
      };
    else if (!this.moving) this.poses = target;
    this.match = match;
    this.shot = shot;
    if (angles) this.playerAngles = [...angles];
    if (match.world) {
      this.lastTerrain = match.terrain;
      drawMaterialWorld(this.terrain, match.world);
    } else this.drawTerrain(match.terrain);
    this.drawTanks();
    this.drawAim();
  }
  private slope(match: Match, x: number) {
    const nearby = match.tanks.reduce((a, b) =>
      Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b,
    );
    const floor = (at: number) =>
      match.world
        ? supportY(match.world, at, nearby.y)
        : terrainAt(match.terrain, at);
    return clamp(Math.atan2(floor(x + 18) - floor(x - 18), 36), -0.6, 0.6);
  }
  private drawTerrain(terrain: number[]) {
    if (terrain === this.lastTerrain) return;
    this.lastTerrain = terrain;
    const g = this.terrain;
    g.clear();
    const layers = [
      { depth: 0, color: 0x46972b },
      { depth: 15, color: 0x3c8525 },
      { depth: 36, color: 0x327321 },
      { depth: 65, color: 0x28621b },
      { depth: 104, color: 0x204f16 },
      { depth: 155, color: 0x173e10 },
    ];
    for (const layer of layers) {
      g.fillStyle(layer.color);
      g.beginPath();
      g.moveTo(0, HEIGHT);
      // Clipping prevents deep layers from crossing their bottom closing edge.
      for (let x = 0; x < WIDTH; x += 2)
        g.lineTo(x, Math.min(HEIGHT, terrain[x] + layer.depth));
      g.lineTo(WIDTH, Math.min(HEIGHT, terrain[WIDTH - 1] + layer.depth));
      g.lineTo(WIDTH, HEIGHT);
      g.closePath();
      g.fillPath();
    }
    g.lineStyle(1.5, 0x67ae38, 0.6);
    g.beginPath();
    g.moveTo(0, terrain[0]);
    for (let x = 2; x < WIDTH; x += 2) g.lineTo(x, terrain[x]);
    g.strokePath();
  }
  private drawTanks() {
    if (!this.match) return;
    this.match.tanks.forEach((tank, i) => {
      const pose = this.poses[i] || { x: tank.x, y: tank.y, tilt: 0 };
      const body = this.tankBodies[i];
      body.setPosition(pose.x, pose.y);
      body.setRotation(pose.tilt);
      const g = body.list[0] as Phaser.GameObjects.Graphics;
      g.clear();
      const active = i === this.match!.turn;
      const color = COLORS[i];
      const light = i === 0 ? 0xc4e88d : 0xffda83;
      const dark = i === 0 ? 0x456c20 : 0x925713;
      g.fillStyle(0x030603, 0.5);
      g.fillEllipse(0, 1, 39, 5);
      g.fillStyle(0x1a2417);
      g.fillRoundedRect(-17, -9, 34, 9, 4);
      g.lineStyle(1, 0x9aa48a);
      g.strokeRoundedRect(-17, -9, 34, 9, 4);
      for (let dx = -12; dx <= 12; dx += 6) {
        g.fillStyle(0x727c62);
        g.fillCircle(dx, -4, 2.5);
        g.fillStyle(0x222c1b);
        g.fillCircle(dx, -4, 1);
      }
      if (this.moving) {
        g.lineStyle(1, 0xd3d7b0, 0.6);
        for (let dx = -15; dx < 15; dx += 5)
          g.lineBetween(
            dx + (Math.round(pose.x) % 5),
            -8,
            dx + 2 + (Math.round(pose.x) % 5),
            -1,
          );
      }
      g.fillStyle(dark);
      g.fillTriangle(-18, -10, -10, -17, 18, -10);
      g.fillStyle(color);
      g.fillRect(-15, -14, 30, 6);
      g.fillStyle(light);
      g.fillTriangle(-15, -14, 11, -17, 16, -13);
      if (active && this.match!.winner === null && !this.animation) {
        g.fillStyle(color);
        g.fillTriangle(-5, -43, 5, -43, 0, -35);
        g.fillRect(-2, -49, 4, 8);
      }
    });
    this.drawAim();
  }
  private drawAim() {
    const g = this.aim;
    g.clear();
    if (!this.match) return;
    this.match.tanks.forEach((tank, i) => {
      const pose = this.poses[i] || { x: tank.x, y: tank.y, tilt: 0 };
      const angle = (this.playerAngles[i] * Math.PI) / 180;
      const x = pose.x,
        y = pose.y - 20;
      const dark = i === 0 ? 0x456c20 : 0x925713;
      g.fillStyle(dark);
      g.fillEllipse(x, y + 3, 19, 12);
      g.fillStyle(COLORS[i]);
      g.fillEllipse(x - 1, y + 1, 18, 10);
      g.fillStyle(i === 0 ? 0xc4e88d : 0xffda83, 0.7);
      g.fillEllipse(x - 3, y - 1, 10, 3);
      // World-space pivot and tip exactly match the shared projectile launch origin.
      g.lineStyle(4, dark);
      g.lineBetween(x, y, x + Math.cos(angle) * 24, y - Math.sin(angle) * 24);
      g.lineStyle(2, 0xd5d9bf);
      g.lineBetween(x, y, x + Math.cos(angle) * 24, y - Math.sin(angle) * 24);
    });
  }
  cancelAnimation(commit = false) {
    const previous = this.animation;
    this.animation = null;
    this.moving = null;
    this.effects?.clear();
    this.scoreLabels.forEach((label) => label.destroy());
    this.scoreLabels = [];
    if (previous && commit) {
      this.poses = [];
      this.render(previous.result.state, previous.result.shot);
    }
    previous?.done();
  }
  animate(result: ShotResult, done: () => void) {
    this.aim.clear();
    if (!this.match) {
      done();
      return;
    }
    this.moving = null;
    this.shot = result.shot;
    this.playerAngles[this.match.turn] = result.shot.angle;
    this.animation = {
      result,
      start: this.time.now,
      done,
      before: structuredClone(this.match),
      terrainKey: -1,
      stepMs: this.reducedMotion && !this.onlineTiming ? 5 : 25,
      lastTime: this.time.now,
      velocities: [0, 0],
      sounded: new Set(),
      impactTimes: result.paths.map(
        (path, i) =>
          result.blasts.find((blast) => blast.pathIndex === i)?.time ??
          path.length + (result.pathStarts?.[i] ?? 0),
      ),
      scores: scoreEvents(this.match, result),
      scored: new Set(),
      popups: [],
      scoreDelta: 0,
      scoreTotals: [this.match.tanks[0].points, this.match.tanks[1].points],
      world: result.events
        ? structuredClone(this.match.world ?? createWorld(this.match.terrain))
        : undefined,
      replay: result.events ? new WeaponReplay(result.events) : undefined,
    };
  }
  update(time: number) {
    if (this.moving && !this.animation) {
      const movement = this.moving;
      const progress = Math.min(1, (time - movement.start) / movement.duration);
      this.poses = movement.from.map((p, i) =>
        drivePose(
          p,
          movement.to[i],
          progress,
          this.match!.terrain,
          this.match!.world,
        ),
      );
      this.drawTanks();
      if (progress === 1) {
        this.moving = null;
        this.drawTanks();
        this.onMovementComplete();
      }
    }
    if (!this.animation) return;
    const a = this.animation;
    const elapsed = (time - a.start) / a.stepMs;
    const seconds =
      (Math.max(0, Math.min(1000, time - a.lastTime)) / 1000) * (25 / a.stepMs);
    a.lastTime = time;
    const g = this.effects;
    g.clear();
    let finished = a.result.events
      ? elapsed >= (a.result.durationTicks ?? 0) + 36
      : true;
    for (const path of a.result.paths) {
      if (elapsed < path.length + 36) finished = false;
    }
    for (const { path, startIndex, offset } of visibleFlightPaths(
      a.result,
      elapsed,
    )) {
      drawFlight(
        g,
        path,
        elapsed - offset,
        startIndex,
        a.result.shot.weapon,
        this.reducedMotion,
      );
    }
    if (a.result.shot.weapon === "airburst") {
      const split = a.result.paths[0].length;
      const splitProgress = (elapsed - split) / 8;
      if (splitProgress >= 0 && splitProgress <= 1) {
        const apex = a.result.paths[0].at(-1)!;
        g.lineStyle(2, 0x83dceb, 1 - splitProgress);
        g.strokeCircle(apex.x, apex.y, 4 + splitProgress * 22);
      }
    }
    a.result.blasts.forEach((blast, i) => {
      const progress =
        (elapsed - (blast.time ?? a.impactTimes[blast.pathIndex])) / 22;
      if (progress >= 0 && !a.sounded.has(i)) {
        a.sounded.add(i);
        const hit = a.before.tanks.some(
          (t) =>
            Math.hypot(t.x - blast.x, t.y - 10 - blast.y) < blast.radius + 24,
        );
        this.onImpact(a.result.shot.weapon, hit);
      }
      if (progress >= 0 && progress <= 1) {
        drawBlast(
          g,
          blast,
          progress,
          a.result.shot.weapon,
          i,
          this.reducedMotion,
        );
      }
    });
    if (a.result.events && a.world) {
      let changed = false;
      for (const event of a.replay!.advance(elapsed)) {
        const cue = effectSoundCue(
          event,
          a.result.shot.weapon,
          elapsed,
          a.stepMs,
        );
        if (cue) this.onEffectSound(cue);
        if (event.type === "terrain") {
          applyPatch(a.world!, event.patch);
          changed = true;
        }
        if (event.type === "aim") this.playerAngles[event.player] = event.angle;
      }
      if (changed || a.terrainKey === -1) {
        drawMaterialWorld(this.terrain, a.world);
        a.terrainKey = elapsed;
      }
      this.poses = a.before.tanks.map((tank, player) => {
        const event = a.replay!.tanks[player];
        return event
          ? tankEventPose(event, elapsed)
          : { x: tank.x, y: tank.y, tilt: this.slope(a.before, tank.x) };
      });
      drawReferenceEffects(g, a.replay!.effects, elapsed, this.reducedMotion);
    } else {
      const impactTimes = a.impactTimes;
      const terrainKey = impactKey(a.result.blasts, impactTimes, elapsed);
      if (terrainKey !== a.terrainKey) {
        a.terrainKey = terrainKey;
        this.drawTerrain(
          impactTerrain(
            a.before.terrain,
            a.result.blasts,
            impactTimes,
            elapsed,
            a.result.shot.weapon === "digger",
          ),
        );
      }
      const surface = this.lastTerrain || a.before.terrain;
      this.poses = a.before.tanks.map((tank, i) => {
        const previous = this.poses[i] || {
          x: tank.x,
          y: tank.y,
          tilt: this.slope(a.before, tank.x),
        };
        const falling = fallStep(
          previous.y,
          terrainAt(surface, tank.x),
          a.velocities[i],
          seconds,
        );
        a.velocities[i] = falling.velocity;
        const tilt = clamp(
          Math.atan2(
            terrainAt(surface, tank.x + 18) - terrainAt(surface, tank.x - 18),
            36,
          ),
          -0.6,
          0.6,
        );
        const pose = {
          x: tank.x,
          y: falling.y,
          tilt:
            previous.tilt + (tilt - previous.tilt) * Math.min(1, seconds * 8),
        };
        return pose;
      });
      if (
        this.poses.some((pose, i) => pose.y < a.result.state.tanks[i].y - 0.5)
      )
        finished = false;
    }
    this.drawTanks();
    a.scores.forEach((event, index) => {
      const pose = this.poses[event.player];
      const landed = a.result.events
        ? true
        : pose.y >= a.result.state.tanks[event.player].y - 0.5;
      if (
        elapsed < event.time ||
        a.scored.has(index) ||
        (event.kind === "fall" && !landed)
      )
        return;
      a.scored.add(index);
      const attacker = event.attacker ?? a.before.turn;
      const self = event.player === attacker;
      a.scoreTotals[attacker] += self ? -event.amount : event.amount;
      this.onScore(attacker, a.scoreTotals[attacker]);
      if (event.kind === "fall") this.onImpact(a.result.shot.weapon, true);
      const label = this.add
        .text(0, 0, `${self ? "−" : "+"}${event.amount}`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "16px",
          fontStyle: "bold",
          color: self ? "#ffb4a0" : "#ffffff",
          stroke: "#151515",
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.scoreLabels.push(label);
      const simultaneous = a.popups.filter(
        (p) =>
          Math.abs(p.x - (event.x ?? pose.x)) < 30 && elapsed - p.start < 10,
      ).length;
      a.popups.push({
        label,
        start: elapsed,
        x: event.x ?? pose.x,
        y: event.y ?? pose.y,
        rank: simultaneous,
      });
    });
    for (const popup of a.popups) {
      const t = popupProgress(
        popup.start,
        elapsed,
        (a.result.durationTicks ?? Math.max(0, ...a.impactTimes)) + 36,
      );
      const presentation = popupPose(popup, t, popup.rank, this.reducedMotion);
      popup.label.setPosition(presentation.x, presentation.y);
      popup.label.setAlpha(presentation.alpha);
      popup.label.setScale(presentation.scale);
      popup.label.setVisible(t < 1);
      if (t < 1) finished = false;
    }
    a.scores.forEach((event, index) => {
      if (!a.scored.has(index)) {
        finished = false;
        return;
      }
      if (event.kind !== "hit") return;
      const alpha = hitFlash(elapsed, event.time);
      if (alpha > 0 && !this.reducedMotion) {
        const pose = this.poses[event.player];
        g.fillStyle(0xffffff, alpha * 0.65);
        g.fillEllipse(pose.x, pose.y - 10, 34, 20);
      }
    });
    if (finished) {
      this.animation = null;
      g.clear();
      this.scoreLabels.forEach((label) => label.destroy());
      this.scoreLabels = [];
      this.render(a.result.state, this.shot);
      a.done();
    }
  }
  setAim(shot: Shot, angles?: readonly [number, number]) {
    this.shot = shot;
    if (angles) this.playerAngles = [...angles];
    else if (this.match) this.playerAngles[this.match.turn] = shot.angle;
    if (this.tankBodies.length && !this.animation) {
      this.drawTanks();
      this.drawAim();
    }
  }
}
export function mountArena(parent: string) {
  const scene = new Arena();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: "#000000",
    scene: [scene],
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60, forceSetTimeOut: false },
    audio: { noAudio: true },
    banner: false,
  });
  const host = document.getElementById(parent)!;
  const observer = new ResizeObserver(() => game.scale.refresh());
  observer.observe(host);
  game.events.once("destroy", () => observer.disconnect());
  return { game, scene };
}
