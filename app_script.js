// ========================================
// Data Processing Script - Clean & Optimized
// ========================================

// ===============================
// MAIN PROCESSING FUNCTIONS
// ===============================

/**
 * Main function - Process all data in sequence
 */
function processAllData() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert("เริ่มกระบวนการประมวลผลข้อมูล...");

    // Step 0: Clear existing sheets
    clearExistingSheets();

    // Step 1: Merge all sheets
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

    ui.alert("✅ ประมวลผลข้อมูลเสร็จสิ้น!");
  } catch (error) {
    ui.alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    Logger.log(error);
  }
}

/**
 * 1. Merge all sheets into df
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

  Logger.log("✅ Merge sheets completed");
}

/**
 * ฟังก์ชันสำหรับลบหัว PO ออกจากข้อมูล
 */
function removePOHeaders(data) {
  if (data.length === 0) return data;

  // หาแถวที่เป็น header จริง (มีคอลัมน์ "No" หรือ "เลขที่")
  let headerRowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const hasNoColumn = row.some(
      (cell) =>
        cell &&
        (cell.toString().trim().toLowerCase() === "no" ||
          cell.toString().trim() === "เลขที่" ||
          cell.toString().trim() === "เลขใบสำคัญ"),
    );

    if (hasNoColumn) {
      headerRowIndex = i;
      break;
    }
  }

  // ถ้าพบ header จริง ให้ตัดแถวด้านบนทิ้ง
  if (headerRowIndex > 0) {
    Logger.log(`✅ ลบหัว PO จำนวน ${headerRowIndex} แถวแล้ว`);
    return data.slice(headerRowIndex);
  }

  // ถ้าไม่พบ header ที่ชัดเจน ให้ลองตรวจสอบแถวแรก
  const firstRow = data[0];
  const isFirstRowHeader = firstRow.some(
    (cell) =>
      cell &&
      (cell.toString().trim().toLowerCase() === "no" ||
        cell.toString().trim() === "เลขที่" ||
        cell.toString().trim() === "เลขใบสำคัญ" ||
        cell.toString().trim() === "po.no." ||
        cell.toString().trim() === "ผู้ขาย"),
  );

  // ถ้าแถวแรกไม่ใช่ header ให้ลบแถวแรกออก
  if (!isFirstRowHeader && data.length > 1) {
    Logger.log(`✅ ลบแถวแรกที่ไม่ใช่ header แล้ว`);
    return data.slice(1);
  }

  return data;
}

/**
 * 2. Clean PO data
 */
function cleanPO_cancelAllRows() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  const values = range.getValues();

  values[0][2] = "PO.NO.";

  let lastPO = "";
  const cancelledPO = new Set();

  // Find cancelled POs
  for (let i = 1; i < values.length; i++) {
    let cell = values[i][2];

    if (cell && !cell.includes("[POยกเลิก]")) {
      lastPO = cell;
    }

    if (typeof cell === "string" && cell.includes("[POยกเลิก]")) {
      cancelledPO.add(lastPO);
    }
  }

  // Apply cancelled status and fill down
  lastPO = "";
  for (let i = 1; i < values.length; i++) {
    let cell = values[i][2];

    if (cell && !cell.includes("[POยกเลิก]")) {
      lastPO = cell;
    } else if (!cell && lastPO) {
      cell = lastPO;
    }

    values[i][2] = cancelledPO.has(lastPO) ? lastPO + " [POยกเลิก]" : lastPO;

    // Trim all text
    for (let j = 0; j < values[i].length; j++) {
      if (typeof values[i][j] === "string") {
        values[i][j] = values[i][j].trim();
      }
    }
  }

  range.setValues(values);
  Logger.log("✅ PO data cleaned");
}

/**
 * 3. Clean and format dates
 */
function cleanDatePO_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();
  if (values.length === 0) return;

  let dateCol = findColumn(values[0], ["DATE", "วันที่"]);
  if (dateCol === -1) return;

  if (values[0][dateCol] === "วันที่") values[0][dateCol] = "DATE";

  // Add Month, Year, No. columns
  values[0].splice(dateCol + 1, 0, "Month", "Year", "No.");

  let lastDate = "";

  for (let i = 1; i < values.length; i++) {
    let cell = values[i][dateCol];
    let noValue = "";

    // Extract No. value
    if (
      (typeof cell === "number" && cell < 100) ||
      (typeof cell === "string" && /^\d+$/.test(cell.trim()))
    ) {
      noValue = cell.toString().trim();
      cell = "";
    }

    // Fill down date
    if (cell !== "" && cell !== null) {
      lastDate = cell;
    } else {
      cell = lastDate;
    }

    // Parse date
    let dateObj = parseDate(cell);
    values[i][dateCol] = dateObj.formatted;
    values[i].splice(dateCol + 1, 0, dateObj.month, dateObj.year, noValue);
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Dates cleaned and formatted");
}

/**
 * 4. Split Supplier and Item
 */
function splitSupplierItem_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const col = findColumn(values[0], ["ผู้ขาย"]);
  if (col === -1) return;

  values[0].splice(col, 1, "Supplier Name", "Item Code");

  let lastSupplier = "";

  for (let i = 1; i < values.length; i++) {
    let val = values[i][col];
    let supplier = "";
    let item = "";

    if (val) {
      val = val.toString().trim();

      if (/บริษัท|หจก|Mr|Ms|Ltd|Co/i.test(val)) {
        supplier = val;
        lastSupplier = supplier;
        item = "Unknown";
      } else if (/^[A-Z0-9\-]+$/.test(val)) {
        item = val;
        supplier = lastSupplier;
      } else {
        supplier = val;
        lastSupplier = supplier;
        item = "Unknown";
      }
    } else {
      supplier = lastSupplier;
      item = "Unknown";
    }

    values[i].splice(col, 1, supplier, item);
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Supplier and Item split");
}

/**
 * 5. Split Vendor and Description
 */
function splitVendorDescription_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const col = findColumn(values[0], ["รหัสผู้ขาย"]);
  if (col === -1) return;

  values[0].splice(col, 1, "Vendor Code", "Description");

  let lastVendor = "";

  for (let i = 1; i < values.length; i++) {
    let val = values[i][col];
    let vendor = "";
    let desc = "";

    if (val) {
      val = val.toString().trim();

      if (/^[A-Z]{1,3}\d{2,}$/.test(val)) {
        vendor = val;
        lastVendor = vendor;
      } else {
        desc = val;
        vendor = lastVendor;
      }
    } else {
      vendor = lastVendor;
    }

    values[i].splice(col, 1, vendor, desc);
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Vendor and Description split");
}

/**
 * 6. Split Description and Quantity
 */
function splitDescriptionQuantity_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const col = findColumn(values[0], ["คำอธิบาย"]);
  if (col === -1) return;

  values[0].splice(col, 1, "Description2", "Quantity");

  for (let i = 1; i < values.length; i++) {
    let val = values[i][col];
    let desc = "";
    let qty = "";

    if (val !== null && val !== "") {
      val = val.toString().trim();

      if (/^\d+(\.\d+)?$/.test(val)) {
        qty = val;
      } else {
        desc = val;
      }
    }

    values[i].splice(col, 1, desc, qty);
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Description and Quantity split");
}

/**
 * 7. Split Unit and Project Code
 */
function splitUnitProjectCode_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const col = findColumn(values[0], ["รหัสงาน"]);
  if (col === -1) return;

  values[0].splice(col, 1, "Unit", "Project Code");

  let lastProject = "";

  for (let i = 1; i < values.length; i++) {
    let val = values[i][col];
    let unit = "";
    let project = "";

    if (val) {
      val = val.toString().trim().toUpperCase();

      if (/^P\d+/.test(val)) {
        project = val;
        lastProject = val;
      } else if (/^[A-Z]{2,5}$/.test(val)) {
        unit = val;
        project = lastProject;
      } else {
        project = lastProject;
      }
    } else {
      project = lastProject;
    }

    values[i].splice(col, 1, unit, project);
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Unit and Project Code split");
}

/**
 * 8. Clean Unit Price
 */
function cleanUnitPrice_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  let priceCol = findColumn(values[0], ["สถานะ", "Unit Price"]);
  if (priceCol === -1) return;

  values[0][priceCol] = "Unit Price";

  const unitCol = findColumn(values[0], ["Unit"]);

  for (let i = 1; i < values.length; i++) {
    let val = values[i][priceCol];
    if (!val) continue;

    let txt = val.toString().replace(/,/g, "").replace(/\s+/g, "").trim();

    if (/^[A-Z]+$/.test(txt) && unitCol !== -1) {
      values[i][unitCol] = txt;
      values[i][priceCol] = "";
    } else {
      let num = Number(txt);
      if (!isNaN(num)) {
        values[i][priceCol] = num;
      }
    }
  }

  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  // Format Unit Price column
  if (values.length > 1) {
    sheet
      .getRange(2, priceCol + 1, values.length - 1)
      .setNumberFormat("#,##0.####");
  }

  Logger.log("✅ Unit Price cleaned");
}

/**
 * 9. Format VAT column to numbers
 */
function formatVATColumn() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const vatCol = findColumn(values[0], ["VAT"]);
  if (vatCol === -1) return;

  for (let i = 1; i < values.length; i++) {
    let val = values[i][vatCol];

    if (val !== "" && val !== null) {
      val = val.toString().trim();

      // If it's a number, format it
      if (/^[\d,]+(\.\d+)?$/.test(val)) {
        let num = Number(val.replace(/,/g, ""));
        if (!isNaN(num)) {
          values[i][vatCol] = num;
        }
      }
    }
  }

  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  // Format VAT column as numbers
  if (values.length > 1) {
    sheet
      .getRange(2, vatCol + 1, values.length - 1)
      .setNumberFormat("#,##0.####");
  }

  Logger.log("✅ VAT column formatted");
}

/**
 * 10. Split VAT and Engineer columns
 */
function splitVATAndEngineer() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const vatCol = findColumn(values[0], ["VAT"]);
  if (vatCol === -1) return;

  // Change VAT to Total Vat and add Engineer to the right
  values[0][vatCol] = "Total Vat";
  values[0].splice(vatCol + 1, 0, "Engineer");

  for (let i = 1; i < values.length; i++) {
    let val = values[i][vatCol];
    let vat = "";
    let engineer = "";

    if (val !== "" && val !== null) {
      // Handle Date objects first
      if (val instanceof Date) {
        vat = "";
        engineer = "";
      } else {
        val = val.toString().trim();

        // If it's a number, put in Total Vat
        if (/^[\d,]+(\.\d+)?$/.test(val)) {
          vat = Number(val.replace(/,/g, ""));
          engineer = "";
        }
        // If it's text (like MIE), put in Engineer
        else {
          vat = "";
          engineer = val;
        }
      }
    }

    values[i][vatCol] = vat; // Update Total Vat
    values[i].splice(vatCol + 1, 0, engineer); // Insert Engineer to the right
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

  // Format Total Vat column
  if (values.length > 1) {
    sheet
      .getRange(2, vatCol + 1, values.length - 1)
      .setNumberFormat("#,##0.####");
  }

  Logger.log("✅ VAT split to Total Vat + Engineer");
}
/**
 * 11. Add Rowtype column
 */
function addRowtype_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const headers = values[0];
  const noCol = findColumn(headers, ["No"]);
  const aprCol = findColumn(headers, ["Apr"]);

  if (noCol === -1 || aprCol === -1) return;

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      values[i].splice(noCol, 0, "Rowtype");
    } else {
      let noVal = values[i][noCol];
      let aprVal = values[i][aprCol];
      let type = noVal || aprVal ? "HEADER" : "LINE";
      values[i].splice(noCol, 0, type);
    }
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Rowtype column added");
}

/**
 * 11. Auto categorize items
 */
function autoCategory_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  let values = range.getValues();

  const itemCol = findColumn(values[0], ["Item Code"]);
  if (itemCol === -1) return;

  let catCol = findColumn(values[0], ["Category"]);

  if (catCol === -1) {
    catCol = itemCol + 1;
    for (let i = 0; i < values.length; i++) {
      values[i].splice(catCol, 0, i === 0 ? "Category" : "");
    }
  }

  for (let i = 1; i < values.length; i++) {
    let item = (values[i][itemCol] || "").toString().toUpperCase().trim();
    let cat = "";

    // If Item Code is Unknown or empty, categorize as Other
    if (!item || item === "UNKNOWN") {
      cat = "Other";
    } else if (/P-PHONE|P-IPAD|SVOTHER|SV150|ADVANCE|PREPAY|GL/.test(item)) {
      cat = "Other";
    } else if (/SVSUB|SERVICE|SOFTWARE|MA|INSTALL|REPAIR/.test(item)) {
      cat = "Service";
    } else {
      cat = "Material";
    }

    values[i][catCol] = cat;
  }

  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  Logger.log("✅ Auto categorization completed");
}

/**
 * 12. Rename columns
 */
function renameColumns() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headerRange.getValues()[0];

  const renames = {
    ยอดรวม: "Total Amount",
    ราคาสินค้า: "Net Amount",
    ส่วนลด: "Amount",
    ยอดมัดจำ: "Deposit Amount",
  };

  Object.entries(renames).forEach(([oldName, newName]) => {
    const col = headers.indexOf(oldName);
    if (col !== -1) {
      headers[col] = newName;
    }
  });

  headerRange.setValues([headers]);

  // Format all number columns
  const numberCols = [
    "Unit Price",
    "Total Amount",
    "Net Amount",
    "Amount",
    "Deposit Amount",
    "Total Vat",
  ];
  numberCols.forEach((col) => {
    const colIdx = headers.indexOf(col);
    if (colIdx !== -1) {
      sheet
        .getRange(2, colIdx + 1, sheet.getLastRow() - 1)
        .setNumberFormat("#,##0.####");
    }
  });

  Logger.log("✅ Columns renamed and formatted");
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Clear existing sheets before processing
 */
function clearExistingSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToClear = ["df", "df_HEADER", "df_LINE"];

  sheetsToClear.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.clear();
      Logger.log(`🗑️ Cleared data from sheet: ${sheetName}`);
    }
  });

  Logger.log("✅ Existing sheets data cleared");
}

/**
 * Get sheet by name
 */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name);
}

/**
 * Find column index by multiple possible names
 */
function findColumn(headers, names) {
  for (let name of names) {
    const idx = headers.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Get column indexes for multiple columns
 */
function getColumnIndexes(headers, columns) {
  return columns.map((col) => headers.indexOf(col));
}

/**
 * Parse date in various formats
 */
function parseDate(cell) {
  if (!cell) return { formatted: "", month: "", year: "" };

  let yearAD = "",
    monthVal = "",
    dayVal = "";

  if (cell instanceof Date) {
    yearAD = cell.getFullYear();
    monthVal = cell.getMonth() + 1;
    dayVal = cell.getDate();

    // If year is BE (พ.ศ.), convert to AD (ค.ศ.)
    if (yearAD > 2500) {
      yearAD = yearAD - 543;
    }
  } else if (typeof cell === "string") {
    if (cell.includes("/")) {
      const parts = cell.split("/");
      if (parts.length === 3) {
        dayVal = parseInt(parts[0], 10);
        monthVal = parseInt(parts[1], 10);
        yearAD = parseInt(parts[2], 10);

        // If year is BE (พ.ศ.), convert to AD (ค.ศ.)
        if (yearAD > 2500) {
          yearAD = yearAD - 543;
        }
      }
    } else if (cell.includes("-")) {
      const parts = cell.split("-");
      if (parts.length === 3) {
        yearAD = parseInt(parts[0], 10);
        monthVal = parseInt(parts[1], 10);
        dayVal = parseInt(parts[2], 10);

        // If year is BE (พ.ศ.), convert to AD (ค.ศ.)
        if (yearAD > 2500) {
          yearAD = yearAD - 543;
        }
      }
    }
  }

  const formatted =
    yearAD && monthVal && dayVal ? `${yearAD}-${monthVal}-${dayVal}` : "";

  // ส่งคืนค่า month และ year เป็นตัวเลข ไม่ใช่ Date object
  return {
    formatted,
    month: monthVal.toString(),
    year: yearAD.toString(),
  };
}

/**
 * Extract row data by column indexes
 */
function extractRowData(row, indexes) {
  return indexes.map((idx) => row[idx]);
}

/**
 * Format data row (dates and numbers)
 */
function formatDataRow(row, columns, dateCols) {
  return row.map((val, idx) => {
    const colName = columns[idx];

    // Handle date columns
    if (dateCols.includes(colName)) {
      return formatDateISO(val);
    }

    // Handle number columns
    if (
      ["Total Amount", "Net Amount", "Unit Price", "Amount"].includes(colName)
    ) {
      return formatNumber(val);
    }

    return val;
  });
}

/**
 * Format date to YYYY-M-D format
 */
function formatDateISO(val) {
  if (!val) return "";

  let d;

  // Handle different date formats
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "string") {
    // Handle dd/mm/yyyy format
    if (val.includes("/")) {
      const parts = val.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);

        // If year is BE (พ.ศ.), convert to AD (ค.ศ.)
        if (year > 2500) {
          year = year - 543;
        }

        d = new Date(year, month - 1, day);
      }
    }
    // Handle yyyy-mm-dd format
    else if (val.includes("-")) {
      const parts = val.split("-");
      if (parts.length === 3) {
        let year = parseInt(parts[0], 10);

        // If year is BE (พ.ศ.), convert to AD (ค.ศ.)
        if (year > 2500) {
          year = year - 543;
        }

        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(val);
      }
    }
  } else {
    d = new Date(val);
  }

  if (isNaN(d)) return val;

  // Format as YYYY-M-D (no leading zeros)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Format number with commas and dynamic decimal places
 */
function formatNumber(val) {
  if (val === "" || val == null) return "";

  let numStr = val.toString().replace(/,/g, "").replace(/\s+/g, "");
  let num = Number(numStr);

  if (isNaN(num)) return val;

  // Check if the number is an integer (e.g., 100.00 should be 100)
  if (num % 1 === 0) {
    return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  } else {
    // For numbers with decimals (e.g., 100.40 should be 100.4, 100.45 should be 100.45)
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
}

/**
 * Write data to sheet
 */
function writeToSheet(sheetName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }

  if (data.length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    // Format only number columns
    const numberCols = ["Total Amount", "Net Amount", "Unit Price", "Amount"];
    numberCols.forEach((col) => {
      const colIdx = data[0].indexOf(col);
      if (colIdx !== -1) {
        sheet
          .getRange(2, colIdx + 1, data.length - 1)
          .setNumberFormat("#,##0.####");
      }
    });
  }
}

/**
 * 13. Split data by Rowtype into separate sheets
 */
function splitHeaderLine_df() {
  const sheet = getSheet("df");
  if (!sheet) return;

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) return;

  const headers = values[0];
  const rowtypeCol = headers.indexOf("Rowtype");
  if (rowtypeCol === -1) return;

  // Define columns for each sheet type
  const headerCols = [
    "No",
    "Apr",
    "PO.NO.",
    "DATE",
    "Month",
    "Year",
    "Supplier Name",
    "Vendor Code",
    "Description2",
    "Project Code",
    "Total Amount",
    "Net Amount",
    "Total Vat",
  ];

  const lineCols = [
    "PO.NO.",
    "DATE",
    "Month",
    "Year",
    "No.",
    "Supplier Name",
    "Item Code",
    "Category",
    "Vendor Code",
    "Description",
    "Quantity",
    "Unit",
    "Project Code",
    "Unit Price",
    "Total Amount",
    "Amount",
  ];

  // Get column indexes
  const getIndexes = (cols) => cols.map((c) => headers.indexOf(c));
  const headerIdx = getIndexes(headerCols);
  const lineIdx = getIndexes(lineCols);

  // Prepare data arrays
  let headerRows = [headerCols];
  let lineRows = [lineCols];

  // Process data rows
  for (let i = 1; i < values.length; i++) {
    let type = (values[i][rowtypeCol] || "").toUpperCase();

    if (type === "HEADER") {
      let row = headerIdx.map((idx) => values[i][idx]);

      // Format dates and numbers
      let dateIdx = headerCols.indexOf("DATE");
      let monthColIdx = headerCols.indexOf("Month");
      let yearColIdx = headerCols.indexOf("Year");

      if (dateIdx !== -1 && row[dateIdx]) {
        let dateObj = parseDate(row[dateIdx]);
        row[dateIdx] = dateObj.formatted;
        if (monthColIdx !== -1) {
          row[monthColIdx] = dateObj.month;
        }
        if (yearColIdx !== -1) {
          row[yearColIdx] = dateObj.year;
        }
      }

      ["Total Amount", "Net Amount", "Total Vat"].forEach((col) => {
        let idx = headerCols.indexOf(col);
        if (idx !== -1 && row[idx]) {
          row[idx] = formatNumber(row[idx]);
        }
      });

      headerRows.push(row);
    }

    if (type === "LINE") {
      let row = lineIdx.map((idx) => values[i][idx]);

      // Format dates and numbers
      let dateIdx = lineCols.indexOf("DATE");
      let monthColIdx = lineCols.indexOf("Month");
      let yearColIdx = lineCols.indexOf("Year");

      if (dateIdx !== -1 && row[dateIdx]) {
        let dateObj = parseDate(row[dateIdx]);
        row[dateIdx] = dateObj.formatted;
        if (monthColIdx !== -1) {
          row[monthColIdx] = dateObj.month;
        }
        if (yearColIdx !== -1) {
          row[yearColIdx] = dateObj.year;
        }
      }

      ["Unit Price", "Total Amount", "Amount"].forEach((col) => {
        let idx = lineCols.indexOf(col);
        if (idx !== -1 && row[idx]) {
          row[idx] = formatNumber(row[idx]);
        }
      });

      lineRows.push(row);
    }
  }

  // ลบหัว PO ที่อาจมากับข้อมูลใหม่
  if (headerRows.length > 0) {
    // ตรวจสอบว่าแถวแรกเป็นหัว PO หรือไม่ (โดยดูว่ามีคอลัมน์ "No" หรือไม่)
    const firstRow = headerRows[0];
    const hasNoColumn = firstRow.some(
      (cell) => cell && cell.toString().trim().toLowerCase() === "no",
    );

    // ถ้าไม่มีคอลัมน์ "No" แสดงว่าเป็นหัว PO ต้องลบออก
    if (!hasNoColumn) {
      let rowsToDelete = 0;

      // หาจำนวนแถวที่เป็นหัว PO (วนจนกว่าจะเจอแถวที่มี "No")
      for (let i = 0; i < headerRows.length; i++) {
        const hasNoInRow = headerRows[i].some(
          (cell) => cell && cell.toString().trim().toLowerCase() === "no",
        );
        if (hasNoInRow) {
          break;
        }
        rowsToDelete++;
      }

      // ลบแถวหัว PO ทิ้ง
      if (rowsToDelete > 0) {
        headerRows.splice(0, rowsToDelete);
        Logger.log(`✅ ลบหัว PO จำนวน ${rowsToDelete} แถวแล้ว`);
      }
    }
  }

  // Create/update df_HEADER sheet
  let headerSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("df_HEADER");
  if (!headerSheet)
    headerSheet =
      SpreadsheetApp.getActiveSpreadsheet().insertSheet("df_HEADER");
  headerSheet.clear();

  if (headerRows.length > 0) {
    headerSheet
      .getRange(1, 1, headerRows.length, headerRows[0].length)
      .setValues(headerRows);
    ["Total Amount", "Net Amount", "Total Vat"].forEach((col) => {
      const colIdx = headerCols.indexOf(col);
      if (colIdx !== -1 && headerRows.length > 1) {
        headerSheet
          .getRange(2, colIdx + 1, headerRows.length - 1)
          .setNumberFormat("#,##0.####");
      }
    });
  }

  // Create/update df_LINE sheet
  let lineSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("df_LINE");
  if (!lineSheet)
    lineSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("df_LINE");
  lineSheet.clear();
  if (lineRows.length > 0) {
    lineSheet
      .getRange(1, 1, lineRows.length, lineRows[0].length)
      .setValues(lineRows);

    // Format number columns in df_LINE
    ["Unit Price", "Total Amount", "Amount"].forEach((col) => {
      const colIdx = lineCols.indexOf(col);
      if (colIdx !== -1 && lineRows.length > 1) {
        lineSheet
          .getRange(2, colIdx + 1, lineRows.length - 1)
          .setNumberFormat("#,##0.####");
      }
    });
  }

  Logger.log("✅ Data split into df_HEADER and df_LINE sheets");
}

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
    .addToUi();
}
