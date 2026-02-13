// ========================================
// CORS-Fixed Apps Script API for Web Integration
// ========================================

// ===============================
// WEB API FUNCTIONS
// ===============================

/**
 * Handle POST requests from web interface
 */
function doPost(e) {
  try {
    // Enable CORS
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    
    // Handle preflight OPTIONS request
    if (e.request.method === 'OPTIONS') {
      output.setContent(JSON.stringify({ status: 'success', message: 'CORS enabled' }));
      Object.keys(headers).forEach(key => {
        output.addHeader(key, headers[key]);
      });
      return output;
    }
    
    const data = JSON.parse(e.postData.contents);
    
    let result;
    switch(data.action) {
      case 'importData':
        result = handleImportData(data);
        break;
      case 'processData':
        result = handleProcessData();
        break;
      case 'importAndProcess':
        result = handleImportAndProcess(data);
        break;
      default:
        result = { status: 'error', message: 'Invalid action' };
    }
    
    output.setContent(JSON.stringify(result));
    Object.keys(headers).forEach(key => {
      output.addHeader(key, headers[key]);
    });
    
    return output;
    
  } catch (error) {
    const errorOutput = ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    }));
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    
    // Add CORS headers to error response
    errorOutput.addHeader('Access-Control-Allow-Origin', '*');
    errorOutput.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    errorOutput.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return errorOutput;
  }
}

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    // Enable CORS
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    // Set CORS headers
    output.addHeader('Access-Control-Allow-Origin', '*');
    output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    const action = e.parameter.action;
    let result;
    
    switch(action) {
      case 'status':
        result = { status: 'success', message: 'API is running' };
        break;
      case 'processData':
        result = handleProcessData();
        break;
      default:
        result = { status: 'success', message: 'Data Processing API is ready' };
    }
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    const errorOutput = ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    }));
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    
    // Add CORS headers to error response
    errorOutput.addHeader('Access-Control-Allow-Origin', '*');
    errorOutput.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    errorOutput.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return errorOutput;
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
    
    return { status: 'success', message: `Imported ${data.data.length} rows successfully` };
    
  } catch (error) {
    return { status: 'error', message: `Import failed: ${error.toString()}` };
  }
}

/**
 * Handle data processing request
 */
function handleProcessData() {
  try {
    // Call the existing processAllData function
    processAllData();
    return { status: 'success', message: 'Data processed successfully' };
    
  } catch (error) {
    return { status: 'error', message: `Processing failed: ${error.toString()}` };
  }
}

/**
 * Handle import and process in one step
 */
function handleImportAndProcess(data) {
  try {
    // Step 1: Import data
    const importResult = handleImportData(data);
    
    if (importResult.status !== 'success') {
      return importResult;
    }
    
    // Step 2: Process data
    const processResult = handleProcessData();
    
    return { 
      status: 'success', 
      message: `Imported ${importResult.message}. Processed data successfully.` 
    };
    
  } catch (error) {
    return { status: 'error', message: `Import & Process failed: ${error.toString()}` };
  }
}

// ===============================
// COPY ALL YOUR EXISTING FUNCTIONS HERE
// ===============================

// วางฟังก์ชันทั้งหมดจาก Apps Script เดิมของคุณที่นี่
// เช่น: clearExistingSheets, removePOHeaders, cleanPO_cancelAllRows, cleanDatePO_df, 
// splitSupplierItem_df, splitVendorDescription_df, splitDescriptionQuantity_df,
// splitUnitProjectCode_df, cleanUnitPrice_df, formatVATColumn, splitVATAndEngineer,
// addRowtype_df, autoCategory_df, renameColumns, splitHeaderLine_df,
// parseDate, formatDateISO, formatNumber, etc.

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
    .addItem("Test CORS", "testCORS")
    .addToUi();
}

/**
 * Get API URL for web integration
 */
function getApiUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(`API URL: ${url}`);
}

/**
 * Test CORS functionality
 */
function testCORS() {
  try {
    const url = ScriptApp.getService().getUrl();
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://your-website-domain.com'
      },
      payload: JSON.stringify({
        action: 'status'
      })
    });
    
    SpreadsheetApp.getUi().alert(`CORS Test Result: ${response.getContentText()}`);
  } catch (error) {
    SpreadsheetApp.getUi().alert(`CORS Test Error: ${error.toString()}`);
  }
}
