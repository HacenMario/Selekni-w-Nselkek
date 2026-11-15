'use client';

/**
 * Admin-tab attention state (v4.3):
 * - numeric badges: pending-count delta per tab since the admin last opened it
 *   (`slekni.admin.seen.<tab>` = count at the moment the tab was opened)
 * - bounce effect: actionable cards the admin has NOT clicked yet
 *   (`slekni.admin.clicked.<tab>` = ids of cards already reviewed)
 * Everything lives in localStorage so it survives reloads per device.
 */

const seenKey = (tab: string) => `slekni.admin.seen.${tab}`;
const clickedKey = (tab: string) => `slekni.admin.clicked.${tab}`;

/** Pending items counted at the moment the tab was last opened. */
function seenCount(tab: string): number {
  try {
    const raw = localStorage.getItem(seenKey(tab));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Call when the admin opens the tab: badge resets instantly, re-arms on new items. */
export function markTabSeen(tab: string, currentCount: number): void {
  try {
    localStorage.setItem(seenKey(tab), String(currentCount));
  } catch {}
}

/** New (unseen) items for a tab: current pending count minus what was already seen. */
export function badgeDelta(tab: string, currentCount: number): number {
  return Math.max(0, currentCount - seenCount(tab));
}

/** Card ids in this tab the admin has already clicked (bounce stopped for them). */
export function getClicked(tab: string): string[] {
  try {
    const raw = localStorage.getItem(clickedKey(tab));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/** Record a card click → its bounce stops immediately (persisted). */
export function markClicked(tab: string, id: string): void {
  try {
    const arr = getClicked(tab);
    if (!arr.includes(id)) arr.push(id);
    localStorage.setItem(clickedKey(tab), JSON.stringify(arr.slice(-500)));
  } catch {}
}
