// Apps Script for Import Data API
// Deploy as Web App with "Anyone, even anonymous" access

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === "importData") {
      return importDataToSheets(data.data);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Invalid action",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function importDataToSheets(importData) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Determine which sheet to import to based on data structure
    const headerSheet = spreadsheet.getSheetByName("df_HEADER");
    const lineSheet = spreadsheet.getSheetByName("df_LINE");

    if (!headerSheet || !lineSheet) {
      throw new Error("Required sheets not found");
    }

    // Clear existing data (optional - remove if you want to append)
    // headerSheet.clear();
    // lineSheet.clear();

    // Prepare headers for df_HEADER
    const headerColumns = [
      "DATE",
      "PO.NO.",
      "Supplier Name",
      "Total Amount",
      "Project Code",
    ];

    // Prepare headers for df_LINE
    const lineColumns = [
      "DATE",
      "PO.NO.",
      "Category",
      "Description",
      "Total Amount",
      "Project Code",
    ];

    // Separate data for each sheet
    const headerData = [];
    const lineData = [];

    importData.forEach((row, index) => {
      // Add to df_HEADER
      headerData.push([
        row["DATE"] || "",
        row["PO.NO."] || "",
        row["Supplier Name"] || "",
        parseFloat(row["Total Amount"]) || 0,
        row["Project Code"] || "",
      ]);

      // Add to df_LINE (assuming each row is a line item)
      lineData.push([
        row["DATE"] || "",
        row["PO.NO."] || "",
        row["Category"] || "",
        row["Description"] || "",
        parseFloat(row["Total Amount"]) || 0,
        row["Project Code"] || "",
      ]);
    });

    // Write to df_HEADER
    if (headerData.length > 0) {
      headerSheet
        .getRange(1, 1, 1, headerColumns.length)
        .setValues([headerColumns]);
      headerSheet
        .getRange(2, 1, headerData.length, headerColumns.length)
        .setValues(headerData);
    }

    // Write to df_LINE
    if (lineData.length > 0) {
      lineSheet.getRange(1, 1, 1, lineColumns.length).setValues([lineColumns]);
      lineSheet
        .getRange(2, 1, lineData.length, lineColumns.length)
        .setValues(lineData);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        message: `Successfully imported ${importData.length} rows`,
        headerRows: headerData.length,
        lineRows: lineData.length,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to get current data (for testing)
function doGet(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const headerSheet = spreadsheet.getSheetByName("df_HEADER");

    if (headerSheet) {
      const data = headerSheet.getDataRange().getValues();
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          data: data,
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Sheet not found",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
