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
    const pathParts = event.path.split('/');
    const sheetName = pathParts[3]; // /api/sheets/:sheetName

    if (!sheetName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "Sheet name is required",
        }),
      };
    }

    // First check if sheet exists to avoid "Unable to parse range" error
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName,
    );

    if (!sheet) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { headers: [], rows: [] },
          message: `Sheet '${sheetName}' does not exist yet.`,
        }),
      };
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { headers: [], rows: [] },
        }),
      };
    }

    const headers_ = rows[0] || [];
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers_.forEach((header, index) => {
        obj[header] = row[index] !== undefined ? row[index] : "";
      });
      return obj;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          headers: headers_,
          rows: data,
        },
      }),
    };
  } catch (error) {
    console.error(
      `Error fetching sheet ${event.path.split('/')[3]}:`,
      error.message,
    );
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: `Failed to fetch data from sheet: ${event.path.split('/')[3]}`,
        error: error.message,
      }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
