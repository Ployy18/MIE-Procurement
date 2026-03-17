import { sheets, SPREADSHEET_ID } from "./shared.js";
import { authMiddleware } from "./utils/auth.js";

const handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  try {
    console.log("📊 [Server] Fetching batch information...");

    // Get upload logs with batch information
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "upload_logs!A:Z",
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { batches: [] },
        }),
      };
    }

    const headers_ = rows[0] || [];
    const logs = rows.slice(1).map((row) => {
      const obj = {};
      headers_.forEach((header, index) => {
        obj[header] = row[index] !== undefined ? row[index] : "";
      });
      return obj;
    });

    // Group by batchId and get batch statistics
    const batchMap = new Map();

    logs.forEach((log) => {
      const batchId = log.batchId || log.filename; // Fallback to filename for old data
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          batchId,
          filename: log.filename,
          timestamp: log.timestamp,
          status: log.status,
          row_count: parseInt(log.row_count) || 0,
          sheets_processed: parseInt(log.sheets_processed) || 1,
        });
      }
    });

    const batches = Array.from(batchMap.values()).sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    console.log(`✅ [Server] Found ${batches.length} batches`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          batches,
          total: batches.length,
        },
      }),
    };
  } catch (error) {
    console.error("❌ [Server] Error fetching batches:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Failed to fetch batch information",
        error: error.message,
      }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
