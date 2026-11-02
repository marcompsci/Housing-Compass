/**
 * "Download my data": everything Housing Compass keeps about you on this device (and, when
 * signed in, what the server returns from export_my_data()). Plain JSON the user can read.
 */
export const EXPORT_FORMAT_VERSION = 1;

export interface DeviceData {
  favorites: string[];
  savedSearches: unknown[];
  reports: unknown[];
  applications: unknown[];
  conversations: unknown[];
  priceHistory: Record<string, unknown[]>;
  alertPrefs: unknown;
  checklists: Record<string, string[]>;
  savings: unknown;
  household?: unknown;
  notes?: Record<string, string>;
  savedAreas?: unknown[];
}

export function buildDataExport(device: DeviceData, server: unknown | null, now: Date): string {
  const doc = {
    format: "housing-compass-export",
    version: EXPORT_FORMAT_VERSION,
    generatedAt: now.toISOString(),
    notes: [
      "Your search area and GPS location are never stored, so they aren't in this file.",
      "Reports you sent are included with your own comments.",
    ],
    device,
    server,
  };
  return JSON.stringify(doc, null, 2);
}

export function exportFileName(now: Date): string {
  return `housing-compass-data-${now.toISOString().slice(0, 10)}.json`;
}
