// ========================================
// Complete Import API with All Functions
// ========================================

// ===============================
// WEB API FUNCTIONS
// ===============================

/**
 * Handle POST requests from web interface
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    let result;
    switch (data.action) {
      case "importData":
        result = handleImportData(data);
        break;
      case "processData":
        result = handleProcessData();
        break;
      case "importAndProcess":
        result = handleImportAndProcess(data);
        break;
      case "test":
        result = {
          status: "success",
          message: "API is working",
          received: data,
        };
        break;
      default:
        result = { status: "error", message: "Invalid action" };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString(),
        timestamp: new Date().toISOString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      case "status":
        result = { status: "success", message: "API is running" };
        break;
      case "test":
        result = testGoogleSheetsAccess();
        break;
      case "processData":
        result = handleProcessData();
        break;
      default:
        result = { status: "success", message: "Data Processing API is ready" };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString(),
        timestamp: new Date().toISOString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle import data from web
 */
function handleImportData(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Create or clear import sheet
    let importSheet = ss.getSheetByName("IMPORT_DATA");
    if (!importSheet) {
      importSheet = ss.insertSheet("IMPORT_DATA");
    } else {
      importSheet.clear();
    }

    // Write imported data
    if (data.data && data.data.length > 0) {
      const headers = Object.keys(data.data[0]);
      const rows = data.data.map((row) =>
        headers.map((header) => row[header] || ""),
      );

      // Add headers
      importSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Add data
      if (rows.length > 0) {
        importSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
    }

    return {
      status: "success",
      message: `Imported ${data.data.length} rows successfully`,
    };
  } catch (error) {
    return { status: "error", message: `Import failed: ${error.toString()}` };
  }
}

/**
 * Handle data processing request
 */
function handleProcessData() {
  try {
    // Call the existing processAllData function
    processAllData();
    return { status: "success", message: "Data processed successfully" };
  } catch (error) {
    return {
      status: "error",
      message: `Processing failed: ${error.toString()}`,
    };
  }
}

/**
 * Handle import and process in one step
 */
function handleImportAndProcess(data) {
  try {
    // Step 1: Import data
    const importResult = handleImportData(data);

    if (importResult.status !== "success") {
      return importResult;
    }

    // Step 2: Process data
    const processResult = handleProcessData();

    return {
      status: "success",
      message: `Imported ${importResult.message}. Processed data successfully.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: `Import & Process failed: ${error.toString()}`,
    };
  }
}

/**
 * Test Google Sheets access
 */
function testGoogleSheetsAccess() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();

    return {
      status: "success",
      message: "Google Sheets access is working",
      debug: {
        spreadsheet_name: ss.getName(),
        spreadsheet_id: ss.getId(),
        total_sheets: sheets.length,
        sheet_names: sheets.map((sheet) => sheet.getName()),
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: "Google Sheets access failed",
      debug: {
        error: error.toString(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ===============================
// ORIGINAL CLEANING FUNCTIONS
// ===============================

/**
 * Process all data - Main function
 */
function processAllData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Step 1: Clear existing sheets
    clearExistingSheets();

    // Step 2: Merge all sheets to df
    mergeSheetsToDF();

    // Step 3: Clean PO data
    cleanPO_cancelAllRows();

    // Step 4: Clean date PO
    cleanDatePO_df();

    // Step 5: Split supplier item
    splitSupplierItem_df();

    // Step 6: Split vendor description
    splitVendorDescription_df();

    // Step 7: Split description quantity
    splitDescriptionQuantity_df();

    // Step 8: Split unit project code
    splitUnitProjectCode_df();

    // Step 9: Clean unit price
    cleanUnitPrice_df();

    // Step 10: Format VAT column
    formatVATColumn();

    // Step 11: Split VAT and engineer
    splitVATAndEngineer();

    // Step 12: Add row type
    addRowtype_df();

    // Step 13: Auto category
    autoCategory_df();

    // Step 14: Rename columns
    renameColumns();

    // Step 15: Split header and line
    splitHeaderLine_df();

    SpreadsheetApp.getUi().alert("Data processing completed successfully!");
  } catch (error) {
    SpreadsheetApp.getUi().alert("Error processing data: " + error.toString());
  }
}

/**
 * Clear existing sheets
 */
function clearExistingSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToKeep = ["IMPORT_DATA"];
  const sheets = ss.getSheets();

  sheets.forEach((sheet) => {
    if (!sheetsToKeep.includes(sheet.getName())) {
      ss.deleteSheet(sheet);
    }
  });
}

/**
 * Merge all sheets to df
 */
function mergeSheetsToDF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dfSheet = ss.getSheetByName("df");

  if (!dfSheet) {
    dfSheet = ss.insertSheet("df");
  } else {
    dfSheet.clear();
  }

  const sheets = ss.getSheets();
  let allData = [];
  let headers = [];

  sheets.forEach((sheet) => {
    const sheetName = sheet.getName();
    if (sheetName === "df" || sheetName === "IMPORT_DATA") return;

    const data = sheet.getDataRange().getValues();

    if (data.length > 0) {
      if (headers.length === 0) {
        headers = data[0];
      }

      // Add source sheet column
      const dataWithSource = data.slice(1).map((row) => {
        return [...row, sheetName];
      });

      allData = allData.concat(dataWithSource);
    }
  });

  if (headers.length > 0) {
    headers.push("Source_Sheet");
    dfSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (allData.length > 0) {
      dfSheet.getRange(2, 1, allData.length, headers.length).setValues(allData);
    }
  }
}

/**
 * Clean PO data
 */
function cleanPO_cancelAllRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find PO column
  const poIndex = headers.findIndex(
    (header) => header && header.toString().toLowerCase().includes("po"),
  );

  if (poIndex === -1) return;

  // Filter out rows with empty PO
  const filteredData = data.filter((row, index) => {
    if (index === 0) return true; // Keep header
    return row[poIndex] && row[poIndex].toString().trim() !== "";
  });

  dfSheet.clear();
  dfSheet
    .getRange(1, 1, filteredData.length, filteredData[0].length)
    .setValues(filteredData);
}

/**
 * Clean date PO
 */
function cleanDatePO_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find date column
  const dateIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("date") ||
        header.toString().toLowerCase().includes("วันที่")),
  );

  if (dateIndex === -1) return;

  // Clean date format
  for (let i = 1; i < data.length; i++) {
    if (data[i][dateIndex]) {
      const dateValue = data[i][dateIndex].toString();
      const cleanedDate = parseDate(dateValue);
      data[i][dateIndex] = formatDateISO(cleanedDate);
    }
  }

  dfSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

/**
 * Split supplier item
 */
function splitSupplierItem_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find supplier column
  const supplierIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("supplier") ||
        header.toString().toLowerCase().includes("ผู้ขาย")),
  );

  if (supplierIndex === -1) return;

  // Add new columns if not exist
  let supplierColIndex = headers.length;
  let itemColIndex = headers.length + 1;

  headers.push("Supplier", "Item");

  // Split supplier and item
  for (let i = 1; i < data.length; i++) {
    if (data[i][supplierIndex]) {
      const supplierItem = data[i][supplierIndex].toString();
      const parts = supplierItem.split(/[-–—]/);

      data[i][supplierColIndex] = parts[0] ? parts[0].trim() : "";
      data[i][itemColIndex] = parts[1] ? parts[1].trim() : "";
    }
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Split vendor description
 */
function splitVendorDescription_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find description column
  const descIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("description") ||
        header.toString().toLowerCase().includes("รายละเอียด")),
  );

  if (descIndex === -1) return;

  // Add new columns if not exist
  let vendorColIndex = headers.length;
  let descriptionColIndex = headers.length + 1;

  headers.push("Vendor", "Description");

  // Split vendor and description
  for (let i = 1; i < data.length; i++) {
    if (data[i][descIndex]) {
      const vendorDesc = data[i][descIndex].toString();
      const parts = vendorDesc.split(/[-–—]/);

      data[i][vendorColIndex] = parts[0] ? parts[0].trim() : "";
      data[i][descriptionColIndex] = parts[1] ? parts[1].trim() : "";
    }
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Split description quantity
 */
function splitDescriptionQuantity_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find description column
  const descIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("description") ||
        header.toString().toLowerCase().includes("รายละเอียด")),
  );

  if (descIndex === -1) return;

  // Add new columns if not exist
  let descColIndex = headers.length;
  let qtyColIndex = headers.length + 1;

  headers.push("Description_Clean", "Quantity");

  // Split description and quantity
  for (let i = 1; i < data.length; i++) {
    if (data[i][descIndex]) {
      const descQty = data[i][descIndex].toString();
      const match = descQty.match(/^(.+?)(\d+)$/);

      if (match) {
        data[i][descColIndex] = match[1] ? match[1].trim() : "";
        data[i][qtyColIndex] = match[2] ? parseInt(match[2]) : "";
      } else {
        data[i][descColIndex] = descQty;
        data[i][qtyColIndex] = "";
      }
    }
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Split unit project code
 */
function splitUnitProjectCode_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find project column
  const projectIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("project") ||
        header.toString().toLowerCase().includes("โครงการ")),
  );

  if (projectIndex === -1) return;

  // Add new columns if not exist
  let unitColIndex = headers.length;
  let projectColIndex = headers.length + 1;

  headers.push("Unit", "Project_Code");

  // Split unit and project code
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIndex]) {
      const unitProject = data[i][projectIndex].toString();
      const parts = unitProject.split(/[-–—]/);

      data[i][unitColIndex] = parts[0] ? parts[0].trim() : "";
      data[i][projectColIndex] = parts[1] ? parts[1].trim() : "";
    }
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Clean unit price
 */
function cleanUnitPrice_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find price column
  const priceIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("price") ||
        header.toString().toLowerCase().includes("ราคา") ||
        header.toString().toLowerCase().includes("จำนวนเงิน")),
  );

  if (priceIndex === -1) return;

  // Clean price format
  for (let i = 1; i < data.length; i++) {
    if (data[i][priceIndex]) {
      const priceValue = data[i][priceIndex].toString();
      const cleanedPrice = formatNumber(priceValue);
      data[i][priceIndex] = cleanedPrice;
    }
  }

  dfSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

/**
 * Format VAT column
 */
function formatVATColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find VAT column
  const vatIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("vat") ||
        header.toString().toLowerCase().includes("ภาษี")),
  );

  if (vatIndex === -1) return;

  // Format VAT
  for (let i = 1; i < data.length; i++) {
    if (data[i][vatIndex]) {
      const vatValue = data[i][vatIndex].toString();
      data[i][vatIndex] = vatValue.includes("%") ? vatValue : vatValue + "%";
    }
  }

  dfSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

/**
 * Split VAT and engineer
 */
function splitVATAndEngineer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find VAT column
  const vatIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("vat") ||
        header.toString().toLowerCase().includes("ภาษี")),
  );

  if (vatIndex === -1) return;

  // Add new columns if not exist
  let vatColIndex = headers.length;
  let engineerColIndex = headers.length + 1;

  headers.push("VAT", "Engineer");

  // Split VAT and engineer
  for (let i = 1; i < data.length; i++) {
    if (data[i][vatIndex]) {
      const vatEngineer = data[i][vatIndex].toString();
      const parts = vatEngineer.split(/[-–—]/);

      data[i][vatColIndex] = parts[0] ? parts[0].trim() : "";
      data[i][engineerColIndex] = parts[1] ? parts[1].trim() : "";
    }
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Add row type
 */
function addRowtype_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Add row type column
  headers.push("Row_Type");

  // Add row type based on content
  for (let i = 1; i < data.length; i++) {
    data[i][headers.length - 1] = "Data";
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Auto category
 */
function autoCategory_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Find description column
  const descIndex = headers.findIndex(
    (header) =>
      header &&
      (header.toString().toLowerCase().includes("description") ||
        header.toString().toLowerCase().includes("รายละเอียด")),
  );

  if (descIndex === -1) return;

  // Add category column
  headers.push("Category");

  // Auto categorize based on description
  for (let i = 1; i < data.length; i++) {
    if (data[i][descIndex]) {
      const description = data[i][descIndex].toString().toLowerCase();

      let category = "Other";
      if (description.includes("คอม") || description.includes("computer")) {
        category = "Computer";
      } else if (
        description.includes("เครื่องพิมพ์") ||
        description.includes("printer")
      ) {
        category = "Printer";
      } else if (
        description.includes("โต๊ะ") ||
        description.includes("table")
      ) {
        category = "Furniture";
      } else if (
        description.includes("เก้าอี้") ||
        description.includes("chair")
      ) {
        category = "Furniture";
      } else if (description.includes("สาย") || description.includes("cable")) {
        category = "Cable";
      }

      data[i][headers.length - 1] = category;
    }
  }

  dfSheet.clear();
  dfSheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

/**
 * Rename columns
 */
function renameColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Rename columns to standard format
  const columnMapping = {
    DATE: "Date",
    PO: "PO_Number",
    Supplier: "Supplier_Name",
    Description: "Item_Description",
    Quantity: "Quantity",
    Unit: "Unit",
    Project_Code: "Project_Code",
    Price: "Unit_Price",
    VAT: "VAT_Rate",
    Engineer: "Engineer_Name",
    Category: "Category",
  };

  // Apply column mapping
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] && columnMapping[headers[i].toString()]) {
      headers[i] = columnMapping[headers[i].toString()];
    }
  }

  dfSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

/**
 * Split header and line
 */
function splitHeaderLine_df() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dfSheet = ss.getSheetByName("df");

  if (!dfSheet) return;

  const data = dfSheet.getDataRange().getValues();
  const headers = data[0];

  // Create header sheet
  let headerSheet = ss.getSheetByName("df_HEADER");
  if (!headerSheet) {
    headerSheet = ss.insertSheet("df_HEADER");
  } else {
    headerSheet.clear();
  }

  // Create line sheet
  let lineSheet = ss.getSheetByName("df_LINE");
  if (!lineSheet) {
    lineSheet = ss.insertSheet("df_LINE");
  } else {
    lineSheet.clear();
  }

  // Header columns
  const headerColumns = ["Date", "PO_Number", "Supplier_Name", "Project_Code"];
  // Line columns
  const lineColumns = [
    "Item_Description",
    "Quantity",
    "Unit",
    "Unit_Price",
    "VAT_Rate",
    "Engineer_Name",
    "Category",
  ];

  // Find column indices
  const headerIndices = headerColumns.map((col) =>
    headers.findIndex((h) => h === col),
  );
  const lineIndices = lineColumns.map((col) =>
    headers.findIndex((h) => h === col),
  );

  // Extract header data (unique POs)
  const headerData = [];
  const poMap = new Map();

  for (let i = 1; i < data.length; i++) {
    const po = data[i][headerIndices[1]]; // PO_Number
    if (po && !poMap.has(po)) {
      const headerRow = headerIndices.map((index) => data[i][index]);
      headerData.push(headerRow);
      poMap.set(po, true);
    }
  }

  // Extract line data
  const lineData = [];
  for (let i = 1; i < data.length; i++) {
    const lineRow = lineIndices.map((index) => data[i][index]);
    lineData.push(lineRow);
  }

  // Write to sheets
  if (headerData.length > 0) {
    headerSheet
      .getRange(1, 1, 1, headerColumns.length)
      .setValues([headerColumns]);
    headerSheet
      .getRange(2, 1, headerData.length, headerColumns.length)
      .setValues(headerData);
  }

  if (lineData.length > 0) {
    lineSheet.getRange(1, 1, 1, lineColumns.length).setValues([lineColumns]);
    lineSheet
      .getRange(2, 1, lineData.length, lineColumns.length)
      .setValues(lineData);
  }
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Parse date string
 */
function parseDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    // Try Thai date format
    const thaiDate = new Date(
      dateString.replace(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, "$2/$1/$3"),
    );
    if (!isNaN(thaiDate.getTime())) {
      return thaiDate;
    }
    return null;
  }

  return date;
}

/**
 * Format date to ISO
 */
function formatDateISO(date) {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Format number
 */
function formatNumber(numberString) {
  if (!numberString) return 0;

  const cleaned = numberString.toString().replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

// ===============================
// CUSTOM MENU
// ===============================

/**
 * Create custom menu
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Data Processing")
    .addItem("Process All Data", "processAllData")
    .addSeparator()
    .addItem("Merge Sheets", "mergeSheetsToDF")
    .addItem("Clean PO Data", "cleanPO_cancelAllRows")
    .addSeparator()
    .addItem("Split Header/Line", "splitHeaderLine_df")
    .addSeparator()
    .addItem("Get API URL", "getApiUrl")
    .addSeparator()
    .addItem("Test Google Sheets", "testGoogleSheetsAccess")
    .addToUi();
}

/**
 * Get API URL for web integration
 */
function getApiUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(`API URL: ${url}`);
}
