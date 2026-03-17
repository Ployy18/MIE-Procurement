/**
 * Step 4 & 5: Data Processing Layer
 * 
 * This service handles advanced normalization, subcategory detection,
 * and preparation of forecast-ready datasets.
 */

import { format, parseISO } from "date-fns";

export interface ForecastReadyData {
  project: string;
  month: string; // YYYY-MM
  subcategory: string;
  spend: number;
}

export interface NormalizationResult {
  originalDescription: string;
  normalizedDescription: string;
  subcategory: string;
  isIntermittent: boolean; // Useful for Croston vs Prophet selection
}

/**
 * Normalizes description text to identify common items.
 * Example: "Monitor Dell 24" -> "DELL MONITOR"
 */
export function normalizeDescription(description: string): string {
  if (!description) return "UNKNOWN";
  
  return description
    .toUpperCase()
    .replace(/[^\w\sก-๙]/g, " ") // Keep Thai characters and alphanum
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Basic keyword-based subcategory detection.
 * Future: Could be expanded to use fuzzy matching or a master list.
 */
export function detectSubcategory(description: string): string {
  const text = normalizeDescription(description);
  
  const rules = [
    { keywords: ["CABLE", "WIRE", "LAN", "FIBER"], category: "Cabling" },
    { keywords: ["CAMERA", "CCTV", "IPCAM"], category: "Surveillance" },
    { keywords: ["SWITCH", "ROUTER", "AP", "WIFI", "FIREWALL"], category: "Networking" },
    { keywords: ["SERVER", "STORAGE", "NAS", "UPS"], category: "Infrastructure" },
    { keywords: ["MONITOR", "DISPLAY", "TV", "SCREEN"], category: "Display" },
    { keywords: ["LABOR", "INSTALL", "SERVICE", "MAINTENANCE"], category: "Service" },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) {
      return rule.category;
    }
  }

  return "General Hardware";
}

/**
 * Aggregates spend by project, month, and subcategory for forecasting.
 */
export function aggregateForForecast(data: any[]): ForecastReadyData[] {
  const aggregated: Record<string, number> = {};

  data.forEach((row) => {
    const project = row.projectCode || row.Project || "N/A";
    const rawDate = row.date || row.Date;
    
    if (!rawDate) return;

    let dateStr: string;
    try {
      // Handle potential Thai Buddhist years or ISO strings
      const dateObj = typeof rawDate === 'string' ? new Date(rawDate) : rawDate;
      dateStr = format(dateObj, "yyyy-MM");
    } catch (e) {
      return;
    }

    const description = row.description || row.Description || "";
    const subcategory = detectSubcategory(description);
    const amount = parseFloat(String(row.totalPrice || row["Total Amount"] || 0).replace(/,/g, ""));

    const key = `${project}|${dateStr}|${subcategory}`;
    aggregated[key] = (aggregated[key] || 0) + amount;
  });

  return Object.entries(aggregated).map(([key, spend]) => {
    const [project, month, subcategory] = key.split("|");
    return { project, month, subcategory, spend };
  });
}
