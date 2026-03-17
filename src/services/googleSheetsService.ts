import * as Papa from "papaparse";
import authService from "./authService";
import { API_BASE } from "../config/apiConfig";

// Configuration for Node.js Backend
// Use relative paths for better compatibility with Netlify redirects
const BACKEND_CONFIG = {
  BASE_URL: API_BASE, 
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
} as const;

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  } as HeadersInit;
};

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
 * Standardized API call with retry logic and error handling
 */
async function apiCall<T>(
  url: string,
  options: RequestInit = {},
  retries: number = BACKEND_CONFIG.RETRY_ATTEMPTS
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error("Session expired. Please login again.");
      }
      
      let errorMessage = `Backend error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Fallback to text if not JSON
        const errorText = await response.text();
        if (errorText) errorMessage += ` - ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMessage);
    }

    const result: BackendResponse = await response.json();
    
    if (result.success) {
      return result.data as T;
    } else {
      throw new Error(result.error || result.message || "Unknown API error");
    }
  } catch (error) {
    if (retries > 0 && !(error instanceof Error && error.message.includes("Session expired"))) {
      console.warn(`⚠️ Retrying API call to ${url}. Attempts remaining: ${retries}`);
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, (BACKEND_CONFIG.RETRY_ATTEMPTS - retries + 1) * 1000));
      return apiCall<T>(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Upload data to Node.js backend
 */
export async function uploadMultiTableData(
  cleanedData: any[],
  filename: string,
  tables?: any,
): Promise<UploadResult> {
  try {
    const result = await apiCall<any>(`${BACKEND_CONFIG.BASE_URL}/upload`, {
      method: "POST",
      body: JSON.stringify({
        data: cleanedData,
        filename: filename,
        tables: tables,
      }),
      signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
    });

    return {
      success: true,
      message: "Upload successful",
      details: result,
    };
  } catch (error) {
    console.error("❌ [GoogleSheetsService] Upload failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Get data from Node.js backend
 */
export async function getSheetDataByName(
  sheetName: string,
  options?: { forceRefresh?: boolean },
): Promise<SheetData> {
  const cacheKey = `sheet_${sheetName}`;

  // Check cache first
  const cached = dataCache.get(cacheKey);
  if (
    cached &&
    !options?.forceRefresh &&
    Date.now() - cached.timestamp < 5 * 60 * 1000
  ) {
    // 5 minutes cache
    return cached.data;
  }

  try {
    const data = await apiCall<{ headers: string[]; rows: any[] }>(
      `${BACKEND_CONFIG.BASE_URL}/sheets/${sheetName}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
      }
    );

    const sheetData: SheetData = {
      headers: data.headers || [],
      rows: data.rows || [],
      data: data.rows || [],
      metadata: {
        rowCount: data.rows?.length || 0,
        columnCount: data.headers?.length || 0,
        sheetName: sheetName,
      },
    };

    // Cache the result
    dataCache.set(cacheKey, { data: sheetData, timestamp: Date.now() });

    return sheetData;
  } catch (error) {
    console.error(`❌ [GoogleSheetsService] Failed to fetch sheet ${sheetName}:`, error);
    throw error;
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
    const data = await apiCall<{ sheets: string[] }>(
      `${BACKEND_CONFIG.BASE_URL}/sheets`,
      {
        method: "GET",
        signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
      }
    );

    return data.sheets || [];
  } catch (error) {
    console.error("❌ [GoogleSheetsService] Error fetching sheet names:", error);
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
 * Update sheet data in Google Sheets
 */
export async function updateSheetData(
  sheetName: string,
  data: any[],
): Promise<any> {
  try {
    const result = await apiCall<any>(`${BACKEND_CONFIG.BASE_URL}/update-sheet`, {
      method: "POST",
      body: JSON.stringify({ sheetName, data }),
      signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
    });

    // Clear cache for this sheet
    dataCache.delete(sheetName);

    return result;
  } catch (error) {
    console.error(`❌ [GoogleSheetsService] Error updating sheet ${sheetName}:`, error);
    throw error;
  }
}

/**
 * Delete file data from all tables
 */
export async function deleteFileData(filename: string): Promise<any> {
  try {
    const result = await apiCall<any>(
      `${BACKEND_CONFIG.BASE_URL}/file/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
      }
    );

    // Clear cache for all affected sheets
    dataCache.delete("upload_logs");
    dataCache.delete("procurement_data");
    dataCache.delete("procurement_head");
    dataCache.delete("procurement_line");

    return result;
  } catch (error) {
    console.error(`❌ [GoogleSheetsService] Error deleting file data for ${filename}:`, error);
    throw error;
  }
}

/**
 * Get batch information
 */
export async function getBatchInformation(): Promise<any> {
  try {
    const result = await apiCall<any>(`${BACKEND_CONFIG.BASE_URL}/batches`, {
      method: "GET",
      signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
    });

    return result;
  } catch (error) {
    console.error("❌ [GoogleSheetsService] Error fetching batch information:", error);
    throw error;
  }
}

/**
 * Delete batch data from all tables
 */
export async function deleteBatchData(batchId: string): Promise<any> {
  try {
    const result = await apiCall<any>(
      `${BACKEND_CONFIG.BASE_URL}/batch/${encodeURIComponent(batchId)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(BACKEND_CONFIG.TIMEOUT),
      }
    );

    // Clear cache for all affected sheets
    dataCache.delete("upload_logs");
    dataCache.delete("procurement_data");
    dataCache.delete("procurement_head");
    dataCache.delete("procurement_line");

    return result;
  } catch (error) {
    console.error(`❌ [GoogleSheetsService] Error deleting batch data for ${batchId}:`, error);
    throw error;
  }
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
  return getSheetDataByName("procurement_head");
}

export async function getTab2Data(): Promise<SheetData> {
  return getSheetDataByName("procurement_data");
}

export async function getProcurementLineData(): Promise<SheetData> {
  return getSheetDataByName("procurement_line");
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
