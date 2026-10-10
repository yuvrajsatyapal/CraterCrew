import { WEAPONS, type Player, type WeaponId } from "../shared/game";
import { DRAFT_PICK_MS, type WeaponDraft } from "../shared/weapon-draft";
import { weaponArt } from "./weapon-art";

interface DraftSnapshot {
  draft: WeaponDraft;
  names: string[];
  mode: "solo" | "local" | "online";
  player: Player;
  paused: boolean;
  connected: boolean;
  pending: boolean;
  distributing: boolean;
}
interface DraftViewOptions {
  snapshot: () => DraftSnapshot;
  tick: () => void;
  pick: (id: WeaponId, revision: number) => void;
  random: () => void;
  menu: () => void;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const weapon = (id: WeaponId) => WEAPONS.find((w) => w.id === id)!;
/** A disposable DOM screen: callbacks never outlive the draft session. */
export function mountWeaponDraft(root: HTMLElement, options: DraftViewOptions) {
  let key = "";
  let disposed = false;
  let focusTarget: string | null = null;
  let previousCounts = [0, 0];
  const announcement = document.createElement("p");
  announcement.id = "draft-announcement";
  announcement.className = "sr-only";
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-atomic", "true");
  const content = document.createElement("div");
  root.replaceChildren(announcement, content);
  function update() {
    if (disposed) return;
    const s = options.snapshot();
    const d = s.draft;
    const allowed =
      !s.distributing &&
      d.remaining.length > 0 &&
      !s.paused &&
      s.connected &&
      !s.pending &&
      (s.mode === "local" || d.turn === (s.mode === "solo" ? 0 : s.player));
    const nextKey = JSON.stringify([
      d.revision,
      s.names,
      s.paused,
      s.connected,
      s.pending,
      s.distributing,
      allowed,
    ]);
    if (nextKey !== key) {
      const focused = root.querySelector<HTMLButtonElement>(":focus");
      if (focused)
        focusTarget = focused.dataset.draftWeapon
          ? `[data-draft-weapon="${focused.dataset.draftWeapon}"]`
          : `#${focused.id}`;
      else if (
        document.activeElement !== document.body &&
        !root.contains(document.activeElement)
      )
        focusTarget = null;
      key = nextKey;
      const activeName = escape(s.names[d.turn] || "Pilot");
      const turnText = s.distributing
        ? d.remaining.length
          ? `AI choosing for ${activeName}`
          : "Both loadouts ready"
        : s.paused
          ? "Draft paused · waiting for your rival"
          : !s.connected
            ? "Reconnecting to the crew…"
            : s.pending
              ? "Confirming your pick…"
              : s.mode === "solo" && d.turn === 1
                ? `${activeName} is choosing`
                : `${activeName}'s pick`;
      const inventory = (seat: Player) =>
        `<section class="draft-inventory seat-${seat} ${!d.remaining.length || d.turn === seat ? "is-active" : ""}" aria-label="${escape(s.names[seat] || "Pilot")}'s weapons"><div class="draft-seat-heading"><h2>${escape(s.names[seat] || "Pilot")}</h2><span>${d.picks[seat].length}<small> / 10</small></span></div><div class="draft-seat-status">${!d.remaining.length ? "READY" : d.turn === seat ? "CHOOSING NOW" : "LOADOUT"}</div><ol id="draft-inventory-${seat}">${d.picks[seat].map((id) => `<li><span class="draft-small-icon" aria-hidden="true">${weaponArt(id)}</span><span>${escape(weapon(id).name)}</span></li>`).join("")}</ol>${!d.picks[seat].length ? `<p class="draft-empty">Your weapons land here.</p>` : ""}</section>`;
      content.innerHTML = `<div class="draft-heading"><div><p class="eyebrow">CRATERCREW / PREPARE FOR BATTLE</p><h1>Weapon Shop</h1></div><button id="draft-menu" class="metal-button">Menu</button></div><div class="draft-layout">${inventory(0)}<section class="draft-pool" aria-label="Shared weapon pool"><div class="draft-turn-bar"><div><p id="draft-turn">${turnText}</p><span class="draft-progress">${d.remaining.length ? `Pick ${Math.min(20, d.revision + 1)} of 20 · ${d.remaining.length} remaining` : "20 weapons assigned · 10 per pilot"}</span></div><div class="draft-clock ${s.paused ? "is-paused" : ""}" id="draft-clock" role="timer" aria-label="Seconds remaining"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="clock-track" cx="24" cy="24" r="20"/><circle class="clock-progress" cx="24" cy="24" r="20"/></svg><strong></strong><span>SEC</span></div></div><p class="draft-instruction">${s.distributing ? (d.remaining.length ? "AI is distributing the remaining weapons to both tanks." : "Battle starts shortly. Check your weapons.") : s.mode === "online" && d.turn !== s.player ? "Watch your rival choose. Your pick is next." : "Choose one weapon. Each pilot takes ten."}</p><div class="draft-choices">${d.remaining
        .map((id) => {
          const w = weapon(id);
          return `<button class="draft-weapon metal-button" data-draft-weapon="${id}" ${allowed ? "" : "disabled"}><span class="draft-weapon-icon" aria-hidden="true">${weaponArt(id)}</span><span><b>${escape(w.name)}</b><small>${escape(w.description)}</small></span></button>`;
        })
        .join(
          "",
        )}</div>${s.mode === "solo" ? `<div class="draft-random-actions"><button id="draft-random" class="metal-button" ${s.distributing ? "disabled" : ""}>${s.distributing ? (d.remaining.length ? "Distributing…" : "Weapons ready") : "Random"}</button><p>Distribute the remaining weapons to both tanks.</p></div>` : ""}<p class="draft-rules">15 seconds per pick · Timeout picks randomly<br>Standard shells are always available.</p></section>${inventory(1)}</div>`;
      if (s.distributing) {
        // Compact phone inventories follow the latest AI assignment.
        root
          .querySelectorAll<HTMLOListElement>(".draft-inventory ol")
          .forEach((list) => {
            list.scrollTop = list.scrollHeight;
          });
      }
      const selections = d.picks.flatMap((picks, seat) =>
        picks
          .slice(previousCounts[seat])
          .map((id) => `${s.names[seat] || "Pilot"} chose ${weapon(id).name}.`),
      );
      previousCounts = d.picks.map((p) => p.length);
      announcement.textContent = `${selections.join(" ")} ${turnText}`.trim();
      if (focusTarget && (allowed || !focusTarget.startsWith("[data-"))) {
        (
          root.querySelector<HTMLButtonElement>(focusTarget) ||
          root.querySelector<HTMLButtonElement>("[data-draft-weapon]:enabled")
        )?.focus({ preventScroll: true });
      }
    }
    const seconds = s.distributing
      ? d.remaining.length
        ? "AI"
        : "✓"
      : s.paused
        ? "Ⅱ"
        : String(Math.max(0, Math.ceil((d.deadline - Date.now()) / 1000)));
    const clock = root.querySelector<HTMLElement>("#draft-clock")!;
    clock.querySelector("strong")!.textContent = seconds;
    clock.querySelector("span")!.textContent = s.distributing
      ? d.remaining.length
        ? "AUTO"
        : "READY"
      : "SEC";
    clock.setAttribute(
      "aria-label",
      s.distributing
        ? d.remaining.length
          ? "AI distributing weapons"
          : "Loadouts ready"
        : "Seconds remaining",
    );
    clock.classList.toggle(
      "is-urgent",
      !s.distributing && !s.paused && Number(seconds) <= 5,
    );
    const progress = clock.querySelector<SVGCircleElement>(".clock-progress")!;
    progress.style.strokeDashoffset = String(
      s.distributing
        ? 0
        : 126 *
            (1 -
              Math.max(
                0,
                Math.min(1, (d.deadline - Date.now()) / DRAFT_PICK_MS),
              )),
    );
  }
  const click = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || button.disabled) return;
    if (button.dataset.draftWeapon)
      options.pick(
        button.dataset.draftWeapon as WeaponId,
        options.snapshot().draft.revision,
      );
    if (button.id === "draft-random") options.random();
    if (button.id === "draft-menu") options.menu();
  };
  root.addEventListener("click", click);
  update();
  const timer = window.setInterval(() => {
    if (disposed) return;
    options.tick();
    update();
  }, 100);
  return {
    update,
    dispose() {
      disposed = true;
      clearInterval(timer);
      root.removeEventListener("click", click);
    },
  };
}
