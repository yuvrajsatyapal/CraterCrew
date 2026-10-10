import { REFERENCE_WEAPONS } from "../shared/reference-weapons";
import type { WeaponId } from "../shared/game";
const shapes: Partial<Record<WeaponId, string>> = {
  shell:
    '<path d="m12 24 10-16 6 4-10 16z" fill="#d7dfbd"/><path d="m22 8 5-3 1 7z" fill="#ed9d29"/>',
  heavy:
    '<circle cx="20" cy="20" r="10" fill="#e6a13a"/><path d="m19 10 3-5 5 2M11 20h18M20 11v18" stroke="#ffdf83"/>',
  scatter:
    '<g fill="#ffe56d"><circle cx="20" cy="10" r="4"/><circle cx="10" cy="22" r="4"/><circle cx="30" cy="22" r="4"/><circle cx="20" cy="30" r="4"/></g>',
  bounce:
    '<path d="M4 27q7-23 14 0 6-17 12 0" fill="none" stroke="#c999ef" stroke-width="2"/><circle cx="30" cy="26" r="5" fill="#e3c6f6"/>',
  digger:
    '<path d="m13 8 14 0-2 15-5 10-5-10z" fill="#88c939"/><path d="m13 12 13 5m-12 1 11 5m-10 1 8 4" stroke="#d7dfbd" stroke-width="2"/>',
  airburst:
    '<path d="m20 5 0 10m0 0-12 12m12-12 12 12m-12-12 0 16" stroke="#83dceb" stroke-width="2"/><g fill="#d5f8fc"><circle cx="8" cy="29" r="3"/><circle cx="20" cy="33" r="3"/><circle cx="32" cy="29" r="3"/></g>',
};
export function weaponArt(id: WeaponId) {
  const reference = REFERENCE_WEAPONS.find((w) => w.id === id);
  if (reference)
    return `<img src="${reference.icon}" alt="" width="40" height="40" loading="lazy" decoding="async">`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${shapes[id]}</svg>`;
}
