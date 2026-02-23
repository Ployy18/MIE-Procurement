import { format, parse, isValid } from "date-fns";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface RawDataRow {
  [key: string]: string | number | null | undefined;
}

export interface CleanedDataRow {
  date: string;
  poNumber: string;
  supplierName: string;
  itemDescription: string;
  quantity: number;
  unit: string;
  projectCode: string;
  unitPrice: number;
  totalPrice: number;
  vatRate: string;
  engineerName: string;
  category: string;
  sourceSheet?: string;
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
  DATE: "__EMPTY_2",        // Column C (3rd column)
  PO_NUMBER: "__EMPTY_1",    // Column B (2nd column) 
  SUPPLIER: "__EMPTY_3",      // Column E (5th column)
  DESCRIPTION: "__EMPTY_5",   // Column G (7th column)
  QUANTITY: "__EMPTY_7",      // Column H (8th column)
  AMOUNT: "__EMPTY_9",       // Column J (10th column)
  PROJECT: "__EMPTY_6",       // Column G (7th column) - using Description data
  VAT: "__EMPTY_10",         // Column K (11th column)
  ENGINEER: "__EMPTY_11",     // Column L (12th column)
};

export const DataCleaningService = {
  /**
   * Main cleaning pipeline
   */
  cleanData(rawData: RawDataRow[]): CleanedDataRow[] {
    console.log("🧹 [DataCleaningService] Starting data cleaning pipeline...");
    console.log("📊 [DataCleaningService] Input data:", {
      totalRows: rawData.length,
      sampleRow: rawData[0],
    });

    const validRows = rawData.filter((row) => this.isValidRow(row));
    console.log("✅ [DataCleaningService] Valid rows after filtering:", {
      validRows: validRows.length,
      filteredRows: rawData.length - validRows.length,
    });

    const processedRows = validRows.map((row) => this.processRow(row));
    console.log(
      "🔄 [DataCleaningService] Processing completed. Final result:",
      {
        processedRows: processedRows.length,
        sampleProcessedRow: processedRows[0],
      },
    );

    return processedRows;
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
    console.log("📊 [DataCleaningService] Processing data into Head/Line tables...");
    
    // Group data by source sheet first
    const dataBySheet = cleanedData.reduce((acc, row) => {
      const sheetName = row.sourceSheet || 'Unknown';
      if (!acc[sheetName]) acc[sheetName] = [];
      acc[sheetName].push(row);
      return acc;
    }, {} as { [sheetName: string]: CleanedDataRow[] });
    
    // Separate Head and Line data based on PO number presence
    const headData: CleanedDataRow[] = [];
    const lineData: CleanedDataRow[] = [];
    
    // Track PO numbers to identify heads vs lines
    const poNumbers = new Set<string>();
    const processedPOs = new Set<string>();
    
    // First pass: collect all unique PO numbers
    cleanedData.forEach(row => {
      if (row.poNumber && row.poNumber.trim()) {
        poNumbers.add(row.poNumber.trim());
      }
    });
    
    console.log(`📋 [DataCleaningService] Found ${poNumbers.size} unique PO numbers`);
    
    // Second pass: separate heads and lines
    cleanedData.forEach(row => {
      const poNum = row.poNumber?.trim();
      
      if (!poNum) {
        // Row without PO number - treat as line item
        lineData.push({
          ...row,
          _isHead: false,
          _isLine: true,
          _sourceSheet: row.sourceSheet || 'Unknown'
        });
      } else if (!processedPOs.has(poNum)) {
        // First occurrence of this PO number - treat as head
        processedPOs.add(poNum);
        headData.push({
          ...row,
          _isHead: true,
          _isLine: false,
          _sourceSheet: row.sourceSheet || 'Unknown'
        });
      } else {
        // Subsequent occurrence of same PO number - treat as line item
        lineData.push({
          ...row,
          _isHead: false,
          _isLine: true,
          _sourceSheet: row.sourceSheet || 'Unknown'
        });
      }
    });
    
    console.log(`📊 [DataCleaningService] Separated data:`, {
      totalRows: cleanedData.length,
      headRows: headData.length,
      lineRows: lineData.length,
      uniquePOs: poNumbers.size
    });

    // 1. Combined procurement data (for backward compatibility)
    const procurement_data = cleanedData;

    // 2. Head table (PO headers)
    const procurement_head = headData.map(row => ({
      ...row,
      itemDescription: "HEADER", // Mark as header
      quantity: 0,
      unit: "HEADER",
      unitPrice: 0,
      totalPrice: 0,
      category: "HEADER"
    }));
    
    // 3. Line table (PO line items)
    const procurement_line = lineData;

    // 4. Suppliers Master (Unique suppliers from line data)
    const uniqueSuppliers = [
      ...new Set(lineData.map((row) => row.supplierName)),
    ];
    const suppliers_master = uniqueSuppliers.map((name) => ({
      name,
      last_seen: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    }));

    // 5. Categories Master (Unique categories from line data)
    const uniqueCategories = [
      ...new Set(lineData.map((row) => row.category)),
    ];
    const categories_master = uniqueCategories.map((name) => ({
      name,
      description: `Auto-generated category for ${name}`,
    }));

    // 6. Upload Logs
    const upload_logs = [
      {
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        filename: filename,
        row_count: cleanedData.length,
        status: "Success",
        sheets_processed: Object.keys(dataBySheet).length,
        sheet_details: Object.entries(dataBySheet).map(([sheet, data]) => ({
          sheet,
          rows: data.length
        }))
      },
    ];

    return {
      procurement_data,
      procurement_head,
      procurement_line,
      suppliers_master,
      categories_master,
      upload_logs,
      dataBySheet
    };
  },

  /**
   * Check if a row is valid (must have a PO number and not be cancelled)
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

    console.log("🎯 [DataCleaningService] PO value found:", poValue);

    if (!poValue || poValue.toString().trim() === "") {
      console.log("❌ [DataCleaningService] Invalid row: No PO number found");
      return false;
    }

    // Check for "cancelled" keywords in the PO number itself
    const poStr = poValue.toString().toLowerCase();
    if (poStr.includes("ยกเลิก") || poStr.includes("cancelled")) {
      console.log("❌ [DataCleaningService] Invalid row: PO cancelled");
      return false;
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
   * Process and standardize a single row
   */
  processRow(row: RawDataRow): CleanedDataRow {
    // 1. Extract Date
    const rawDate = this.findValue(row, [COLUMN_MAPPING.DATE]);
    const cleanedDate = this.parseDate(rawDate);

    // 2. Extract PO Number
    const poNumber = (
      this.findValue(row, [COLUMN_MAPPING.PO_NUMBER]) || ""
    )
      .toString()
      .trim();

    // 3. Extract Supplier and Item
    const rawSupplier = this.findValue(row, [COLUMN_MAPPING.SUPPLIER]);
    const rawDescription = this.findValue(row, [COLUMN_MAPPING.DESCRIPTION]);

    let { supplierName, itemDescription } = this.splitCombinedField(
      rawSupplier?.toString() || "",
    );
    if (!itemDescription) {
      itemDescription = rawDescription?.toString() || "";
    }

    // 4. Extract Project Code
    const rawProject = this.findValue(row, [COLUMN_MAPPING.PROJECT]);
    let { unit, projectCode } = this.splitProjectUnit(
      rawProject?.toString() || "",
    );

    // 5. Extract Quantity and Price
    const rawQty = this.findValue(row, [COLUMN_MAPPING.QUANTITY]);
    const rawPrice = this.findValue(row, [COLUMN_MAPPING.AMOUNT]);

    const quantity = this.parseNumber(rawQty) || 1;
    const unitPrice = this.parseNumber(rawPrice);
    const totalPrice = quantity * unitPrice;

    // 6. Extract VAT and Engineer
    const rawVat = this.findValue(row, [COLUMN_MAPPING.VAT]);
    const rawEngineer = this.findValue(row, [COLUMN_MAPPING.ENGINEER]);

    const vatRate = this.formatVat(rawVat?.toString() || "");
    const engineerName = rawEngineer?.toString().trim() || "Unassigned";

    // 7. Auto Category
    const rawCategory = this.findValue(row, ["Category"]);
    const category = rawCategory
      ? rawCategory.toString()
      : this.autoCategorize(itemDescription);

    return {
      date: cleanedDate,
      poNumber,
      supplierName: supplierName || rawSupplier?.toString() || "Unknown",
      itemDescription,
      quantity,
      unit: unit || "Unit",
      projectCode: projectCode || rawProject?.toString() || "N/A",
      unitPrice,
      totalPrice,
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
        excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000,
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
  parseNumber(value: any): number {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const cleanStr = value.toString().replace(/[^0-9.-]/g, "");
    return parseFloat(cleanStr) || 0;
  },

  /**
   * Split fields like "Supplier Name - Item Description"
   */
  splitCombinedField(value: string): {
    supplierName: string;
    itemDescription: string;
  } {
    const parts = value.split(/[-–—]/);
    if (parts.length < 2) return { supplierName: value, itemDescription: "" };
    return {
      supplierName: parts[0]?.trim() || "",
      itemDescription: parts.slice(1).join("-")?.trim() || "",
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
    if (!clean) return "7%";
    return `${clean}%`;
  },

  /**
   * Intelligent categorization
   */
  autoCategorize(description: string): string {
    const desc = description.toLowerCase();
    if (
      desc.includes("คอม") ||
      desc.includes("computer") ||
      desc.includes("laptop")
    )
      return "IT Equipment";
    if (
      desc.includes("โต๊ะ") ||
      desc.includes("เก้าอี้") ||
      desc.includes("furniture")
    )
      return "Furniture";
    if (
      desc.includes("ค่าแรง") ||
      desc.includes("labor") ||
      desc.includes("service")
    )
      return "Services";
    if (
      desc.includes("เหล็ก") ||
      desc.includes("ปูน") ||
      desc.includes("material")
    )
      return "Construction";
    return "Office Supplies";
  },
};
