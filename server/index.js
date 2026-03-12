import express from "express";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";
import { format, parse, isValid } from "date-fns";

dotenv.config();

// Debug environment variables
console.log("🔧 [DEBUG] Environment variables:");
console.log(
  "📧 GOOGLE_SERVICE_ACCOUNT_EMAIL:",
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "SET" : "NOT SET",
);
console.log(
  "🔐 GOOGLE_PRIVATE_KEY:",
  process.env.GOOGLE_PRIVATE_KEY ? "SET" : "NOT SET",
);
console.log("📋 SPREADSHEET_ID:", process.env.SPREADSHEET_ID || "NOT SET");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.BACKEND_PORT || 3001;

// Google Sheets Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1v9WL4jYXR6IXwcZQKDjzaInvUu-ADEzlYRRrty1E0oE";

// --- Data Cleaning Logic (Ported from Frontend) ---

const DataCleaningService = {
  processMultiTableData(cleanedData, filename) {
    if (!cleanedData || !Array.isArray(cleanedData)) {
      throw new Error("Invalid data format: cleanedData must be an array");
    }

    // Separate Head and Line data
    const headData = cleanedData.filter((row) => row._isHead);
    const lineData = cleanedData.filter((row) => row._isLine);

    // Group data by source sheet
    const dataBySheet = cleanedData.reduce((acc, row) => {
      const sheetName = row._sourceSheet || "Unknown";
      if (!acc[sheetName]) acc[sheetName] = [];
      acc[sheetName].push(row);
      return acc;
    }, {});

    console.log("📊 [DataCleaningService] Data grouped by sheets:", {
      totalSheets: Object.keys(dataBySheet).length,
      sheetNames: Object.keys(dataBySheet),
      sheetDataCounts: Object.entries(dataBySheet).map(([sheet, data]) => ({
        sheet,
        rows: data.length,
        heads: data.filter((r) => r._isHead).length,
        lines: data.filter((r) => r._isLine).length,
      })),
    });

    // 1. Combined procurement data (for backward compatibility)
    const procurement_data = lineData; // Use line data as main data

    // 2. Head table (PO headers only)
    const procurement_head = headData.map((row) => ({
      ...row,
      // Map head-specific fields
      date: row.date,
      poNumber: row.poNumber,
      supplier: row.supplier,
      description: "HEADER", // Mark as header
      quantity: 0,
      unit: "HEADER",
      projectCode: row.projectCode,
      unitPrice: 0,
      totalPrice: 0,
      vatRate: row.vatRate,
      engineerName: row.engineerName,
      category: "HEADER",
      sourceSheet: row.sourceSheet,
    }));

    // 3. Line table (PO line items)
    const procurement_line = lineData.map((row) => ({
      ...row,
      // Map line-specific fields
      date: row.date,
      poNumber: row.poNumber,
      supplier: row.supplier,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      projectCode: row.projectCode,
      unitPrice: row.unitPrice,
      totalPrice: row.totalPrice,
      vatRate: row.vatRate,
      engineerName: row.engineerName,
      category: row.category,
      sourceSheet: row.sourceSheet,
    }));

    // 4. Suppliers Master (Unique suppliers from line data)
    const uniqueSuppliers = [
      ...new Set(lineData.map((row) => row.supplier).filter(Boolean)),
    ];
    const suppliers_master = uniqueSuppliers.map((name) => ({
      name,
      last_seen: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    }));

    // 5. Categories Master (Unique categories from line data)
    const uniqueCategories = [
      ...new Set(lineData.map((row) => row.category).filter(Boolean)),
    ];
    const categories_master = uniqueCategories.map((name) => ({
      name,
      description: `Auto-generated category for ${name}`,
    }));

    // 6. Upload Logs
    const upload_logs = [
      {
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        filename: filename || "unknown_file",
        row_count: lineData.length,
        status: "Success",
        sheets_processed: Object.keys(dataBySheet).length,
        // Convert sheet_details to JSON string for Google Sheets compatibility
        sheet_details: JSON.stringify(
          Object.entries(dataBySheet).map(([sheet, data]) => ({
            sheet,
            rows: data.length,
          })),
        ),
      },
    ];

    return {
      procurement_data,
      procurement_head,
      procurement_line,
      suppliers_master,
      categories_master,
      upload_logs,
      dataBySheet: dataBySheet,
    };
  },
};

// --- Google Sheets Operations ---

async function writeTableToSheet(sheetName, data) {
  if (!data || data.length === 0)
    return { sheet: sheetName, status: "skipped", rows: 0 };

  try {
    const headers = Object.keys(data[0]);
    const values = [
      headers,
      ...data.map((row) =>
        headers.map((h) =>
          row[h] !== undefined && row[h] !== null ? row[h] : "",
        ),
      ),
    ];

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    let sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    } else {
      // Clear existing data - specifically A1:ZZ (expand range for more columns)
      const gridData = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:ZZ1`,
      });

      // Only clear if there's actual data
      if (gridData.data.values && gridData.data.values.length > 0) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1:ZZ`,
        });
      }
    }

    // Write new data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    return { sheet: sheetName, status: "success", rows: data.length };
  } catch (error) {
    console.error(`Error writing to ${sheetName}:`, error.message);
    throw new Error(`Failed to write to sheet ${sheetName}: ${error.message}`);
  }
}

async function appendTableToSheet(sheetName, data) {
  if (!data || data.length === 0)
    return { sheet: sheetName, status: "skipped", rows: 0 };

  try {
    // Use the first row's keys as headers (they're already in the correct format)
    const headers = Object.keys(data[0]);
    const values = data.map((row) =>
      headers.map((h) =>
        row[h] !== undefined && row[h] !== null ? row[h] : "",
      ),
    );

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    let sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      // Create with headers if doesn't exist
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers, ...values],
        },
      });
    } else {
      // Check if sheet is empty to add headers
      const existingData = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:Z1`,
      });

      if (!existingData.data.values || existingData.data.values.length === 0) {
        // Add headers first
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
      }

      // Append data
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    }
    return { sheet: sheetName, status: "success", rows: data.length };
  } catch (error) {
    console.error(`Error appending to ${sheetName}:`, error.message);
    throw new Error(`Failed to append to sheet ${sheetName}: ${error.message}`);
  }
}

async function updateMasterSheet(sheetName, data, keyColumn) {
  if (!data || data.length === 0)
    return { sheet: sheetName, status: "skipped", rows: 0 };

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    let sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      return await writeTableToSheet(sheetName, data);
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z`,
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const keyIndex = headers.indexOf(keyColumn);

    if (keyIndex === -1) {
      // If key column not found, just overwrite or handle error?
      // For now, let's append if headers exist, or overwrite if empty
      if (headers.length === 0) return await writeTableToSheet(sheetName, data);
      return await appendTableToSheet(sheetName, data);
    }

    const existingKeys = new Set(
      rows.slice(1).map((r) => r[keyIndex]?.toString().toLowerCase().trim()),
    );
    const newData = data.filter((item) => {
      const val = item[keyColumn]?.toString().toLowerCase().trim();
      return val && !existingKeys.has(val);
    });

    if (newData.length > 0) {
      const valuesToAppend = newData.map((item) =>
        headers.map((h) =>
          item[h] !== undefined && item[h] !== null ? item[h] : "",
        ),
      );
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: valuesToAppend },
      });
      return {
        sheet: sheetName,
        status: "success",
        appended: newData.length,
        total: data.length,
      };
    }

    return { sheet: sheetName, status: "no_new_data", total: data.length };
  } catch (error) {
    console.error(`Error updating master ${sheetName}:`, error.message);
    throw new Error(
      `Failed to update master sheet ${sheetName}: ${error.message}`,
    );
  }
}

// --- API Endpoints ---

// Main upload endpoint
app.post("/api/upload", async (req, res) => {
  const { data, filename, tables: preProcessedTables } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({
      success: false,
      message: "Required 'data' field missing or not an array",
    });
  }

  try {
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

    res.json({
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
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during data upload",
      error: error.message,
    });
  }
});

// Alias for compatibility
app.post("/api/import-multi-table", async (req, res) => {
  // Just forward to /api/upload
  req.url = "/api/upload";
  return app.handle(req, res);
});

// Get available sheets
app.get("/api/sheets", async (req, res) => {
  try {
    // List of standard sheets we manage
    const standardSheets = [
      "procurement_data",
      "procurement_head", // New: Head table
      "procurement_line", // New: Line table
      "suppliers_master",
      "categories_master",
      "upload_logs",
    ];

    // Optionally fetch all sheet names from the spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const allSheets = spreadsheet.data.sheets.map((s) => s.properties.title);

    res.json({
      success: true,
      data: {
        sheets: standardSheets,
        availableOnGoogle: allSheets,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch sheet names",
      error: error.message,
    });
  }
});

// Get specific sheet data
app.get("/api/sheets/:sheetName", async (req, res) => {
  try {
    const { sheetName } = req.params;

    // First check if sheet exists to avoid "Unable to parse range" error
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      return res.json({
        success: true,
        data: { headers: [], rows: [] },
        message: `Sheet '${sheetName}' does not exist yet.`,
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: { headers: [], rows: [] },
      });
    }

    const headers = rows[0] || [];
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] !== undefined ? row[index] : "";
      });
      return obj;
    });

    res.json({
      success: true,
      data: {
        headers,
        rows: data,
      },
    });
  } catch (error) {
    console.error(
      `Error fetching sheet ${req.params.sheetName}:`,
      error.message,
    );
    res.status(500).json({
      success: false,
      message: `Failed to fetch data from sheet: ${req.params.sheetName}`,
      error: error.message,
    });
  }
});

// Update sheet data endpoint
app.post("/api/update-sheet", async (req, res) => {
  try {
    const { sheetName, data } = req.body;

    if (!sheetName || !data) {
      return res.status(400).json({
        success: false,
        message: "Sheet name and data are required",
      });
    }

    console.log(
      `🔄 [Server] Updating sheet: ${sheetName} with ${data.length} rows`,
    );

    // Convert data back to 2D array format for Google Sheets
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data.map((row) => headers.map((header) => row[header] || ""));

    // Get sheet data using Google Sheets API
    const sheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    // Find the sheet by title
    const sheet = sheetResponse.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: `Sheet '${sheetName}' not found`,
      });
    }

    // Clear the sheet and write new data
    const clearResponse = await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    // Write headers and data
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headers, ...rows],
        },
      });
    }

    console.log(`✅ [Server] Successfully updated sheet: ${sheetName}`);

    res.json({
      success: true,
      message: `Sheet '${sheetName}' updated successfully`,
      data: {
        rowsUpdated: rows.length,
        headers: headers,
      },
    });
  } catch (error) {
    console.error("❌ [Server] Error updating sheet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sheet",
      error: error.message,
    });
  }
});

// Delete file data from all tables
app.delete("/api/file/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: "Filename is required",
      });
    }

    console.log(`🗑️ [Server] Deleting file data for: ${filename}`);

    // Find batchId for this filename from upload_logs first
    let targetBatchId = null;
    try {
      const uploadLogsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "upload_logs!A:Z",
      });

      const uploadLogsRows = uploadLogsResponse.data.values || [];
      if (uploadLogsRows.length > 1) {
        const uploadHeaders = uploadLogsRows[0];
        const uploadData = uploadLogsRows.slice(1).map((row) => {
          const obj = {};
          uploadHeaders.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : "";
          });
          return obj;
        });

        const uploadLog = uploadData.find((log) => log.filename === filename);
        if (uploadLog && uploadLog.batchId) {
          targetBatchId = uploadLog.batchId;
          console.log(
            `🎯 [Server] Found batchId for filename "${filename}": ${targetBatchId}`,
          );
        }
      }
    } catch (error) {
      console.log(
        `⚠️ [Server] Could not fetch batchId from upload_logs: ${error.message}`,
      );
    }

    const sheetsToUpdate = [
      "procurement_data",
      "procurement_head",
      "procurement_line",
      "upload_logs",
    ];

    const results = {};

    for (const sheetName of sheetsToUpdate) {
      try {
        console.log(`📊 [Server] Processing ${sheetName}...`);

        // Get current sheet data
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
          results[sheetName] = { status: "skipped", message: "Sheet is empty" };
          continue;
        }

        const headers = rows[0] || [];
        const data = rows.slice(1).map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : "";
          });
          return obj;
        });

        // Filter out rows with specified filename
        console.log(`🔍 [Server] Looking for filename: ${filename}`);
        console.log(`📋 [Server] Available headers:`, headers);
        console.log(`📊 [Server] Sample data rows:`, data.slice(0, 3));

        // Check if this sheet has batchId column
        const batchIdIndex = headers.findIndex(
          (header) =>
            header.toLowerCase() === "batchid" || header === "batchId",
        );

        console.log(`🔍 [Server] BatchId column index: ${batchIdIndex}`);

        const filteredData = data.filter((row) => {
          if (batchIdIndex !== -1 && targetBatchId) {
            // Use batchId for new data
            const rowBatchId = row[headers[batchIdIndex]];
            const shouldDelete = rowBatchId === targetBatchId;
            console.log(
              `🔍 [Server] Row batchId check: "${rowBatchId}" vs "${targetBatchId}" -> Keep: ${!shouldDelete}`,
            );
            return !shouldDelete;
          } else {
            // Use filename for old data
            const filenameValue =
              row["Source Sheet"] ||
              row["SourceSheet"] ||
              row["sourceSheet"] ||
              row["source sheet"] ||
              row.filename ||
              row.Filename ||
              row.FILENAME ||
              row.source_file ||
              row.SourceFile ||
              row.SOURCESHEET ||
              row.source_sheet ||
              row["filename"] ||
              row["Filename"] ||
              row["FILENAME"];

            // Case-insensitive comparison and handle null/undefined values
            const targetFilename = filename || "";
            const sourceFilename = filenameValue || "";
            const shouldDelete =
              sourceFilename.toLowerCase() === targetFilename.toLowerCase();

            console.log(
              `🔍 [Server] Row filename check: "${filenameValue}" vs "${filename}" -> Keep: ${!shouldDelete}`,
            );
            return !shouldDelete;
          }
        });

        console.log(
          `${sheetName} - Before: ${data.length}, After: ${filteredData.length}`,
          ` [Server] ${sheetName} - Before: ${data.length}, After: ${filteredData.length}`,
        );

        // Clear and update the sheet
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });

        if (filteredData.length > 0) {
          const values = [
            headers,
            ...filteredData.map((row) =>
              headers.map((header) => row[header] || ""),
            ),
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: { values },
          });
        }

        results[sheetName] = {
          status: "success",
          rowsBefore: data.length,
          rowsAfter: filteredData.length,
          deleted: data.length - filteredData.length,
        };
      } catch (error) {
        console.error(
          `❌ [Server] Error processing ${sheetName}:`,
          error.message,
        );
        results[sheetName] = {
          status: "error",
          message: error.message,
        };
      }
    }

    const totalDeleted = Object.values(results)
      .filter((result) => result.status === "success")
      .reduce((sum, result) => sum + (result.deleted || 0), 0);

    console.log(
      `✅ [Server] File deletion completed. Total rows deleted: ${totalDeleted}`,
    );

    res.json({
      success: true,
      message: `File '${filename}' and all related data deleted successfully`,
      data: {
        filename,
        totalDeleted,
        results,
      },
    });
  } catch (error) {
    console.error("❌ [Server] Error deleting file data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file data",
      error: error.message,
    });
  }
});

// Get batch information
app.get("/api/batches", async (req, res) => {
  try {
    console.log("📊 [Server] Fetching batch information...");

    // Get upload logs with batch information
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "upload_logs!A:Z",
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: { batches: [] },
      });
    }

    const headers = rows[0] || [];
    const logs = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
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

    res.json({
      success: true,
      data: {
        batches,
        total: batches.length,
      },
    });
  } catch (error) {
    console.error("❌ [Server] Error fetching batches:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch batch information",
      error: error.message,
    });
  }
});
// Delete batch data from all tables
app.delete("/api/batch/:batchId", async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required",
      });
    }

    console.log(`🗑️ [Server] Deleting batch data for: ${batchId}`);

    // Check if this looks like a filename (old data) or batch ID (new data)
    const isFilename =
      batchId.includes(".xlsx") ||
      batchId.includes(".xls") ||
      !batchId.startsWith("BATCH-");
    console.log(`📋 [Server] Is filename (old data): ${isFilename}`);

    const sheetsToUpdate = [
      "procurement_data",
      "procurement_head",
      "procurement_line",
      "upload_logs",
    ];

    const results = {};

    for (const sheetName of sheetsToUpdate) {
      try {
        console.log(`📊 [Server] Processing ${sheetName}...`);

        // Get current sheet data
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
          results[sheetName] = { status: "skipped", message: "Sheet is empty" };
          continue;
        }

        const headers = rows[0] || [];
        console.log(`📋 [Server] Available headers in ${sheetName}:`, headers);

        const data = rows.slice(1).map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : "";
          });
          return obj;
        });

        // Find the batchId column index
        const batchIdIndex = headers.findIndex(
          (header) =>
            header.toLowerCase() === "batchid" || header === "batchId",
        );

        console.log(
          `🔍 [Server] BatchId column index in ${sheetName}:`,
          batchIdIndex,
        );
        console.log(`🎯 [Server] Target batchId to delete:`, batchId);

        // Filter out rows with specified batch ID
        const filteredData = data.filter((row) => {
          if (batchIdIndex === -1) {
            // If no batchId column, check filename for old data
            console.log(
              `🔍 [Server] No batchId column found in ${sheetName}, checking filename...`,
            );
            console.log(`📋 [Server] Row filename:`, row.filename);
            console.log(`🎯 [Server] Target filename:`, batchId);
            return row.filename !== batchId;
          }
          const rowBatchId = row[headers[batchIdIndex]];
          console.log(
            `🔍 [Server] Row batchId:`,
            rowBatchId,
            `Target:`,
            batchId,
          );
          return rowBatchId !== batchId;
        });

        console.log(
          `✂️ [Server] ${sheetName} - Before: ${data.length}, After: ${filteredData.length}`,
        );

        // Clear and update the sheet
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });

        if (filteredData.length > 0) {
          const values = [
            headers,
            ...filteredData.map((row) =>
              headers.map((header) => row[header] || ""),
            ),
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: { values },
          });
        }

        results[sheetName] = {
          status: "success",
          rowsBefore: data.length,
          rowsAfter: filteredData.length,
          deleted: data.length - filteredData.length,
        };
      } catch (error) {
        console.error(
          `❌ [Server] Error processing ${sheetName}:`,
          error.message,
        );
        results[sheetName] = {
          status: "error",
          message: error.message,
        };
      }
    }

    const totalDeleted = Object.values(results)
      .filter((result) => result.status === "success")
      .reduce((sum, result) => sum + (result.deleted || 0), 0);

    console.log(
      `✅ [Server] Batch deletion completed. Total rows deleted: ${totalDeleted}`,
    );

    res.json({
      success: true,
      message: `Batch '${batchId}' and all related data deleted successfully`,
      data: {
        batchId,
        totalDeleted,
        results,
      },
    });
  } catch (error) {
    console.error("❌ [Server] Error deleting batch data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete batch data",
      error: error.message,
    });
  }
});

// Auth endpoints (Proxy for local dev)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // This is a minimal implementation for local dev
    // In production, the Netlify Function handles this
    const { getUsers } = await import("../netlify/functions/utils/googleSheets.js");
    const { generateToken } = await import("../netlify/functions/utils/auth.js");
    const bcrypt = await import("bcryptjs");
    
    const users = await getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user || !(await bcrypt.default.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ message: "Account is suspended" });
    }
    
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Local login error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// User Management (Proxy for local dev)
app.get("/api/getUsers", async (req, res) => {
  try {
    const { getUsers } = await import("../netlify/functions/utils/googleSheets.js");
    const users = await getUsers();
    const safeUsers = users.map(({ password_hash, ...u }) => u);
    res.json(safeUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/createUser", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const { getUsers, saveUsers } = await import("../netlify/functions/utils/googleSheets.js");
    const bcrypt = await import("bcryptjs");
    const users = await getUsers();
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.default.genSalt(10);
    const password_hash = await bcrypt.default.hash(password, salt);

    const newUser = {
      id: Date.now().toString(),
      email,
      password_hash,
      role,
      status: "active",
      created_at: new Date().toISOString().split("T")[0],
    };

    users.push(newUser);
    await saveUsers(users);
    
    const { password_hash: _, ...safeUser } = newUser;
    res.status(201).json({ message: "User created", user: safeUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/updateUser", async (req, res) => {
  try {
    const { id, email, role, status } = req.body;
    const { getUsers, saveUsers } = await import("../netlify/functions/utils/googleSheets.js");
    const users = await getUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) return res.status(404).json({ message: "Not found" });

    if (email) users[userIndex].email = email;
    if (role) users[userIndex].role = role;
    if (status) users[userIndex].status = status;

    await saveUsers(users);
    res.json({ message: "Updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/deleteUser", async (req, res) => {
  try {
    const { id } = req.body;
    const { getUsers, saveUsers } = await import("../netlify/functions/utils/googleSheets.js");
    const users = await getUsers();
    const updatedUsers = users.filter(u => u.id !== id);
    
    await saveUsers(updatedUsers);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
