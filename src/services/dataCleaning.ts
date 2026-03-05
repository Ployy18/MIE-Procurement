import { format, parse, isValid } from "date-fns";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface RawDataRow {
  [key: string]: string | number | null | undefined;
}

export interface CleanedDataRow {
  date: string;
  poNumber: string;
  supplier: string;
  description: string;
  description2: string;
  itemCode: string;
  quantity: number | string;
  unit: string;
  projectCode: string;
  unitPrice: number | string;
  totalPrice: number | string;
  netAmount: number | string;
  amount: number | string;
  totalVat: number | string;
  vatRate: string;
  engineerName: string;
  category: string;
  sourceSheet?: string;
  batchId?: string;
  _isHead?: boolean;
  _isLine?: boolean;
  _sourceSheet?: string;
}

export interface MultiTableData {
  procurement_data: CleanedDataRow[];
  procurement_head: CleanedDataRow[];
  procurement_line: CleanedDataRow[];
  suppliers_master: { name: string; last_seen: string }[];
  categories_master: { name: string; description: string }[];
  upload_logs: {
    timestamp: string;
    filename: string;
    row_count: number;
    status: string;
    sheets_processed?: number;
    sheet_details?: { sheet: string; rows: number }[];
  }[];
  dataBySheet?: { [sheetName: string]: CleanedDataRow[] };
}

/**
 * Service for cleaning and standardizing procurement data
 */

// Column mapping configuration - adjust these values based on your Excel file structure
const COLUMN_MAPPING = {
  DATE: "__EMPTY_2", // Column C (3rd column)
  PO_NUMBER: "__EMPTY_1", // Column B (2nd column)
  SUPPLIER: "__EMPTY_3", // Column E (5th column)
  DESCRIPTION: "__EMPTY_4", // Column F (6th column) - รหัสผู้ขาย (contains descriptive text, not actual vendor codes)
  DESCRIPTION2: "__EMPTY_5", // Column G (7th column) - คำอธิบาย (description column)
  ITEM_CODE: "__EMPTY_3", // Column E (5th column) - ผู้ขาย (for line items - contains item codes like P-FIBER, LAN-004)
  QUANTITY: "__EMPTY_5", // Column G (7th column) - คำอธิบาย (for quantity numbers)
  UNIT: "__EMPTY_6", // Column H (8th column) - รหัสงาน (for units like M, BOX)
  UNIT_PRICE: "__EMPTY_7", // Column I (9th column) - สถานะ (for unit price)
  TOTAL_AMOUNT: "__EMPTY_8", // Column J (10th column) - ยอดรวม (for total amount)
  NET_AMOUNT: "__EMPTY_9", // Column K (11th column) - ราคาสินค้า (for net amount)
  AMOUNT: "__EMPTY_10", // Column L (12th column) - ส่วนลด (for discount/amount)
  TOTAL_VAT: "__EMPTY_11", // Column M (13th column) - VAT (for total vat)
  PROJECT: "__EMPTY_12", // Column N (14th column) - NRV (for project code)
  VAT: "__EMPTY_13", // Column O (15th column)
  ENGINEER: "__EMPTY_14", // Column P (16th column)
};

export const DataCleaningService = {
  // Track last seen header data for fill down functionality
  lastHeaderData: {
    poNumber: "",
    date: "",
    supplier: "",
  },

  /**
   * Generate a unique batch ID for each upload
   */
  generateBatchId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `BATCH-${timestamp}-${random}`;
  },

  /**
   * Main cleaning pipeline
   */
  cleanData(rawData: RawDataRow[]): CleanedDataRow[] {
    console.log("🧹 [DataCleaningService] Starting data cleaning pipeline...");
    console.log("📊 [DataCleaningService] Input data:", {
      totalRows: rawData.length,
      sampleRow: rawData[0],
    });

    // Reset header data for new file processing
    this.lastHeaderData = {
      poNumber: "",
      date: "",
      supplier: "",
    };

    // First pass: process all rows normally
    const processedData = rawData
      .filter((row) => this.isValidRow(row))
      .map((row) => this.processRow(row));

    // Second pass: update headers with project codes from subsequent line items
    for (let i = 0; i < processedData.length; i++) {
      const currentRow = processedData[i];

      // If this is a header without project code, look for next line item with project code
      if (currentRow.itemCode === "" && currentRow.projectCode === "N/A") {
        // Look for next line item with project code
        for (let j = i + 1; j < processedData.length; j++) {
          const nextRow = processedData[j];
          if (nextRow.itemCode !== "" && nextRow.projectCode !== "N/A") {
            // Found a line item with project code, update the header
            currentRow.projectCode = nextRow.projectCode;
            break;
          }
        }
      }
    }

    console.log("✅ [DataCleaningService] Data cleaning completed");
    console.log("📊 [DataCleaningService] Output data:", {
      totalRows: processedData.length,
      sampleRow: processedData[0],
    });

    return processedData;
  },

  /**
   * Parse Excel file buffer
   */
  async parseExcel(file: File): Promise<RawDataRow[]> {
    console.log(
      "📊 [DataCleaningService] Starting Excel parsing for:",
      file.name,
    );

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as RawDataRow[];

          console.log("✅ [DataCleaningService] Excel parsing completed:", {
            sheets: workbook.SheetNames,
            selectedSheet: firstSheetName,
            rowsParsed: jsonData.length,
            sampleRow: jsonData[0],
          });

          resolve(jsonData);
        } catch (err) {
          console.error("❌ [DataCleaningService] Excel parsing error:", err);
          reject(err);
        }
      };
      reader.onerror = (err) => {
        console.error("❌ [DataCleaningService] File reading error:", err);
        reject(err);
      };
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Process data into multiple tables
   */
  processMultiTableData(
    cleanedData: CleanedDataRow[],
    filename: string,
  ): MultiTableData {
    console.log(
      "📊 [DataCleaningService] Processing data into Head/Line tables...",
    );

    // Generate batch ID for this upload
    const batchId = this.generateBatchId();
    console.log(`🆔 [DataCleaningService] Generated batch ID: ${batchId}`);

    // Group data by source sheet first
    const dataBySheet = cleanedData.reduce(
      (acc, row) => {
        const sheetName = row.sourceSheet || "Unknown";
        if (!acc[sheetName]) acc[sheetName] = [];
        acc[sheetName].push(row);
        return acc;
      },
      {} as { [sheetName: string]: CleanedDataRow[] },
    );

    // Separate Head and Line data based on PO number presence
    const headData: CleanedDataRow[] = [];
    const lineData: CleanedDataRow[] = [];

    // Track PO numbers to identify heads vs lines
    const poNumbers = new Set<string>();
    const processedPOs = new Set<string>();

    // First pass: collect all unique PO numbers
    cleanedData.forEach((row) => {
      if (row.poNumber && row.poNumber.trim()) {
        poNumbers.add(row.poNumber.trim());
      }
    });

    console.log(
      `📋 [DataCleaningService] Found ${poNumbers.size} unique PO numbers`,
    );

    // Second pass: separate heads and lines with batch ID
    cleanedData.forEach((row) => {
      const poNum = row.poNumber?.trim();

      if (!poNum) {
        // Row without PO number - treat as line item
        lineData.push({
          ...row,
          batchId,
          _isHead: false,
          _isLine: true,
          _sourceSheet: row.sourceSheet || "Unknown",
        });
      } else if (!processedPOs.has(poNum)) {
        // First occurrence of this PO number - treat as head
        processedPOs.add(poNum);
        headData.push({
          ...row,
          batchId,
          _isHead: true,
          _isLine: false,
          _sourceSheet: row.sourceSheet || "Unknown",
        });
      } else {
        // Subsequent occurrence of same PO number - treat as line item
        lineData.push({
          ...row,
          batchId,
          _isHead: false,
          _isLine: true,
          _sourceSheet: row.sourceSheet || "Unknown",
        });
      }
    });

    console.log(`📊 [DataCleaningService] Separated data:`, {
      totalRows: cleanedData.length,
      headRows: headData.length,
      lineRows: lineData.length,
      uniquePOs: poNumbers.size,
      batchId: batchId,
    });

    // 1. Combined procurement data (for backward compatibility) with batch ID
    const procurement_data = cleanedData.map((row) => ({
      ...row,
      batchId,
    }));

    // 2. Head table (PO headers) with batch ID
    const procurement_head = headData.map((row) => ({
      ...row,
      batchId,
      _isHead: true,
      _isLine: false,
    }));

    // 3. Line table (PO line items) with batch ID
    const procurement_line = lineData;

    // 4. Suppliers Master (Unique suppliers from line data)
    const uniqueSuppliers = [...new Set(lineData.map((row) => row.supplier))];
    const suppliers_master = uniqueSuppliers.map((name) => ({
      name,
      last_seen: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    }));

    // 5. Categories Master (Unique categories from line data)
    const uniqueCategories = [...new Set(lineData.map((row) => row.category))];
    const categories_master = uniqueCategories.map((name) => ({
      name,
      description: `Auto-generated category for ${name}`,
    }));

    // 6. Upload Logs with batch ID
    const upload_logs = [
      {
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        filename: filename,
        row_count: cleanedData.length,
        status: "Success",
        sheets_processed: Object.keys(dataBySheet).length,
        batchId: batchId, // Add batch ID to upload logs
        sheet_details: Object.entries(dataBySheet).map(([sheet, data]) => ({
          sheet,
          rows: data.length,
        })),
      },
    ];

    return {
      procurement_data,
      procurement_head,
      procurement_line,
      suppliers_master,
      categories_master,
      upload_logs,
      dataBySheet,
    };
  },

  /**
   * Check if a row is valid (must have data - can be header or line item)
   */
  isValidRow(row: RawDataRow): boolean {
    console.log(
      "🔍 [DataCleaningService] Checking row validity. Available columns:",
      Object.keys(row),
    );
    console.log("📊 [DataCleaningService] Row data sample:", row);

    const poValue = this.findValue(row, [
      "PO",
      "PO_Number",
      "เลขที่ PO",
      "PO.NO.",
      "PO NO",
      "__EMPTY_1", // For Excel files with merged headers
    ]);

    // Check for header rows (with PO numbers) or line item rows
    const hasPO = poValue && poValue.toString().trim() !== "";
    const hasDescription = this.findValue(row, [
      COLUMN_MAPPING.DESCRIPTION,
      "__EMPTY_5", // Direct reference to DESCRIPTION2 column
    ]);

    console.log("🎯 [DataCleaningService] PO value found:", poValue);
    console.log("📝 [DataCleaningService] Description found:", hasDescription);

    // Valid if it has PO number (header) OR description (line item)
    if (!hasPO && !hasDescription) {
      console.log(
        "❌ [DataCleaningService] Invalid row: No PO number or description found",
      );
      return false;
    }

    // Check for placeholder/sample data
    if (hasPO) {
      const poStr = poValue.toString().trim();
      const placeholderPatterns = [
        "เลขใบสำคัญ",
        "เลขที่ PO",
        "PO Number",
        "sample",
        "ตัวอย่าง",
        "test",
      ];

      if (
        placeholderPatterns.some((pattern) =>
          poStr.toLowerCase().includes(pattern.toLowerCase()),
        )
      ) {
        console.log(
          "❌ [DataCleaningService] Invalid row: Placeholder/sample data detected",
        );
        return false;
      }

      // Check for "cancelled" keywords in the PO number itself
      if (
        poStr.toLowerCase().includes("ยกเลิก") ||
        poStr.toLowerCase().includes("cancelled")
      ) {
        console.log("❌ [DataCleaningService] Invalid row: PO cancelled");
        return false;
      }
    }

    // Also check status column if it exists
    const statusValue = this.findValue(row, ["PO Status", "Status", "สถานะ"]);
    if (statusValue) {
      const statusStr = statusValue.toString().toLowerCase();
      if (statusStr.includes("ยกเลิก") || statusStr.includes("cancelled")) {
        console.log("❌ [DataCleaningService] Invalid row: Status cancelled");
        return false;
      }
    }

    console.log("✅ [DataCleaningService] Valid row passed all checks");
    return true;
  },

  /**
   * Process and standardize a single row with fill down functionality
   */
  processRow(row: RawDataRow): CleanedDataRow {
    // 1. Extract Date
    const rawDate = this.findValue(row, [COLUMN_MAPPING.DATE]);
    const cleanedDate = this.parseDate(rawDate);

    // 2. Extract PO Number
    const poNumber = (this.findValue(row, [COLUMN_MAPPING.PO_NUMBER]) || "")
      .toString()
      .trim();

    // 3. Check if this is a header row (has PO number)
    const isHeaderRow = poNumber && poNumber !== "";

    if (isHeaderRow) {
      // Update last seen header data
      this.lastHeaderData.poNumber = poNumber;
      this.lastHeaderData.date = cleanedDate;
    }

    // 4. Extract Supplier and Item
    const rawSupplier = this.findValue(row, [COLUMN_MAPPING.SUPPLIER]);
    const rawDescription = this.findValue(row, [COLUMN_MAPPING.DESCRIPTION]);
    const rawDescription2 = this.findValue(row, ["__EMPTY_5"]); // Direct reference to DESCRIPTION2 column
    const rawItemCode = this.findValue(row, [COLUMN_MAPPING.ITEM_CODE]); // Item code from column E

    let supplier = "";
    let description = "";
    let itemCode = "";

    // If it's a header row, extract supplier name from rawSupplier
    if (isHeaderRow) {
      supplier = rawSupplier?.toString() || "";
      itemCode = ""; // Headers don't have item codes
      // Update last header data
      this.lastHeaderData.supplier = supplier;
    } else {
      // For line items, always use supplier name from last header (fill down)
      supplier = this.lastHeaderData.supplier;
      // Extract item code from rawItemCode (column E)
      itemCode = rawItemCode?.toString() || "";
    }

    // Extract item description from rawDescription (column F)
    // Handle mixed data: codes vs descriptions
    const descText = rawDescription?.toString() || "";

    // Check if it's a short code (like I001, Z002, U011) or a description
    if (descText.length <= 4 && /^[A-Z]\d{3}$/.test(descText)) {
      // It's likely a product code, use description2 instead
      description = rawDescription2?.toString() || descText;
    } else if (descText.includes("(") && descText.includes(")")) {
      // It contains parentheses, extract the main description part
      const parts = descText.split("(");
      description = parts[0]?.trim() || descText;
    } else if (
      descText.includes("เครื่อง") ||
      descText.includes("Dahua") ||
      descText.includes("HP") ||
      descText.includes("Apollo")
    ) {
      // It's a detailed description, use as is
      description = descText;
    } else {
      // Use the description as is
      description = descText;
    }

    let description2 = rawDescription2?.toString() || "";
    // Filter out numeric values for description2
    if (!isNaN(Number(description2))) {
      description2 = "";
    }

    // 5. Extract Project Code
    const rawProject = this.findValue(row, [COLUMN_MAPPING.PROJECT]);
    let projectCode = rawProject?.toString() || "";

    // For now, just use the project code directly from the column
    // Headers without project code will show "N/A" until we implement look-ahead logic

    // 6. Extract Quantity and Price
    const rawQuantity = this.findValue(row, [COLUMN_MAPPING.QUANTITY]);
    const rawUnitPrice = this.findValue(row, [COLUMN_MAPPING.UNIT_PRICE]);
    const rawTotalAmount = this.findValue(row, [COLUMN_MAPPING.TOTAL_AMOUNT]);
    const rawNetAmount = this.findValue(row, [COLUMN_MAPPING.NET_AMOUNT]);
    const rawTotalVat = this.findValue(row, [COLUMN_MAPPING.TOTAL_VAT]);
    const rawPrice = this.findValue(row, [COLUMN_MAPPING.AMOUNT]);

    // If no item code, set quantity and unit to empty
    let quantity: number | string = 1;
    let finalUnit = "";

    if (!itemCode) {
      // No item code - set quantity and unit to empty
      quantity = "";
      finalUnit = "";

      // If it's a header row, also set quantity to empty string for display
      if (isHeaderRow) {
        quantity = ""; // Keep as empty string for display
      }
    } else {
      // Has item code - process quantity normally
      if (rawQuantity && !isNaN(Number(rawQuantity.toString()))) {
        quantity = this.parseNumber(rawQuantity) || "";
      }

      // Process unit from column H (รหัสงาน) - filter for actual product units only
      const rawUnit = this.findValue(row, [COLUMN_MAPPING.UNIT]);

      if (rawUnit) {
        const unitText = rawUnit.toString().trim().toUpperCase();

        // Check if it's likely a unit (short text, not a work code)
        // Accept any short text (1-10 characters) that doesn't look like a work code
        if (
          unitText.length <= 10 &&
          !unitText.includes("PROJ") &&
          !unitText.includes("TASK") &&
          !unitText.includes("WORK") &&
          !unitText.includes("รหัส") &&
          !unitText.includes("งาน")
        ) {
          finalUnit = unitText;
        }
      }

      // If no valid unit found, use empty string
      if (!finalUnit) {
        finalUnit = "";
      }
    }

    const unitPrice = this.parseNumber(rawUnitPrice);
    const totalPrice = this.parseNumber(rawTotalAmount); // Use total amount from column J (ยอดรวม)
    const netAmount = this.parseNumber(rawNetAmount); // Use net amount from column K (ราคาสินค้า)
    const amount = this.parseNumber(rawPrice); // Use amount from column L (ส่วนลด)
    const totalVat = this.parseNumber(rawTotalVat); // Use total vat from column M (VAT)

    // 7. Extract VAT and Engineer
    const rawVat = this.findValue(row, [COLUMN_MAPPING.VAT]);
    const rawEngineer = this.findValue(row, [COLUMN_MAPPING.ENGINEER]);

    const vatRate = this.formatVat(rawVat?.toString() || "");
    const engineerName = rawEngineer?.toString().trim() || "Unassigned";

    // 8. Auto Category
    const rawCategory = this.findValue(row, ["Category"]);
    let category = "";

    if (rawCategory) {
      category = rawCategory.toString();
    } else if (itemCode) {
      // Only categorize if it's a line item (has item code)
      category = this.autoCategorize(itemCode);
    }
    // Header rows (no item code) will have empty category

    // 9. Use fill down data for line items (rows without PO number)
    const finalPoNumber = poNumber || this.lastHeaderData.poNumber;
    const finalDate = isHeaderRow ? cleanedDate : this.lastHeaderData.date;
    const finalSupplierName =
      supplier || this.lastHeaderData.supplier || "Unknown";

    return {
      date: finalDate,
      poNumber: finalPoNumber,
      supplier: finalSupplierName,
      description,
      description2,
      itemCode,
      quantity,
      unit: finalUnit,
      projectCode: projectCode || "N/A",
      unitPrice,
      totalPrice,
      netAmount,
      amount,
      totalVat,
      vatRate,
      engineerName,
      category,
      sourceSheet: row.Source_Sheet?.toString() || "Web Upload",
    };
  },

  /**
   * Helper to find value across multiple possible headers
   */
  findValue(
    row: RawDataRow,
    possibleHeaders: string[],
  ): string | number | null | undefined {
    for (const header of possibleHeaders) {
      const key = Object.keys(row).find(
        (k) => k.toLowerCase() === header.toLowerCase(),
      );
      if (key && row[key] !== undefined && row[key] !== null) return row[key];
    }
    return null;
  },

  /**
   * Standardize date to ISO format (YYYY-MM-DD)
   */
  parseDate(dateValue: any): string {
    if (!dateValue) return format(new Date(), "yyyy-MM-dd");

    // Handle Excel numeric date
    if (typeof dateValue === "number") {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(
        excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000,
      );
      return format(date, "yyyy-MM-dd");
    }

    const dateStr = dateValue.toString().trim();

    // Try multiple formats
    const formats = [
      "dd/MM/yyyy",
      "MM/dd/yyyy",
      "yyyy-MM-dd",
      "dd-MM-yyyy",
      "yyyy/MM/dd",
    ];
    for (const f of formats) {
      try {
        const parsed = parse(dateStr, f, new Date());
        if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
      } catch (e) {}
    }

    // Native Date fallback
    const nativeParsed = new Date(dateStr);
    if (isValid(nativeParsed)) return format(nativeParsed, "yyyy-MM-dd");

    return format(new Date(), "yyyy-MM-dd");
  },

  /**
   * Standardize number parsing
   */
  parseNumber(value: any): number | string {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number") return value;

    const cleanStr = value.toString().replace(/[^0-9.-]/g, "");
    if (cleanStr === "") return "";

    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? "" : parsed;
  },

  /**
   * Split fields like "Supplier Name - Item Description"
   */
  splitCombinedField(value: string): {
    supplier: string;
    description: string;
  } {
    const parts = value.split(/[-–—]/);
    if (parts.length < 2) return { supplier: value, description: "" };
    return {
      supplier: parts[0]?.trim() || "",
      description: parts.slice(1).join("-")?.trim() || "",
    };
  },

  /**
   * Split fields like "Unit - Project Code"
   */
  splitProjectUnit(value: string): { unit: string; projectCode: string } {
    const parts = value.split(/[-–—]/);
    if (parts.length < 2) return { unit: value, projectCode: "" };
    return {
      unit: parts[0]?.trim() || "",
      projectCode: parts[1]?.trim() || "",
    };
  },

  /**
   * Ensure VAT matches format "X%"
   */
  formatVat(value: string): string {
    const clean = value.replace(/[^0-9]/g, "");
    if (!clean) return "";
    return `${clean}%`;
  },

  /**
   * Intelligent categorization based on item code
   */
  autoCategorize(itemCode: string): string {
    const item = itemCode?.toString().toUpperCase().trim() || "";

    // If Item Code is Unknown or empty, categorize as Other
    if (!item || item === "UNKNOWN") {
      return "Other";
    } else if (/P-PHONE|P-IPAD|SVOTHER|SV150|ADVANCE|PREPAY|GL/.test(item)) {
      return "Other";
    } else if (
      /^P-SOFTWARE|^SVSUB-GL|SVSUB|SERVICE|SOFTWARE|MA|INSTALL|REPAIR/.test(
        item,
      )
    ) {
      return "Service";
    } else if (/^RMADPT/.test(item)) {
      return "Material";
    } else {
      return "Material";
    }
  },
};
