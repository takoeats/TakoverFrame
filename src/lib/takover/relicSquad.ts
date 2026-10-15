// The planner's squad size survives a restart and goes alone to the relic overlay
// (services/takover/overlaySquad.ts), which would otherwise recommend for 4 players
// until "Push to Overlay". Never picked: solo planner, 4-player overlay.

import type { RelicOverlayFilterPush } from "../../../config/shared/relicPlannerView.js";
import { readStorage, writeStorage } from "../persistence.js";

const SQUAD_SIZE_KEY = "tf_relic_squad_size";

export function restoreRelicSquadSize(): number | null {
  const size = Number(readStorage(SQUAD_SIZE_KEY));
  return Number.isInteger(size) && size >= 1 && size <= 4 ? size : null;
}

function sendSquadSize(size: number): void {
  try {
    window.api?.pushRelicFilters({ squadSize: size } as unknown as RelicOverlayFilterPush);
  } catch {
    /* best effort: the overlay keeps its current squad size */
  }
}

export function rememberRelicSquadSize(size: number): void {
  writeStorage(SQUAD_SIZE_KEY, String(size));
  sendSquadSize(size);
}

/** Startup: hands the saved size to the overlay, which starts at 4 every launch. */
export function pushStoredRelicSquadSize(): void {
  const size = restoreRelicSquadSize();
  if (size !== null) sendSquadSize(size);
}
