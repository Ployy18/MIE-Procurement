// ========================================
// Enhanced Apps Script API for Web Integration
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
    
    switch(data.action) {
      case 'importData':
        return handleImportData(data);
      case 'processData':
        return handleProcessData();
      case 'importAndProcess':
        return handleImportAndProcess(data);
      default:
        return createResponse('error', 'Invalid action');
    }
  } catch (error) {
    return createResponse('error', error.toString());
  }
}

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action;
  
  switch(action) {
    case 'status':
      return createResponse('success', 'API is running');
    case 'processData':
      return handleProcessData();
    default:
      return createResponse('success', 'Data Processing API is ready');
  }
}

/**
 * Handle import data from web
 */
function handleImportData(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or clear import sheet
    let importSheet = ss.getSheetByName('IMPORT_DATA');
    if (!importSheet) {
      importSheet = ss.insertSheet('IMPORT_DATA');
    } else {
      importSheet.clear();
    }
    
    // Write imported data
    if (data.data && data.data.length > 0) {
      const headers = Object.keys(data.data[0]);
      const rows = data.data.map(row => 
        headers.map(header => row[header] || '')
      );
      
      // Add headers
      importSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Add data
      if (rows.length > 0) {
        importSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
    }
    
    return createResponse('success', `Imported ${data.data.length} rows successfully`);
    
  } catch (error) {
    return createResponse('error', `Import failed: ${error.toString()}`);
  }
}

/**
 * Handle data processing request
 */
function handleProcessData() {
  try {
    // Call the existing processAllData function
    processAllData();
    return createResponse('success', 'Data processed successfully');
    
  } catch (error) {
    return createResponse('error', `Processing failed: ${error.toString()}`);
  }
}

/**
 * Handle import and process in one step
 */
function handleImportAndProcess(data) {
  try {
    // Step 1: Import data
    const importResult = handleImportData(data);
    const importData = JSON.parse(importResult.getContent());
    
    if (importData.status !== 'success') {
      return importResult;
    }
    
    // Step 2: Process data
    const processResult = handleProcessData();
    
    return createResponse('success', 
      `Imported ${importData.message}. Processed data successfully.`);
    
  } catch (error) {
    return createResponse('error', `Import & Process failed: ${error.toString()}`);
  }
}

/**
 * Create standardized response
 */
function createResponse(status, message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: status,
    message: message,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ===============================
// MODIFIED PROCESSING FUNCTIONS
// ===============================

/**
 * Enhanced processAllData that works with imported data
 */
function processAllData() {
  const ui = SpreadsheetApp.getUi();

  try {
    // If called from web, don't show UI alerts
    const isWebCall = typeof ui === 'undefined' || 
      (typeof e !== 'undefined' && e.postData);
    
    if (!isWebCall) {
      ui.alert("เริ่มกระบวนการประมวลผลข้อมูล...");
    }

    // Step 0: Clear existing sheets
    clearExistingSheets();

    // Step 1: Merge all sheets (including IMPORT_DATA)
    mergeSheetsToDF();

    // Step 2: Clean and transform data
    cleanPO_cancelAllRows();
    cleanDatePO_df();
    splitSupplierItem_df();
    splitVendorDescription_df();
    splitDescriptionQuantity_df();
    splitUnitProjectCode_df();
    cleanUnitPrice_df();
    formatVATColumn();
    splitVATAndEngineer();

    // Step 3: Add metadata
    addRowtype_df();
    autoCategory_df();

    // Step 4: Rename columns
    renameColumns();

    // Step 5: Split data by Rowtype
    splitHeaderLine_df();

    if (!isWebCall) {
      ui.alert("✅ ประมวลผลข้อมูลเสร็จสิ้น!");
    }
    
    Logger.log("✅ Data processing completed successfully");
    
  } catch (error) {
    if (typeof ui !== 'undefined') {
      ui.alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
    Logger.log(error);
    throw error;
  }
}

/**
 * Enhanced merge function that includes IMPORT_DATA sheet
 */
function mergeSheetsToDF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let output = ss.getSheetByName("df");
  if (!output) {
    output = ss.insertSheet("df");
  } else {
    output.clear();
  }

  let mergedData = [];
  let headerAdded = false;

  sheets.forEach((sheet) => {
    if (sheet.getName() === "df") return;

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return;

    // ลบหัว PO ก่อนรวมข้อมูล
    let cleanedData = removePOHeaders(data);

    if (!headerAdded) {
      mergedData.push(cleanedData[0]);
      headerAdded = true;
    }

    mergedData = mergedData.concat(cleanedData.slice(1));
  });

  if (mergedData.length > 0) {
    output
      .getRange(1, 1, mergedData.length, mergedData[0].length)
      .setValues(mergedData);
  }

  Logger.log("✅ Merge sheets completed (including IMPORT_DATA)");
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
    .addToUi();
}

/**
 * Get API URL for web integration
 */
function getApiUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(`API URL: ${url}`);
}
