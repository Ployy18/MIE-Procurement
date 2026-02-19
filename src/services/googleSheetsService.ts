import Papa from "papaparse";

// Configuration for Node.js Backend
const BACKEND_CONFIG = {
  BASE_URL: import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
} as const;

// Response interface for backend API
interface BackendResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Upload result interface
interface UploadResult {
  success: boolean;
  message: string;
  details?: {
    procurementRows: number;
    suppliersAdded: number;
    categoriesAdded: number;
    logId: string;
  };
}

// Sheet data interface for compatibility
export interface SheetData {
  headers: string[];
  rows: Record<string, string | number>[];
  data?: Record<string, string | number>[];
  metadata?: {
    rowCount: number;
    columnCount: number;
    sheetName?: string;
  };
}

// Simple cache for API responses
const dataCache = new Map<string, { data: SheetData; timestamp: number }>();

/**
 * Upload data to Node.js backend
 */
export async function uploadMultiTableData(
  cleanedData: any[],
  filename: string,
): Promise<UploadResult> {
  try {
    const response = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: cleanedData,
        filename: filename,
      }),
      signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(
        `Backend error: ${response.status} ${response.statusText}`,
      );
    }

    const result: BackendResponse = await response.json();

    if (result.success) {
      return {
        success: true,
        message: result.message,
        details: result.data,
      };
    } else {
      return {
        success: false,
        message: result.error || result.message,
      };
    }
  } catch (error) {
    console.error("Error uploading to backend:", error);
    return {
      success: false,
      message: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get data from Node.js backend
 */
export async function getSheetDataByName(
  sheetName: string,
): Promise<SheetData> {
  const cacheKey = `sheet_${sheetName}`;

  // Check cache first
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    // 5 minutes cache
    return cached.data;
  }

  try {
    const response = await fetch(
      `${BACKEND_CONFIG.BASE_URL}/api/sheets/${sheetName}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sheet: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response received:", text.slice(0, 100));
      throw new Error(
        `Expected JSON response but received ${contentType || "unknown content"}. Please check if the backend server is running correctly at ${BACKEND_CONFIG.BASE_URL}`,
      );
    }

    const result: BackendResponse = await response.json();

    if (result.success && result.data) {
      const sheetData: SheetData = {
        headers: result.data.headers || [],
        rows: result.data.rows || [],
        data: result.data.rows || [],
        metadata: {
          rowCount: result.data.rows?.length || 0,
          columnCount: result.data.headers?.length || 0,
          sheetName: sheetName,
        },
      };

      // Cache the result
      dataCache.set(cacheKey, { data: sheetData, timestamp: Date.now() });

      return sheetData;
    } else {
      throw new Error(result.error || "Failed to fetch sheet data");
    }
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw new Error(
      `Failed to fetch sheet data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get all sheet data from backend
 */
export async function getAllSheetData(): Promise<{
  procurement: SheetData;
  suppliers: SheetData;
  categories: SheetData;
  logs: SheetData;
}> {
  try {
    const [procurement, suppliers, categories, logs] = await Promise.all([
      getSheetDataByName("procurement_data"),
      getSheetDataByName("suppliers_master"),
      getSheetDataByName("categories_master"),
      getSheetDataByName("upload_logs"),
    ]);

    return { procurement, suppliers, categories, logs };
  } catch (error) {
    console.error("Error fetching all sheet data:", error);
    throw error;
  }
}

/**
 * Get available sheet names from backend
 */
export async function getSheetNames(): Promise<string[]> {
  try {
    const response = await fetch(`${BACKEND_CONFIG.BASE_URL}/api/sheets`, {
      method: "GET",
      signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet names: ${response.status}`);
    }

    const result: BackendResponse = await response.json();

    if (result.success && result.data) {
      return result.data.sheets || [];
    } else {
      // Fallback to default sheet names if API fails but returns 200
      return [
        "procurement_data",
        "suppliers_master",
        "categories_master",
        "upload_logs",
      ];
    }
  } catch (error) {
    console.error("Error fetching sheet names:", error);
    // Fallback to default sheet names
    return [
      "procurement_data",
      "suppliers_master",
      "categories_master",
      "upload_logs",
    ];
  }
}

/**
 * Clear cache
 */
export function clearCache(): void {
  dataCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: dataCache.size,
    keys: Array.from(dataCache.keys()),
  };
}

/**
 * Legacy compatibility functions (aliased to new implementation)
 */
export async function getMainSheetData(): Promise<SheetData> {
  return getSheetDataByName("procurement_data");
}

export async function getTab1Data(): Promise<SheetData> {
  return getSheetDataByName("procurement_data");
}

export async function getTab2Data(): Promise<SheetData> {
  return getSheetDataByName("procurement_data");
}

export async function getSheetNamesDynamic(): Promise<string[]> {
  return getSheetNames();
}

// Minimal no-ops for legacy code that might still call these
export async function initializeSheetConfigs(): Promise<void> {}
export async function updateSheetConfigsFromDatabase(): Promise<void> {}
export function addNewSheet(_name: string): void {}
export function updateSheetNames(_names: string[]): void {}
export async function addSheetURL(
  _sheetName: string,
  _gid: string,
  _columns?: string[],
): Promise<boolean> {
  return true;
}
export function getSheetConfigs(): any[] {
  return [];
}
export async function fetchSheetNamesFromGoogle(): Promise<string[]> {
  return getSheetNames();
}
export async function fetchSheetConfigsFromDatabase(): Promise<any[]> {
  return [];
}
export async function addSheetConfigToDatabase(_config: any): Promise<boolean> {
  return true;
}
