import { sheets, SPREADSHEET_ID } from "./shared.js";
import { authMiddleware } from "./utils/auth.js";

const handler = async (event, context) => {
  // Only admin allowed to delete
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
    "Access-Control-Allow-Methods": "DELETE, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "DELETE") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  try {
    const pathParts = event.path.split('/');
    const batchId = pathParts[3]; // /api/batch/:batchId

    if (!batchId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "Batch ID is required",
        }),
      };
    }

    console.log(`🗑️ [Server] Deleting batch data for: ${batchId}`);

    // Check if this looks like a filename (old data) or batch ID (new data)
    const isFilename =
      batchId.includes(".xlsx") ||
      batchId.includes(".xls") ||
      batchId.includes(".csv");

    if (isFilename) {
      // For old data, treat as filename and use filename deletion logic
      console.log(`📁 [Server] Treating as filename, using filename deletion logic`);
      const filename = batchId;

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

          const headers_ = rows[0] || [];
          const data = rows.slice(1).map((row) => {
            const obj = {};
            headers_.forEach((header, index) => {
              obj[header] = row[index] !== undefined ? row[index] : "";
            });
            return obj;
          });

          // Filter out rows with specified filename
          console.log(`🔍 [Server] Looking for filename: ${filename}`);
          console.log(`📋 [Server] Available headers:`, headers_);
          console.log(`📊 [Server] Sample data rows:`, data.slice(0, 3));

          // Check if this sheet has batchId column
          const batchIdIndex = headers_.findIndex(
            (header) =>
              header.toLowerCase() === "batchid" || header === "batchId",
          );

          console.log(`🔍 [Server] BatchId column index: ${batchIdIndex}`);

          const filteredData = data.filter((row) => {
            if (batchIdIndex !== -1 && targetBatchId) {
              // Use batchId for new data
              const rowBatchId = row[headers_[batchIdIndex]];
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
              headers_,
              ...filteredData.map((row) =>
                headers_.map((header) => row[header] || ""),
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `File '${filename}' and all related data deleted successfully`,
          data: {
            filename,
            totalDeleted,
            results,
          },
        }),
      };
    } else {
      // For new data, delete by batchId
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

          const headers_ = rows[0] || [];
          const data = rows.slice(1).map((row) => {
            const obj = {};
            headers_.forEach((header, index) => {
              obj[header] = row[index] !== undefined ? row[index] : "";
            });
            return obj;
          });

          // Filter out rows with specified batchId
          console.log(`🔍 [Server] Looking for batchId: ${batchId}`);

          // Check if this sheet has batchId column
          const batchIdIndex = headers_.findIndex(
            (header) =>
              header.toLowerCase() === "batchid" || header === "batchId",
          );

          console.log(`🔍 [Server] BatchId column index: ${batchIdIndex}`);

          if (batchIdIndex === -1) {
            results[sheetName] = { status: "skipped", message: "No batchId column" };
            continue;
          }

          const filteredData = data.filter((row) => {
            const rowBatchId = row[headers_[batchIdIndex]];
            const shouldDelete = rowBatchId === batchId;
            console.log(
              `🔍 [Server] Row batchId check: "${rowBatchId}" vs "${batchId}" -> Keep: ${!shouldDelete}`,
            );
            return !shouldDelete;
          });

          console.log(
            `${sheetName} - Before: ${data.length}, After: ${filteredData.length}`,
          );

          // Clear and update the sheet
          await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
          });

          if (filteredData.length > 0) {
            const values = [
              headers_,
              ...filteredData.map((row) =>
                headers_.map((header) => row[header] || ""),
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Batch '${batchId}' and all related data deleted successfully`,
          data: {
            batchId,
            totalDeleted,
            results,
          },
        }),
      };
    }
  } catch (error) {
    console.error("❌ [Server] Error deleting batch data:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Failed to delete batch data",
        error: error.message,
      }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
