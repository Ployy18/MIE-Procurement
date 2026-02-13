// ========================================
// Simple Test API for Debugging
// ========================================

/**
 * Handle POST requests - Simple version
 */
function doPost(e) {
  try {
    // Simple response without complex CORS
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Simple API is working',
      received: e.postData ? e.postData.contents : 'No data',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests - Simple version
 */
function doGet(e) {
  try {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Simple API is ready',
      action: e.parameter.action || 'no action',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Create simple menu
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Simple Test")
    .addItem("Get API URL", "getApiUrl")
    .addItem("Test API", "testApi")
    .addToUi();
}

/**
 * Get API URL
 */
function getApiUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(`API URL: ${url}`);
}

/**
 * Test API
 */
function testApi() {
  try {
    const url = ScriptApp.getService().getUrl();
    const response = UrlFetchApp.fetch(url + "?action=test");
    SpreadsheetApp.getUi().alert("Test Result: " + response.getContentText());
  } catch (error) {
    SpreadsheetApp.getUi().alert("Test Error: " + error.toString());
  }
}
