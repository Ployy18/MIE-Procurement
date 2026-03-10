import { sheets, SPREADSHEET_ID } from "./shared.js";

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          sheets: standardSheets,
          availableOnGoogle: allSheets,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Failed to fetch sheet names",
        error: error.message,
      }),
    };
  }
};
