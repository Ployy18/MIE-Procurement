import { DataCleaningService, appendTableToSheet } from "./shared.js";
import { authMiddleware } from "./utils/auth.js";

const handler = async (event, context) => {
  // Only admin allowed to upload
  if (event.user.role !== "admin") {
    return {
      statusCode: 403,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: "Forbidden: Admin access required" }),
    };
  }

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { data, filename, tables: preProcessedTables } = body;

    if (!data || !Array.isArray(data)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "Required 'data' field missing or not an array",
        }),
      };
    }

    let tables;

    // Check if pre-processed tables are sent from frontend
    if (preProcessedTables && preProcessedTables.procurement_data) {
      console.log("📥 [Server] Using pre-processed tables from frontend");
      tables = preProcessedTables;
    } else {
      // Process and split data (fallback)
      console.log("🔍 [Server] Processing data for upload:", {
        totalRows: data.length,
        filename: filename,
      });
      tables = DataCleaningService.processMultiTableData(
        data,
        filename || "web-upload.xlsx",
      );
    }

    console.log("📊 [Server] Processed tables:", {
      procurementData: tables.procurement_data.length,
      procurementHead: tables.procurement_head.length,
      procurementLine: tables.procurement_line.length,
      suppliers: tables.suppliers_master.length,
      categories: tables.categories_master.length,
    });

    const results = {};

    // 1. Procurement Data (Append) - Use combined data for "all data" format
    console.log(
      "💾 [Server] Appending procurement_data with",
      tables.procurement_data.length,
      "rows",
    );

    // Filter to only show main columns (exclude internal fields)
    const filteredProcurementData = tables.procurement_data.map((row) => ({
      Date: row.date,
      "PO Number": row.poNumber,
      Supplier: row.supplier,
      Description: row.description,
      "Item Code": row.itemCode,
      Category: row.category,
      Quantity: row.quantity,
      Unit: row.unit,
      "Unit Price": row.unitPrice,
      "Net Amount": row.netAmount,
      VAT: row.totalVat,
      "Total Amount": row.totalPrice,
      Project: row.projectCode,
      sourceSheet: row.sourceSheet,
      batchId: row.batchId, // Add batch ID
    }));

    results.procurement = await appendTableToSheet(
      "procurement_data",
      filteredProcurementData,
    );

    // 2. Procurement Head (Append) - PO headers only
    console.log(
      "💾 [Server] Appending procurement_head with",
      tables.procurement_head.length,
      "rows",
    );

    // Filter to only show head columns
    const filteredHeadData = tables.procurement_head.map((row) => ({
      Date: row.date,
      "PO Number": row.poNumber,
      Supplier: row.supplier,
      Description: row.description,
      "Net Amount": row.netAmount,
      VAT: row.totalVat,
      "Total Amount": row.totalPrice,
      Project: row.projectCode,
      sourceSheet: row.sourceSheet,
      batchId: row.batchId, // Add batch ID
    }));

    results.head = await appendTableToSheet(
      "procurement_head",
      filteredHeadData,
    );

    // 3. Procurement Line (Append) - Line items separate
    console.log(
      "💾 [Server] Appending procurement_line with",
      tables.procurement_line.length,
      "rows",
    );

    // Filter to only show line columns
    const filteredLineData = tables.procurement_line.map((row) => ({
      Date: row.date,
      "PO Number": row.poNumber,
      Supplier: row.supplier,
      Description: row.description,
      "Item Code": row.itemCode,
      Category: row.category,
      Quantity: row.quantity,
      Unit: row.unit,
      "Unit Price": row.unitPrice,
      "Total Amount": row.totalPrice,
      Project: row.projectCode,
      sourceSheet: row.sourceSheet,
      batchId: row.batchId, // Add batch ID
    }));

    results.line = await appendTableToSheet(
      "procurement_line",
      filteredLineData,
    );

    // 5. Upload Logs (Append) - Create simple log data
    const uploadLogs = tables.upload_logs || [];
    console.log(
      "💾 [Server] Writing upload_logs with",
      uploadLogs.length,
      "rows",
    );

    // Convert upload_logs to simple format for Google Sheets
    const simpleUploadLogs = uploadLogs.map((log) => ({
      timestamp: log.timestamp,
      filename: log.filename,
      row_count: log.row_count,
      status: log.status,
      sheets_processed: log.sheets_processed,
      batchId: log.batchId, // Add batch ID
      // Remove sheet_details to avoid Google Sheets compatibility issues
    }));

    results.logs = await appendTableToSheet("upload_logs", simpleUploadLogs);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Data processed and saved to Google Sheets successfully",
        data: {
          timestamp: new Date().toISOString(),
          filename: filename,
          stats: {
            procurementRows: tables.procurement_line.length, // Use line data length
            headRows: tables.procurement_head.length,
            lineRows: tables.procurement_line.length,
            sheetsProcessed: Object.keys(tables.dataBySheet || {}).length,
            sheetDetails: Object.entries(tables.dataBySheet || {}).map(
              ([sheet, data]) => ({
                sheet,
                rows: data.length,
              }),
            ),
          },
          details: results,
        },
      }),
    };
  } catch (error) {
    console.error("Upload failed:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Internal server error during data upload",
        error: error.message,
      }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
