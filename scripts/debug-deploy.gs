// ========================================
// Debug Deploy Script
// ========================================

/**
 * Simple test function
 */
function testFunction() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {
      spreadsheet_name: ss.getName(),
      spreadsheet_id: ss.getId(),
      total_sheets: ss.getSheets().length,
      sheet_names: ss.getSheets().map(sheet => sheet.getName()),
      script_url: ScriptApp.getService().getUrl(),
      timestamp: new Date().toISOString()
    };
    
    Logger.log('Test function result: ' + JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    Logger.log('Test function error: ' + error.toString());
    return { error: error.toString() };
  }
}

/**
 * Test POST handler
 */
function doPost(e) {
  try {
    Logger.log('doPost called');
    Logger.log('Request method: ' + e.request.method);
    Logger.log('Post data: ' + e.postData.contents);
    
    const data = JSON.parse(e.postData.contents);
    const result = {
      status: 'success',
      message: 'Debug POST working',
      received: data,
      timestamp: new Date().toISOString()
    };
    
    Logger.log('POST result: ' + JSON.stringify(result));
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test GET handler
 */
function doGet(e) {
  try {
    Logger.log('doGet called');
    Logger.log('Parameters: ' + JSON.stringify(e.parameter));
    
    const result = {
      status: 'success',
      message: 'Debug GET working',
      parameters: e.parameter,
      script_url: ScriptApp.getService().getUrl(),
      timestamp: new Date().toISOString()
    };
    
    Logger.log('GET result: ' + JSON.stringify(result));
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Create debug menu
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Debug")
    .addItem("Test Function", "testFunction")
    .addItem("Get Script URL", "getScriptUrl")
    .addItem("View Logs", "viewLogs")
    .addToUi();
}

/**
 * Get script URL
 */
function getScriptUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('Script URL: ' + url);
  Logger.log('Script URL: ' + url);
}

/**
 * View logs
 */
function viewLogs() {
  const logs = Logger.getLog();
  if (logs && logs.length > 0) {
    SpreadsheetApp.getUi().alert('Recent Logs:\n\n' + logs.slice(-1000));
  } else {
    SpreadsheetApp.getUi().alert('No logs found');
  }
}
