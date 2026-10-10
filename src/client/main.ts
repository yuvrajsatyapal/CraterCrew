import "./style.css";
import { tankIllustration, menuLandscape } from "./art";
import {
  botShot,
  createMatch,
  fire,
  move,
  WEAPONS,
  clamp,
  VOLLEYS,
  type Match,
  type Player,
  type Shot,
  type ShotResult,
  type WeaponId,
} from "../shared/game";
import { sound, unlockAudio, playSoundCue, stopAudio } from "./sound";
import { weaponArt } from "./weapon-art";
import { WEAPON_PROFILES, weaponPowerLabel } from "./weapon-profiles";
import { completedShotState } from "./state";
import type { mountArena } from "./arena";
import type { publicRoom } from "../shared/room";
type PublicRoom = ReturnType<typeof publicRoom>;
type Mode = "solo" | "local" | "online";
const app = document.querySelector<HTMLDivElement>("#app")!;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const logo = `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 12 18 5l13 7v13l-13 7-13-7Z" stroke="#7edbd1" stroke-width="2"/><path d="m11 15 7-4 7 4v7l-7 4-7-4Z" fill="#7edbd1"/><path d="m17 11 7 4-7 4-6-4Z" fill="#14252c"/><path d="M18 19v7" stroke="#14252c" stroke-width="2"/></svg>`;
const brand = `<a href="#" class="brand" id="brand" aria-label="CraterCrew home">${logo}<span>Crater<em>Crew</em></span></a>`;
let loadingGame = false;
let sessionVersion = 0;
let animationVersion = 0;
let activeShotRevision = -1;
let mode: Mode = "solo";
let match = createMatch(Date.now());
let arena: ReturnType<typeof mountArena> | null = null;
let aim: Shot = { angle: 45, power: 60, weapon: "shell" };
let playerAngles: [number, number] = [45, 135];
let playerPowers: [number, number] = [60, 60];
let busy = false;
let player: Player = 0;
let room: PublicRoom | null = null;
let socket: WebSocket | null = null;
let roomCode = "";
let reconnectTimer: number | undefined;
let botTimer: number | undefined;
let connectionVersion = 0;
let audio = localStorage.getItem("cc-audio") !== "off";
let reduced =
  localStorage.getItem("cc-motion") === "reduced" ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const endpoint = (
  import.meta.env.VITE_MULTIPLAYER_URL ||
  (location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8787"
    : "")
).replace(/\/$/, "");
let names = ["Nova", "Rook"];
let toastTimer: number | undefined;
let fpsSamples: number[] = [];
function seed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
function escapeText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
function toast(message: string) {
  let el = document.querySelector<HTMLElement>("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el!.hidden = true;
  }, 4000);
}
function header() {
  return `<header class="topbar">${brand}<nav class="top-links"><span class="status mono">Browser artillery / v1.0</span><a href="#" id="how-link">Field manual ↗</a><button class="icon-btn" id="audio-top" aria-pressed="${audio}">${audio ? "Sound on" : "Sound off"}</button></nav></header>`;
}
function bindHeader() {
  const brandLink = document.querySelector<HTMLElement>("#brand");
  if (brandLink)
    brandLink.onclick = (e: MouseEvent) => {
      e.preventDefault();
      if (arena || socket) {
        $<HTMLDialogElement>("#exit-dialog").showModal();
      } else home();
    };
  const help = document.querySelector("#how-link");
  if (help)
    (help as HTMLElement).onclick = (e) => {
      e.preventDefault();
      $<HTMLDialogElement>("#help-dialog").showModal();
    };
  $("#audio-top").onclick = () => {
    unlockAudio();
    audio = !audio;
    if (!audio) stopAudio();
    localStorage.setItem("cc-audio", audio ? "on" : "off");
    $("#audio-top").textContent = audio ? "Sound on" : "Sound off";
    $("#audio-top").setAttribute("aria-pressed", String(audio));
    sound("click", audio);
    updatePreferences();
  };
}
function commonDialogs() {
  return `<dialog id="help-dialog"><button class="dialog-close" data-close aria-label="Close manual">×</button><div class="eyebrow">FIELD MANUAL / 001</div><h2>Every shot changes the game.</h2><p>Take turns launching shells. Play ten volleys each. Hits and falls score points; hitting yourself subtracts points. The highest score wins. Tanks stay in play until the last volley.</p><div class="help-grid"><b>01</b><span>Set your angle and power. 0° fires right, 90° straight up, and 180° left. Use the barrel direction to aim — there is no projected flight path.</span><b>02</b><span>Watch the wind. Choose a weapon. Standard shells are unlimited; each special weapon has three rounds.</span><b>03</b><span>Move to improve your position. You have six short moves per turn, but steep slopes block your path.</span><b>04</b><span>Keyboard: ← → adjust angle, ↑ ↓ adjust power, Space fires. A / D moves. Online turns last 60 seconds.</span></div><p>Designed for mouse and touch. Landscape gives you more room on a phone.</p><button class="primary" data-close>Got it <span>↗</span></button></dialog><dialog id="exit-dialog"><h2>Leave the battlefield?</h2><p>Local progress will be lost. In an online match, disconnecting for 30 seconds forfeits your tank.</p><div class="dialog-actions"><button class="secondary" data-close>Keep playing</button><button class="primary" id="confirm-exit">Leave match ↗</button></div></dialog>`;
}
function bindDialogs() {
  document
    .querySelectorAll<HTMLElement>("[data-close]")
    .forEach((el) => (el.onclick = () => el.closest("dialog")?.close()));
  document.querySelectorAll<HTMLDialogElement>("dialog").forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    }),
  );
  const exit = document.querySelector("#confirm-exit");
  if (exit) (exit as HTMLElement).onclick = () => home();
}

function disposeArena() {
  animationVersion++;
  activeShotRevision = -1;
  loadingGame = false;
  arena?.scene.cancelAnimation();
  arena?.game.destroy(true);
  arena = null;
}
function home() {
  sessionVersion++;
  document.body.classList.remove("playing");
  disposeArena();
  clearTimeout(botTimer);
  clearTimeout(reconnectTimer);
  connectionVersion++;
  socket?.close(1000, "Left match");
  socket = null;
  room = null;
  busy = false;
  history.replaceState(null, "", location.pathname);
  app.innerHTML = `${header()}<main class="arcade-home"><div class="menu-landscape" aria-hidden="true">${menuLandscape}</div><section class="arcade-menu" aria-label="Game menu"><div class="arcade-wordmark" aria-hidden="true"><span>Crater</span><strong>Crew</strong></div><h1 class="sr-only">CraterCrew</h1><p class="menu-subtitle">The artillery game</p><div class="arcade-menu-buttons"><button id="quick-play" class="metal-button menu-start">Start Game</button><button id="local-play" class="metal-button">Two Players</button><button id="solo-play" class="metal-button">Target Practice</button><button id="online-play" class="metal-button">Online Game</button></div><p class="menu-instructions">Choose your weapon. Set your angle. Take your shot.</p><p class="menu-version">10 volleys · ${WEAPONS.length} weapons · destructible terrain</p></section><div class="menu-tank" aria-hidden="true">${tankIllustration}</div></main>${commonDialogs()}${onlineDialog()}`;
  bindHeader();
  bindDialogs();
  $("#quick-play").onclick = () => void start("solo");
  $("#solo-play").onclick = () => void start("solo");
  $("#local-play").onclick = () => void start("local");
  $("#online-play").onclick = () => {
    $<HTMLDialogElement>("#online-dialog").showModal();
  };
  bindOnlineDialog();
}
function weaponDialog() {
  return `<dialog id="weapon-dialog" class="arsenal" aria-labelledby="arsenal-title"><button class="dialog-close" data-close aria-label="Close weapons">×</button><h2 id="arsenal-title">Select a weapon</h2><p>Choose your ammunition, then set angle and power. Suggested power is a starting point; damage depends on hits and effects.</p><div class="arsenal-tools"><label><span>Search</span><input id="weapon-search" type="search" aria-label="Search weapons" placeholder="Find a weapon" autocomplete="off"></label><label><span>Pack</span><select id="weapon-pack" aria-label="Weapon pack"><option value="all">All packs</option><option value="Original">Original</option>${[...new Set(WEAPONS.flatMap((w) => [...(w.packs ?? [])]))].map((pack) => `<option value="${pack}">${pack}</option>`).join("")}</select></label></div><p id="weapon-results" class="arsenal-results" aria-live="polite">${WEAPONS.length} weapons</p><div class="arsenal-list">${WEAPONS.map((w) => `<button class="arsenal-weapon" data-weapon="${w.id}" data-packs="${(w.packs ?? ["Original"]).join("|")}" aria-pressed="false"><span class="arsenal-icon">${weaponArt(w.id)}</span><span class="arsenal-info"><strong>${w.name}</strong><span>${w.description}</span><small>${(w.packs ?? ["Original"]).join(" / ")}</small><span class="weapon-stats"><span class="weapon-power">${weaponPowerLabel(WEAPON_PROFILES[w.id])}</span><span>Damage ${WEAPON_PROFILES[w.id].damage}</span></span></span><span class="weapon-stock">${w.ammo === -1 ? "Unlimited" : `${w.ammo} rounds`}</span></button>`).join("")}</div></dialog>`;
}
function onlineDialog() {
  return `<dialog id="online-dialog"><button class="dialog-close" data-close aria-label="Close online menu">×</button><div class="eyebrow">PRIVATE ROOM / 003</div><h2>Pick your nemesis.</h2><p>Create a room and share the link, or enter an invitation code. Two players. One cratered battlefield.</p><label class="field">Your callsign<input id="callsign" maxlength="18" value="${escapeText(localStorage.getItem("cc-name") || "Nova")}" autocomplete="nickname"></label><button class="primary" id="create-room">Create room <span>↗</span></button><div class="divider"></div><label class="field">Invitation code<input id="join-code" placeholder="16-character room code" maxlength="16" autocapitalize="none" spellcheck="false"></label><button class="secondary" id="join-room">Join room ↗</button><p class="error" id="online-error" role="alert"></p>${!endpoint ? "<p>Online play needs a deployed multiplayer Worker. Solo and couch duels are ready now.</p>" : ""}</dialog>`;
}
function bindOnlineDialog() {
  $("#create-room").onclick = () => void createRoom();
  $("#join-room").onclick = () =>
    void joinOnline(
      $<HTMLInputElement>("#join-code").value.trim().toLowerCase(),
    );
  $("#join-code").addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter")
      void joinOnline(
        $<HTMLInputElement>("#join-code").value.trim().toLowerCase(),
      );
  });
}
function getCallsign() {
  const name =
    $<HTMLInputElement>("#callsign").value.trim().slice(0, 18) || "Pilot";
  localStorage.setItem("cc-name", name);
  return name;
}
async function createRoom() {
  const el = $<HTMLButtonElement>("#create-room");
  el.disabled = true;
  try {
    if (!endpoint)
      throw Error("Configure the multiplayer Worker to enable online play.");
    const response = await fetch(`${endpoint}/api/rooms`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "Unable to create room.");
    await joinOnline(body.code);
  } catch (e) {
    $("#online-error").textContent =
      e instanceof Error
        ? e.message
        : "Unable to reach multiplayer. Start the local Worker or check your connection.";
  } finally {
    el.disabled = false;
  }
}
async function joinOnline(code: string) {
  if (!endpoint) {
    $("#online-error").textContent =
      "Configure the multiplayer Worker to enable online play.";
    return;
  }
  if (!/^[a-f0-9]{16}$/.test(code)) {
    $("#online-error").textContent =
      "Enter a valid 16-character invitation code.";
    return;
  }
  const name = getCallsign();
  sessionVersion++;
  disposeArena();
  roomCode = code;
  mode = "online";
  playerAngles = [45, 135];
  playerPowers = [60, 60];
  room = null;
  player = 0;
  busy = false;
  clearTimeout(botTimer);
  disposeArena();
  history.replaceState(null, "", `${location.pathname}?room=${code}`);
  showLobby();
  connect(name);
}
function token() {
  const key = `cc-token-${roomCode}`;
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
}
function connect(name: string) {
  const version = ++connectionVersion;
  const url = new URL(`${endpoint}/api/rooms/${roomCode}/connect`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token());
  url.searchParams.set("name", name);
  socket = new WebSocket(url);
  socket.onopen = () => {
    if (version !== connectionVersion) return;
    busy = false;
    updateControls();
    toast("Connected to the crew.");
  };
  socket.onmessage = (e) => {
    if (version !== connectionVersion) return;
    const data = JSON.parse(e.data);
    if (data.type === "identity") {
      player = data.player;
      updateLobby();
      updateControls();
    }
    if (data.type === "error") toast(data.message);
    if (data.type === "shot") {
      void animateShot(data.result);
    }
    if (data.type === "state") {
      room = data.room;
      if (room!.resolvingUntil > Date.now())
        window.setTimeout(
          () => updateControls(),
          room!.resolvingUntil - Date.now() + 50,
        );
      names = room!.members.map((m) => m.name);
      match = room!.match;
      if (busy && arena && match.revision > activeShotRevision) {
        animationVersion++;
        arena.scene.cancelAnimation();
        busy = false;
      }
      if (room!.phase === "lobby") updateLobby();
      else if (!arena && !loadingGame) {
        void showGame();
      } else if (arena && !busy) {
        arena.scene.render(match, aim, playerAngles);
        updateControls();
      } else updateStatus();
    }
  };
  socket.onclose = (e) => {
    if (version !== connectionVersion) return;
    if (e.code === 4000 || e.code === 4001) {
      toast(e.reason || "Room closed.");
      return;
    }
    toast("Connection lost. Reconnecting…");
    busy = true;
    updateControls();
    reconnectTimer = window.setTimeout(() => {
      if (version === connectionVersion) connect(name);
    }, 1800);
  };
  socket.onerror = () => {
    if (!room) {
      $("#lobby-status").textContent =
        "Unable to connect. Check the room code and multiplayer server.";
    }
  };
}
function showLobby() {
  app.innerHTML = `${header()}<main class="home"><div class="eyebrow">PRIVATE ROOM / CREW ASSEMBLY</div><h1 style="font-size:56px">Two seats.<br><em>One rivalry.</em></h1><p class="muted">Share this invitation with your opponent.</p><span class="room-code">${roomCode}</span><div class="dialog-actions"><button id="copy-link" class="primary">Copy invite link ↗</button><button id="back-home" class="secondary">Back to base</button></div><div class="crew-list" id="crew-list"></div><p id="lobby-status" class="muted" role="status">Connecting to room…</p><button id="ready" class="primary" disabled>Ready for battle ↗</button><p class="muted" style="font-size:12px">Both pilots must be ready. Online turns last 60 seconds.</p></main>${commonDialogs()}`;
  bindHeader();
  bindDialogs();
  $("#copy-link").onclick = () =>
    void navigator.clipboard.writeText(location.href).then(
      () => toast("Invite link copied."),
      () => toast(`Invite code: ${roomCode}`),
    );
  $("#back-home").onclick = () => home();
  $("#ready").onclick = () => send({ type: "ready" });
}
function updateLobby() {
  if (!room || !document.querySelector("#crew-list")) return;
  $("#crew-list").innerHTML = [0, 1]
    .map((i) => {
      const m = room!.members[i];
      return `<div class="crew-seat"><b style="color:${i === 0 ? "var(--cyan)" : "var(--orange)"}">${m ? escapeText(m.name) : "Open seat"}</b><small>${m ? (m.ready ? "READY TO ROLL" : m.connected ? "CONNECTED · NOT READY" : "DISCONNECTED") : "Waiting for your rival…"}</small></div>`;
    })
    .join("");
  $("#lobby-status").textContent =
    room.members.length < 2
      ? "Waiting for a second pilot."
      : room.members.every((m) => m.connected)
        ? "Crew assembled. Both pilots: press Ready."
        : "Waiting for your rival to reconnect.";
  $<HTMLButtonElement>("#ready").disabled =
    room.members[player]?.ready || socket?.readyState !== WebSocket.OPEN;
}
function send(message: unknown) {
  if (socket?.readyState !== WebSocket.OPEN) {
    toast("Waiting for the connection.");
    return;
  }
  socket.send(JSON.stringify(message));
}
async function start(next: Mode) {
  sessionVersion++;
  disposeArena();
  clearTimeout(botTimer);
  fpsSamples = [];
  mode = next;
  match = createMatch(seed());
  names = next === "solo" ? ["Nova", "Auto / Rook"] : ["Nova", "Rook"];
  room = null;
  player = 0;
  aim = { angle: 45, power: 60, weapon: "shell" };
  playerAngles = [45, 135];
  playerPowers = [60, 60];
  busy = false;
  await showGame();
}
async function showGame() {
  const session = sessionVersion;
  loadingGame = true;
  document.body.classList.add("playing");
  app.innerHTML = `<main class="game-shell"><section class="hud" aria-label="Match scoreboard"><div class="player"><div class="player-badge">01</div><div class="player-info"><div class="player-meta"><b id="name-0"></b><span id="score-0">0</span></div></div></div><div class="turn-label" id="turn-label" aria-live="polite"></div><div class="player right"><div class="player-badge">02</div><div class="player-info"><div class="player-meta"><b id="name-1"></b><span id="score-1">0</span></div></div></div></section><div class="arena-frame" tabindex="0" role="img" aria-label="Complete battlefield with two tanks and destructible terrain"><div id="arena" class="arena-stage"></div><span class="arena-tag mono"><span id="round-count"></span></span><span id="wind" class="wind-tag mono"></span><div id="battle-message" class="battle-message"></div></div><section id="battle-controls" class="control-panel" aria-label="Tank controls"><div class="console-wordmark" aria-hidden="true"><span>Crater</span><strong>Crew</strong><small>ARTILLERY</small></div><div class="movement console-module"><span class="console-label">Move</span><div class="number-controls"><button id="move-left" class="metal-step" aria-label="Move tank left"><span class="key-arrow key-arrow-double-left" aria-hidden="true"></span></button><span id="fuel-label" class="number-well">6</span><button id="move-right" class="metal-step" aria-label="Move tank right"><span class="key-arrow key-arrow-double-right" aria-hidden="true"></span></button></div></div><button id="fire" class="fire-btn" aria-label="Fire"><img src="/ui/fire-lettering.png" class="fire-lettering" alt="" aria-hidden="true"></button><div class="angle-module console-module"><span class="console-label">Angle</span><div class="number-controls"><button id="angle-down" class="metal-step" aria-label="Decrease angle"><span class="key-arrow key-arrow-left" aria-hidden="true"></span></button><button id="angle-edit" class="number-well" aria-label="Adjust angle"><output id="angle-value">45°</output></button><button id="angle-up" class="metal-step" aria-label="Increase angle"><span class="key-arrow key-arrow-right" aria-hidden="true"></span></button></div></div><div class="weapon-picker console-module"><label class="console-label" for="weapon">Weapon</label><div class="weapon-controls"><span id="weapon-icon" aria-hidden="true">●</span><button id="weapon-open" class="weapon-readout" aria-label="Choose weapon" aria-haspopup="dialog"><span id="weapon-name">Standard</span></button><select id="weapon" hidden aria-hidden="true" tabindex="-1" aria-label="Weapon">${WEAPONS.map((w) => `<option value="${w.id}">${w.name}</option>`).join("")}</select><div class="weapon-arrows"><button id="weapon-prev" class="metal-step" aria-label="Previous weapon"><span class="key-arrow key-arrow-up" aria-hidden="true"></span></button><button id="weapon-next" class="metal-step" aria-label="Next weapon"><span class="key-arrow key-arrow-down" aria-hidden="true"></span></button></div></div><span id="ammo-label" class="ammo-readout"></span><div id="weapon-desc" class="sr-only"></div></div><div class="power-module console-module"><div class="power-meter" aria-hidden="true"><i id="power-fill"></i></div><div class="number-controls"><span class="console-label">Power</span><button id="power-down" class="metal-step" aria-label="Decrease power"><span class="key-arrow key-arrow-left" aria-hidden="true"></span></button><button id="power-edit" class="number-well" aria-label="Adjust power"><output id="power-value">60%</output></button><button id="power-up" class="metal-step" aria-label="Increase power"><span class="key-arrow key-arrow-right" aria-hidden="true"></span></button></div></div><div class="console-tank" aria-hidden="true">${tankIllustration}</div></section><section id="aim-editor" class="aim-editor" hidden aria-label="Fine aiming controls"><div class="ruler-wrap"><div id="angle-ruler"><div id="angle-dial" class="angle-dial" aria-hidden="true"><svg viewBox="0 0 240 130"><path d="M15 115a105 105 0 0 1 210 0" fill="none" stroke="currentColor" stroke-width="2"/>${Array.from(
    { length: 19 },
    (_, i) => {
      const r = (i * Math.PI) / 18;
      return `<path d="M${120 + Math.cos(r) * 105} ${115 - Math.sin(r) * 105} L${120 + Math.cos(r) * (i % 3 ? 98 : 90)} ${115 - Math.sin(r) * (i % 3 ? 98 : 90)}" stroke="currentColor" stroke-width="${i % 3 ? 1 : 2}"/>`;
    },
  ).join(
    "",
  )}<text x="10" y="128">180</text><text x="111" y="16">90</text><text x="225" y="128">0</text><g id="dial-needle"><path d="M120 115h87" stroke="#ed9d29" stroke-width="4"/><circle cx="120" cy="115" r="6" fill="#d7dfbd"/></g></svg></div><label class="sr-only" for="angle">Aim angle</label><input id="angle" type="range" min="0" max="180" step="1" value="45" aria-label="Aim angle"><div class="ruler-labels"><span>0</span><span>30</span><span>60</span><span>90</span><span>120</span><span>150</span><span>180</span></div></div><div id="power-ruler" hidden><div id="power-instrument" class="power-instrument" aria-hidden="true"><i id="instrument-fill"></i></div><label class="sr-only" for="power">Shot power</label><input id="power" type="range" min="10" max="100" step="1" value="60" aria-label="Shot power"><div class="ruler-labels"><span>10</span><span>25</span><span>40</span><span>55</span><span>70</span><span>85</span><span>100</span></div></div></div><button id="aim-minus" class="adjust-step" aria-label="Decrease aim value"><span class="editor-arrow editor-arrow-left" aria-hidden="true"></span></button><div class="ruler-readout"><span id="ruler-label">ANGLE</span><output id="ruler-value">45°</output></div><button id="aim-plus" class="adjust-step" aria-label="Increase aim value"><span class="editor-arrow" aria-hidden="true"></span></button><button id="aim-confirm" class="aim-confirm" aria-label="Confirm aim">✓</button></section><div class="under-controls"><button id="leave-game" class="icon-btn">Menu</button><span class="game-hint mono">10 VOLLEYS · HIGHEST SCORE WINS</span><div class="preferences"><button class="icon-btn" id="audio-top" aria-pressed="${audio}">${audio ? "Sound on" : "Sound off"}</button><button class="icon-btn" id="motion" aria-pressed="${reduced}">Reduced FX</button><button class="icon-btn" id="manual">? Manual</button></div></div></main>${commonDialogs()}${weaponDialog()}<dialog id="result-dialog"><div class="eyebrow">FINAL SCORE</div><h2 id="result-title"></h2><p id="result-copy"></p><div class="dialog-actions"><button id="rematch" class="primary">Play Again</button><button id="result-home" class="secondary">Main Menu</button></div></dialog>`;
  bindHeader();
  bindDialogs();
  // Phaser consumes canvas pointer defaults; explicitly restore game-keyboard focus.
  $(".arena-frame").addEventListener(
    "pointerdown",
    () => {
      $(".arena-frame").focus({ preventScroll: true });
    },
    { capture: true },
  );
  $("#leave-game").onclick = () =>
    $<HTMLDialogElement>("#exit-dialog").showModal();
  $("#manual").onclick = () => $<HTMLDialogElement>("#help-dialog").showModal();
  $("#motion").onclick = () => {
    reduced = !reduced;
    localStorage.setItem("cc-motion", reduced ? "reduced" : "full");
    updatePreferences();
  };
  $("#rematch").onclick = () => {
    if (mode === "online") {
      send({ type: "rematch" });
      $("#result-copy").textContent =
        "Rematch requested. Waiting for your rival…";
      $<HTMLButtonElement>("#rematch").disabled = true;
    } else {
      $<HTMLDialogElement>("#result-dialog").close();
      void start(mode);
    }
  };
  $("#result-home").onclick = () => home();
  $("#weapon-open").onclick = () => {
    if (!canPlay()) return;
    updateWeapon();
    sound("click", audio);
    $<HTMLDialogElement>("#weapon-dialog").showModal();
    document
      .querySelector<HTMLButtonElement>(`[data-weapon="${aim.weapon}"]`)
      ?.focus();
    if (!(document.activeElement as HTMLElement)?.closest("[data-weapon]"))
      $("#weapon-search").focus();
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-weapon]")
    .forEach((button) => {
      button.onclick = () => {
        if (
          !canPlay() ||
          match.tanks[match.turn].ammo[button.dataset.weapon as WeaponId] === 0
        )
          return;
        $<HTMLSelectElement>("#weapon").value = button.dataset.weapon!;
        readAim();
        sound("click", audio);
        $<HTMLDialogElement>("#weapon-dialog").close();
        $("#weapon-open").focus();
      };
    });
  const filterArsenal = () => {
    const query = $<HTMLInputElement>("#weapon-search")
      .value.trim()
      .toLowerCase();
    const pack = $<HTMLSelectElement>("#weapon-pack").value;
    let count = 0;
    document
      .querySelectorAll<HTMLButtonElement>("[data-weapon]")
      .forEach((button) => {
        const definition = WEAPONS.find((w) => w.id === button.dataset.weapon)!;
        const visible =
          `${definition.name} ${definition.description}`
            .toLowerCase()
            .includes(query) &&
          (pack === "all" || button.dataset.packs!.split("|").includes(pack));
        button.hidden = !visible;
        if (visible) count++;
      });
    $("#weapon-results").textContent = count
      ? `${count} weapon${count === 1 ? "" : "s"}`
      : "No weapons match. Try another name or pack.";
  };
  $("#weapon-search").addEventListener("input", filterArsenal);
  $("#weapon-pack").addEventListener("change", filterArsenal);
  $("#weapon-search").addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      document
        .querySelector<HTMLButtonElement>(
          ".arsenal-weapon:not([hidden]):not(:disabled)",
        )
        ?.focus();
    }
  });
  $("#weapon-dialog").addEventListener("keydown", (event: KeyboardEvent) => {
    const selected = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-weapon]",
    );
    if (
      !selected ||
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".arsenal-weapon:not([hidden]):not(:disabled)",
      ),
    );
    const index = buttons.indexOf(selected),
      next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length;
    buttons[next]?.focus();
  });
  $("#weapon-prev").onclick = () => cycleWeapon(-1);
  $("#weapon-next").onclick = () => cycleWeapon(1);
  for (const control of ["angle", "power"] as const) {
    $(`#${control}-down`).onclick = () => adjustAim(control, -1);
    $(`#${control}-up`).onclick = () => adjustAim(control, 1);
  }
  $("#angle-edit").onclick = () => openAim("angle");
  $("#power-edit").onclick = () => openAim("power");
  $("#aim-confirm").onclick = () => {
    const control = $("#aim-editor").dataset.control;
    closeAim();
    document.querySelector<HTMLButtonElement>(`#${control}-edit`)?.focus();
  };
  $("#aim-minus").onclick = () => stepAim(-1);
  $("#aim-plus").onclick = () => stepAim(1);
  $("#angle").addEventListener("input", readAim);
  $("#power").addEventListener("input", readAim);
  $("#weapon").addEventListener("change", readAim);
  $("#fire").onclick = () => void shoot();
  $("#move-left").onclick = () => movement(-1);
  $("#move-right").onclick = () => movement(1);
  const module = await import("./arena");
  if (session !== sessionVersion) return;
  if (!document.querySelector("#arena")) {
    loadingGame = false;
    return;
  }
  const mounted = module.mountArena("arena");
  arena = mounted;
  await mounted.scene.ready;
  if (session !== sessionVersion || arena !== mounted) return;
  arena.scene.reducedMotion = reduced;
  arena.scene.onlineTiming = mode === "online";
  arena.scene.onImpact = (weapon, hit) => {
    sound("impact", audio, weapon);
    if (hit) sound("hit", audio, weapon);
  };
  arena.scene.onEffectSound = (cue) => playSoundCue(cue, audio);
  arena.scene.onScore = (shooter, points) => {
    $(`#score-${shooter}`).textContent = String(points);
  };
  arena.scene.onMovementComplete = updateControls;
  arena.game.events.on("step", () => {
    const value = arena?.game.loop.actualFps;
    if (value && fpsSamples.length < 300) fpsSamples.push(value);
  });
  loadingGame = false;
  busy = false;
  for (const p of [0, 1] as const) {
    const saved = match.tanks[p].lastAim;
    if (saved) {
      playerAngles[p] = saved.angle;
      playerPowers[p] = saved.power;
    }
  }
  aim.angle = playerAngles[aimingPlayer()];
  aim.power = playerPowers[aimingPlayer()];
  $<HTMLInputElement>("#angle").value = String(aim.angle);
  $<HTMLInputElement>("#power").value = String(aim.power);
  readAim();
  updateControls();
  arena.scene.render(match, aim, playerAngles);
}
function openAim(control: "angle" | "power") {
  if (!canPlay()) return;
  $("#aim-editor").dataset.control = control;
  $("#aim-editor").hidden = false;
  $("#battle-controls").hidden = true;
  $("#angle-ruler").hidden = control !== "angle";
  $("#power-ruler").hidden = control !== "power";
  $("#ruler-label").textContent = control === "power" ? "Power" : "Angle";
  readAim();
  $<HTMLInputElement>(`#${control}`).focus();
}
function closeAim() {
  const editor = document.querySelector<HTMLElement>("#aim-editor");
  if (editor) editor.hidden = true;
  const controls = document.querySelector<HTMLElement>("#battle-controls");
  if (controls) controls.hidden = false;
}
function stepAim(direction: number) {
  const control =
    $("#aim-editor").dataset.control === "power" ? "power" : "angle";
  const input = $<HTMLInputElement>(`#${control}`);
  input.value = String(
    clamp(
      Number(input.value) + direction,
      Number(input.min),
      Number(input.max),
    ),
  );
  readAim();
}
function cycleWeapon(direction: number) {
  if (!canPlay()) return;
  const available = WEAPONS.filter(
    (w) => match.tanks[match.turn].ammo[w.id] !== 0,
  );
  const index = available.findIndex((w) => w.id === aim.weapon);
  $<HTMLSelectElement>("#weapon").value =
    available[(index + direction + available.length) % available.length].id;
  readAim();
}
function adjustAim(control: "angle" | "power", direction: number) {
  if (!canPlay()) return;
  const input = $<HTMLInputElement>(`#${control}`);
  input.value = String(
    clamp(
      Number(input.value) + direction,
      Number(input.min),
      Number(input.max),
    ),
  );
  readAim();
}
function aimingPlayer(): Player {
  return mode === "online" ? player : mode === "solo" ? 0 : match.turn;
}
function readAim() {
  aim = {
    angle: Number($<HTMLInputElement>("#angle").value),
    power: Number($<HTMLInputElement>("#power").value),
    weapon: $<HTMLSelectElement>("#weapon").value as WeaponId,
  };
  playerAngles[aimingPlayer()] = aim.angle;
  playerPowers[aimingPlayer()] = aim.power;
  $("#angle-value").textContent = `${aim.angle}°`;
  $("#power-value").textContent = `${aim.power}%`;
  $("#power-fill").style.width = `${aim.power}%`;
  $("#instrument-fill").style.width = `${aim.power}%`;
  $("#power").style.setProperty(
    "--power-position",
    `${((aim.power - 10) / 90) * 100}%`,
  );
  $("#angle-ruler .ruler-labels").innerHTML = [-10, -5, 0, 5, 10]
    .map(
      (offset) =>
        `<span>${aim.angle + offset < 0 || aim.angle + offset > 180 ? "" : aim.angle + offset}</span>`,
    )
    .join("");
  $("#dial-needle").setAttribute("transform", `rotate(${-aim.angle} 120 115)`);
  const active =
    document.querySelector<HTMLElement>("#aim-editor")?.dataset.control;
  $("#ruler-value").textContent =
    active === "power" ? `${aim.power}%` : `${aim.angle}°`;
  arena?.scene.setAim(aim, playerAngles);
  updateWeapon();
}
function canPlay() {
  return (
    !busy &&
    !arena?.scene.isMoving &&
    match.winner === null &&
    (mode !== "solo" || match.turn === 0) &&
    (mode !== "online" ||
      (room?.phase === "playing" &&
        !room.paused &&
        Date.now() >= room.resolvingUntil &&
        match.turn === player &&
        socket?.readyState === WebSocket.OPEN))
  );
}
function updatePreferences() {
  const el = document.querySelector("#motion");
  if (el) el.setAttribute("aria-pressed", String(reduced));
  if (arena) {
    arena.scene.reducedMotion = reduced;
    arena.scene.onlineTiming = mode === "online";
  }
}
function updateWeapon() {
  if (!document.querySelector("#weapon")) return;
  const tank = match.tanks[match.turn];
  const weapon = WEAPONS.find((w) => w.id === aim.weapon)!;
  $("#weapon-desc").textContent = weapon.description;
  $("#weapon-icon").innerHTML = weaponArt(weapon.id);
  $("#weapon-name").textContent = weapon.name;
  document
    .querySelectorAll<HTMLButtonElement>("[data-weapon]")
    .forEach((button) => {
      const id = button.dataset.weapon as WeaponId;
      const ammo = tank.ammo[id];
      button.disabled = !canPlay() || ammo === 0;
      button.setAttribute("aria-pressed", String(id === aim.weapon));
      button.querySelector(".weapon-stock")!.textContent =
        ammo === -1 ? "Unlimited" : ammo === 0 ? "Empty" : `${ammo} rounds`;
    });
  $("#ammo-label").textContent =
    tank.ammo[weapon.id] === -1 ? "∞" : `${tank.ammo[weapon.id]} LEFT`;
  Array.from($<HTMLSelectElement>("#weapon").options).forEach((option) => {
    option.disabled = tank.ammo[option.value as WeaponId] === 0;
  });
}
function updateControls() {
  if (!document.querySelector("#fire")) return;
  for (let i = 0; i < 2; i++) {
    $(`#name-${i}`).textContent = names[i] || "Pilot";
    $(`#score-${i}`).textContent = String(match.tanks[i].points);
  }
  const allowed = canPlay();
  [
    "angle",
    "power",
    "weapon",
    "weapon-open",
    "fire",
    "move-left",
    "move-right",
    "angle-edit",
    "power-edit",
    "aim-minus",
    "aim-plus",
    "weapon-prev",
    "weapon-next",
    "angle-down",
    "angle-up",
    "power-down",
    "power-up",
  ].forEach((id) => {
    ($(`#${id}`) as HTMLInputElement | HTMLButtonElement).disabled = !allowed;
  });
  $("#fuel-label").textContent = String(
    Math.floor(match.tanks[match.turn].fuel / 10),
  );
  if (match.tanks[match.turn].fuel < 10) {
    $<HTMLButtonElement>("#move-left").disabled = true;
    $<HTMLButtonElement>("#move-right").disabled = true;
  }
  if (match.tanks[match.turn].ammo[aim.weapon] === 0) {
    aim.weapon = "shell";
    $<HTMLSelectElement>("#weapon").value = "shell";
  }
  updateWeapon();
  updateStatus();
  if (match.winner !== null && !busy) result();
  else if (match.winner === null) {
    if ($<HTMLDialogElement>("#result-dialog").open)
      $<HTMLDialogElement>("#result-dialog").close();
    $<HTMLButtonElement>("#rematch").disabled = false;
  }
}
function updateStatus() {
  if (!document.querySelector("#turn-label")) return;
  const end = match.winner !== null;
  const volley = Math.min(VOLLEYS, Math.floor(match.shots / 2) + 1);
  const ordinal =
    volley === 1 ? "st" : volley === 2 ? "nd" : volley === 3 ? "rd" : "th";
  $("#turn-label").innerHTML =
    `${end ? "Final Score" : `${volley}${ordinal} Volley`}<small>${busy ? "Shot in flight" : room?.paused ? "Disconnected" : `${escapeText(names[match.turn] || "Pilot")}’s turn`}${mode === "online" && !end ? ` · <span id="timer">${room?.deadline ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)) : 60}s</span>` : ""}</small>`;
  $("#battle-controls").dataset.player = String(match.turn);
  $("#wind").textContent =
    `WIND ${match.wind < 0 ? "←" : "→"} ${Math.abs(match.wind)} m/s`;
  $("#round-count").textContent = "";
  $("#battle-message").textContent = room?.paused
    ? "Waiting for your rival…"
    : "";
}
async function shoot(shot = aim) {
  if (!canPlay()) return;
  closeAim();
  try {
    unlockAudio();
    if (mode === "online") {
      send({ type: "fire", revision: match.revision, ...shot });
      return;
    }
    const result = fire(match, match.turn, shot);
    await animateShot(result);
  } catch (error) {
    toast(error instanceof Error ? error.message : "Shot failed.");
  }
}
async function animateShot(shot: ShotResult) {
  const shooter: Player = shot.state.turn === 0 ? 1 : 0;
  playerAngles[shooter] = shot.shot.angle;
  playerPowers[shooter] = shot.shot.power;
  if (!arena) {
    match = completedShotState(
      shot.state,
      mode === "online" ? room?.match : undefined,
    );
    return;
  }
  const mounted = arena,
    session = sessionVersion,
    animation = ++animationVersion;
  closeAim();
  $<HTMLDialogElement>("#weapon-dialog").close();
  sound("fire", audio, shot.shot.weapon);
  mounted.scene.cancelAnimation(true);
  activeShotRevision = shot.state.revision;
  busy = true;
  updateControls();
  await new Promise<void>((resolve) => mounted.scene.animate(shot, resolve));
  if (
    session !== sessionVersion ||
    animation !== animationVersion ||
    arena !== mounted
  )
    return;
  match = completedShotState(
    shot.state,
    mode === "online" ? room?.match : undefined,
  );
  busy = false;
  // Weapon aim events only steer the animated barrel in ArenaScene.
  // Restore the player's selected controls after the animation.
  aim.angle = playerAngles[aimingPlayer()];
  aim.power = playerPowers[aimingPlayer()];
  aim.weapon = "shell";
  $<HTMLInputElement>("#angle").value = String(aim.angle);
  $<HTMLInputElement>("#power").value = String(aim.power);
  $<HTMLSelectElement>("#weapon").value = "shell";
  readAim();
  arena.scene.render(match, aim, playerAngles);
  updateControls();
  const total = shot.damage.reduce((a, b) => a + b, 0);
  toast(
    total
      ? `Impact: ${shot.damage[0]} / ${shot.damage[1]} damage`
      : "A new crater. Better luck next shot.",
  );
  if (mode === "solo" && match.turn === 1 && match.winner === null) {
    busy = true;
    updateControls();
    botTimer = window.setTimeout(() => {
      if (mode !== "solo" || !arena) return;
      const bot = botShot(match);
      arena.scene.setAim(bot);
      void animateShot(fire(match, 1, bot));
    }, 850);
  }
}
function movement(direction: number) {
  if (!canPlay()) return;
  try {
    if (mode === "online")
      send({ type: "move", revision: match.revision, direction });
    else {
      match = move(match, match.turn, direction);
      arena?.scene.render(match, aim, playerAngles);
      updateControls();
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : "Unable to move.");
  }
}
function result() {
  const winner = match.winner;
  $("#result-title").textContent =
    winner === "draw"
      ? "A dead-even duel."
      : `${names[winner!] || "Pilot"} wins on points.`;
  $("#result-copy").textContent =
    `${names[0]}: ${match.tanks[0].points} points · ${names[1]}: ${match.tanks[1].points} points. ${match.shots} shots played.`;
  if (!$<HTMLDialogElement>("#result-dialog").open)
    $<HTMLDialogElement>("#result-dialog").showModal();
}
window.addEventListener("keydown", (event) => {
  if (
    !arena ||
    document.querySelector("dialog[open]") ||
    !canPlay() ||
    (event.target as HTMLElement).closest(
      "button, input, select, textarea, a, [contenteditable=true]",
    )
  )
    return;
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key))
    event.preventDefault();
  if (key === " ") void shoot();
  if (key === "a") movement(-1);
  if (key === "d") movement(1);
  if (key === "arrowleft" || key === "arrowright") {
    $<HTMLInputElement>("#angle").value = String(
      clamp(aim.angle + (key === "arrowleft" ? 1 : -1), 0, 180),
    );
    readAim();
  }
  if (key === "arrowup" || key === "arrowdown") {
    $<HTMLInputElement>("#power").value = String(
      clamp(aim.power + (key === "arrowup" ? 1 : -1), 10, 100),
    );
    readAim();
  }
});
window.setInterval(() => {
  const timer = document.querySelector("#timer");
  if (timer && room && !room.paused)
    timer.textContent = `${Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000))}s`;
}, 1000);
// A read-only diagnostics hook for browser QA; never accepts or mutates game state.
Object.defineProperty(window, "craterCrewDiagnostics", {
  get: () => ({
    mode,
    match: structuredClone(match),
    busy,
    player,
    room: room ? { phase: room.phase, paused: room.paused } : null,
    fps: fpsSamples.length
      ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length
      : null,
  }),
});
const invite = new URLSearchParams(location.search).get("room");
home();
if (invite) {
  $<HTMLDialogElement>("#online-dialog").showModal();
  $<HTMLInputElement>("#join-code").value = invite;
}

window.addEventListener(
  "pointerdown",
  () => {
    if (audio) unlockAudio();
  },
  { passive: true },
);
window.addEventListener("keydown", () => {
  if (audio) unlockAudio();
});
