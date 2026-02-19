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
}

export interface MultiTableData {
  procurement_data: CleanedDataRow[];
  suppliers_master: { name: string; last_seen: string }[];
  categories_master: { name: string; description: string }[];
  upload_logs: {
    timestamp: string;
    filename: string;
    row_count: number;
    status: string;
  }[];
}

/**
 * Service for cleaning and standardizing procurement data
 */
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
    // 1. Procurement Data (Already cleaned)
    const procurement_data = cleanedData;

    // 2. Suppliers Master (Unique suppliers)
    const uniqueSuppliers = [
      ...new Set(cleanedData.map((row) => row.supplierName)),
    ];
    const suppliers_master = uniqueSuppliers.map((name) => ({
      name,
      last_seen: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    }));

    // 3. Categories Master (Unique categories)
    const uniqueCategories = [
      ...new Set(cleanedData.map((row) => row.category)),
    ];
    const categories_master = uniqueCategories.map((name) => ({
      name,
      description: `Auto-generated category for ${name}`,
    }));

    // 4. Upload Logs
    const upload_logs = [
      {
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        filename: filename,
        row_count: cleanedData.length,
        status: "Success",
      },
    ];

    return {
      procurement_data,
      suppliers_master,
      categories_master,
      upload_logs,
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
    const rawDate = this.findValue(row, [
      "DATE",
      "Date",
      "วันที่",
      "PO Date",
      "__EMPTY_2",
    ]); // __EMPTY_2 for Excel merged headers
    const cleanedDate = this.parseDate(rawDate);

    // 2. Extract PO Number
    const poNumber = (
      this.findValue(row, [
        "PO",
        "PO_Number",
        "เลขที่ PO",
        "PO.NO.",
        "PO NO",
        "__EMPTY_1", // For Excel files with merged headers
      ]) || ""
    )
      .toString()
      .trim();

    // 3. Extract Supplier and Item (often merged in some formats)
    const rawSupplier = this.findValue(row, [
      "Supplier",
      "ผู้ขาย",
      "ชื่อผู้ขาย",
      "Supplier Name",
      "Vendor",
    ]);
    const rawDescription = this.findValue(row, [
      "Description",
      "รายละเอียด",
      "รายการ",
      "Item Description",
      "Item_Description",
      "__EMPTY_3", // For Excel merged headers
      "__EMPTY_4", // Alternative location
    ]);

    let { supplierName, itemDescription } = this.splitCombinedField(
      rawSupplier?.toString() || "",
    );
    if (!itemDescription) {
      itemDescription = rawDescription?.toString() || "";
    }

    // 4. Extract Project Code
    const rawProject = this.findValue(row, [
      "Project",
      "Project Code",
      "โครงการ",
      "Project_Code",
      "ProjectNo",
    ]);
    let { unit, projectCode } = this.splitProjectUnit(
      rawProject?.toString() || "",
    );

    // 5. Extract Quantity and Price
    const rawQty = this.findValue(row, [
      "Qty",
      "Quantity",
      "จำนวน",
      "__EMPTY_5",
    ]);
    const rawPrice = this.findValue(row, [
      "Price",
      "Amount",
      "ราคา",
      "จำนวนเงิน",
      "Unit_Price",
      "Total Amount",
      "TotalValue",
      "__EMPTY_6", // For Excel merged headers
      "__EMPTY_8", // Alternative location
    ]);

    const quantity = this.parseNumber(rawQty) || 1;
    const unitPrice = this.parseNumber(rawPrice);
    const totalPrice = quantity * unitPrice;

    // 6. Extract VAT and Engineer
    const rawVat = this.findValue(row, ["VAT", "ภาษี", "VAT_Rate"]);
    const rawEngineer = this.findValue(row, [
      "Engineer",
      "ผู้อนุมัติ",
      "วิศวกร",
      "Engineer_Name",
    ]);

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
