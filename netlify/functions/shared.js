import { google } from "googleapis";
import dotenv from "dotenv";
import { format } from "date-fns";

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

// Google Sheets Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });
export const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1v9WL4jYXR6IXwcZQKDjzaInvUu-ADEzlYRRrty1E0oE";

// --- Data Cleaning Logic (Ported from Frontend) ---

export const DataCleaningService = {
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

export async function writeTableToSheet(sheetName, data) {
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

export async function appendTableToSheet(sheetName, data) {
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

export async function updateMasterSheet(sheetName, data, keyColumn) {
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
