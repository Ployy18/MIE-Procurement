import { sheets, SPREADSHEET_ID } from "./shared.js";
import { authMiddleware } from "./utils/auth.js";

const handler = async (event, context) => {
  // Only admin allowed to update
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
    const { sheetName, data } = body;

    if (!sheetName || !data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "Sheet name and data are required",
        }),
      };
    }

    console.log(
      `🔄 [Server] Updating sheet: ${sheetName} with ${data.length} rows`,
    );

    // Convert data back to 2D array format for Google Sheets
    const headers_ = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data.map((row) => headers_.map((header) => row[header] || ""));

    // Get sheet data using Google Sheets API
    const sheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    // Find the sheet by title
    const sheet = sheetResponse.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: `Sheet '${sheetName}' not found`,
        }),
      };
    }

    // Clear the sheet and write new data
    await sheets.spreadsheets.values.clear({
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
          values: [headers_, ...rows],
        },
      });
    }

    console.log(`✅ [Server] Successfully updated sheet: ${sheetName}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Sheet '${sheetName}' updated successfully`,
        data: {
          rowsUpdated: rows.length,
          headers: headers_,
        },
      }),
    };
  } catch (error) {
    console.error("❌ [Server] Error updating sheet:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Failed to update sheet",
        error: error.message,
      }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
