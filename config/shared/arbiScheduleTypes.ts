export interface ArbiScheduleEntry {
  epochMs: number;
  /** Star chart node id, e.g. "SolNode149". */
  nodeId: string;
  /** Display label, e.g. "Casta (Ceres)". */
  node: string;
  mission: string;
  faction: string;
}

export interface ArbiScheduleAlerts {
  /** One-shot bells keyed "epochMs:nodeId"; cleared after firing. */
  occurrences: string[];
  /** Node ids that alert on every future occurrence. */
  favoriteNodes: string[];
  minutesBefore: number;
}

export interface ArbiSchedulePayload {
  entries: ArbiScheduleEntry[];
  /** Wall clock of the last successful arbys.txt fetch; null before first fetch. */
  fetchedAt: number | null;
  alerts: ArbiScheduleAlerts;
  /** English node, mission and faction -> game-language label; absent under English. */
  labels?: Record<string, string>;
}

export function arbiOccurrenceKey(entry: Pick<ArbiScheduleEntry, "epochMs" | "nodeId">): string {
  return `${entry.epochMs}:${entry.nodeId}`;
}
