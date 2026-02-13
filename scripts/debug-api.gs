// ========================================
// Debug Apps Script API for Testing
// ========================================

// ===============================
// DEBUG WEB API FUNCTIONS
// ===============================

/**
 * Handle POST requests with detailed logging
 */
function doPost(e) {
  try {
    // Log everything for debugging
    Logger.log("=== doPost called ===");
    Logger.log("Request method: " + e.request.method);
    Logger.log("Request content type: " + e.request.headers['Content-Type']);
    Logger.log("Post data: " + e.postData.contents);
    
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
      Logger.log("Handling OPTIONS request");
      output.setContent(JSON.stringify({ 
        status: 'success', 
        message: 'CORS enabled',
        debug: 'OPTIONS request handled'
      }));
      Object.keys(headers).forEach(key => {
        output.addHeader(key, headers[key]);
      });
      return output;
    }
    
    // Parse incoming data
    let data;
    try {
      data = JSON.parse(e.postData.contents);
      Logger.log("Parsed data: " + JSON.stringify(data));
    } catch (parseError) {
      Logger.log("Parse error: " + parseError.toString());
      output.setContent(JSON.stringify({
        status: 'error',
        message: 'Invalid JSON: ' + parseError.toString()
      }));
      Object.keys(headers).forEach(key => {
        output.addHeader(key, headers[key]);
      });
      return output;
    }
    
    let result;
    switch(data.action) {
      case 'importData':
        result = handleImportDataDebug(data);
        break;
      case 'processData':
        result = handleProcessDataDebug();
        break;
      case 'importAndProcess':
        result = handleImportAndProcessDebug(data);
        break;
      default:
        result = { status: 'error', message: 'Invalid action: ' + data.action };
    }
    
    Logger.log("Result: " + JSON.stringify(result));
    
    output.setContent(JSON.stringify(result));
    Object.keys(headers).forEach(key => {
      output.addHeader(key, headers[key]);
    });
    
    return output;
    
  } catch (error) {
    Logger.log("doPost error: " + error.toString());
    Logger.log("Stack: " + error.stack);
    
    const errorOutput = ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      stack: error.stack,
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
 * Handle GET requests with debugging
 */
function doGet(e) {
  try {
    Logger.log("=== doGet called ===");
    Logger.log("Parameters: " + JSON.stringify(e.parameter));
    
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
        result = { 
          status: 'success', 
          message: 'API is running',
          debug: 'Debug API is active',
          timestamp: new Date().toISOString()
        };
        break;
      case 'test':
        result = testGoogleSheetsAccess();
        break;
      case 'processData':
        result = handleProcessDataDebug();
        break;
      default:
        result = { 
          status: 'success', 
          message: 'Debug API is ready',
          available_actions: ['status', 'test', 'processData']
        };
    }
    
    Logger.log("GET result: " + JSON.stringify(result));
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    Logger.log("doGet error: " + error.toString());
    
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
 * Debug version of import data
 */
function handleImportDataDebug(data) {
  try {
    Logger.log("=== handleImportDataDebug called ===");
    Logger.log("Data length: " + (data.data ? data.data.length : 0));
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("Spreadsheet name: " + ss.getName());
    
    // Create or clear import sheet
    let importSheet = ss.getSheetByName('IMPORT_DATA');
    if (!importSheet) {
      Logger.log("Creating new IMPORT_DATA sheet");
      importSheet = ss.insertSheet('IMPORT_DATA');
    } else {
      Logger.log("Clearing existing IMPORT_DATA sheet");
      importSheet.clear();
    }
    
    // Write imported data
    if (data.data && data.data.length > 0) {
      Logger.log("Writing " + data.data.length + " rows of data");
      
      const headers = Object.keys(data.data[0]);
      Logger.log("Headers: " + headers.join(", "));
      
      const rows = data.data.map(row => 
        headers.map(header => row[header] || '')
      );
      
      // Add headers
      importSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      Logger.log("Headers written to sheet");
      
      // Add data
      if (rows.length > 0) {
        importSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        Logger.log("Data written to sheet");
      }
      
      // Verify data was written
      const writtenData = importSheet.getDataRange().getValues();
      Logger.log("Verification - total rows written: " + writtenData.length);
      
    } else {
      Logger.log("No data to write");
    }
    
    return { 
      status: 'success', 
      message: `Imported ${data.data.length} rows successfully`,
      debug: {
        sheet_name: 'IMPORT_DATA',
        rows_written: data.data.length,
        headers: data.data && data.data.length > 0 ? Object.keys(data.data[0]) : [],
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    Logger.log("Import error: " + error.toString());
    Logger.log("Stack: " + error.stack);
    return { 
      status: 'error', 
      message: `Import failed: ${error.toString()}`,
      debug: {
        error_type: error.name,
        error_message: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Debug version of process data
 */
function handleProcessDataDebug() {
  try {
    Logger.log("=== handleProcessDataDebug called ===");
    
    // Check if processAllData function exists
    if (typeof processAllData === 'undefined') {
      return { 
        status: 'error', 
        message: 'processAllData function not found',
        debug: 'Please add your processing functions to this script'
      };
    }
    
    // Call the existing processAllData function
    processAllData();
    
    return { 
      status: 'success', 
      message: 'Data processed successfully',
      debug: {
        function_called: 'processAllData',
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    Logger.log("Process error: " + error.toString());
    return { 
      status: 'error', 
      message: `Processing failed: ${error.toString()}`,
      debug: {
        error_type: error.name,
        error_message: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Debug version of import and process
 */
function handleImportAndProcessDebug(data) {
  try {
    Logger.log("=== handleImportAndProcessDebug called ===");
    
    // Step 1: Import data
    const importResult = handleImportDataDebug(data);
    
    if (importResult.status !== 'success') {
      return importResult;
    }
    
    // Step 2: Process data
    const processResult = handleProcessDataDebug();
    
    return { 
      status: 'success', 
      message: `Imported ${importResult.message}. Processed data successfully.`,
      debug: {
        import_result: importResult.debug,
        process_result: processResult.debug,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    Logger.log("Import & Process error: " + error.toString());
    return { 
      status: 'error', 
      message: `Import & Process failed: ${error.toString()}`,
      debug: {
        error_type: error.name,
        error_message: error.message,
        timestamp: new Date().toISOString()
      }
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
      status: 'success',
      message: 'Google Sheets access is working',
      debug: {
        spreadsheet_name: ss.getName(),
        spreadsheet_id: ss.getId(),
        total_sheets: sheets.length,
        sheet_names: sheets.map(sheet => sheet.getName()),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Google Sheets access failed',
      debug: {
        error: error.toString(),
        timestamp: new Date().toISOString()
      }
    };
  }
}

// ===============================
// CUSTOM MENU
// ===============================

/**
 * Create custom menu with debug options
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Debug API")
    .addItem("Test Google Sheets Access", "testGoogleSheetsAccess")
    .addSeparator()
    .addItem("Get API URL", "getApiUrl")
    .addSeparator()
    .addItem("View Logs", "viewLogs")
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
 * View recent logs
 */
function viewLogs() {
  try {
    const logs = Logger.getLog();
    if (logs && logs.length > 0) {
      SpreadsheetApp.getUi().alert("Recent Logs:\n\n" + logs.slice(-1000)); // Last 1000 chars
    } else {
      SpreadsheetApp.getUi().alert("No logs found");
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert("Error viewing logs: " + error.toString());
  }
}
