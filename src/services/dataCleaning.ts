import { format, parse, isValid } from "date-fns";
import Papa from "papaparse";

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

/**
 * Service for cleaning and standardizing procurement data
 */
export const DataCleaningService = {
    /**
     * Main cleaning pipeline
     */
    cleanData(rawData: RawDataRow[]): CleanedDataRow[] {
        return rawData
            .filter(row => this.isValidRow(row))
            .map(row => this.processRow(row));
    },

    /**
     * Check if a row is valid (must have a PO number)
     */
    isValidRow(row: RawDataRow): boolean {
        const poValue = this.findValue(row, ["PO", "PO_Number", "เลขที่ PO"]);
        return !!(poValue && poValue.toString().trim() !== "");
    },

    /**
     * Process and standardize a single row
     */
    processRow(row: RawDataRow): CleanedDataRow {
        // 1. Extract Date
        const rawDate = this.findValue(row, ["DATE", "Date", "วันที่"]);
        const cleanedDate = this.parseDate(rawDate);

        // 2. Extract PO Number
        const poNumber = (this.findValue(row, ["PO", "PO_Number", "เลขที่ PO"]) || "").toString().trim();

        // 3. Extract Supplier and Item (often merged in some formats)
        const rawSupplier = this.findValue(row, ["Supplier", "ผู้ขาย", "ชื่อผู้ขาย"]);
        const rawDescription = this.findValue(row, ["Description", "รายละเอียด", "รายการ"]);

        let { supplierName, itemDescription } = this.splitCombinedField(rawSupplier?.toString() || "");
        if (!itemDescription) {
            itemDescription = rawDescription?.toString() || "";
        }

        // 4. Extract Project Code
        const rawProject = this.findValue(row, ["Project", "Project Code", "โครงการ"]);
        let { unit, projectCode } = this.splitProjectUnit(rawProject?.toString() || "");

        // 5. Extract Quantity and Price
        const rawQty = this.findValue(row, ["Qty", "Quantity", "จำนวน"]);
        const rawPrice = this.findValue(row, ["Price", "Amount", "ราคา", "จำนวนเงิน"]);

        const quantity = this.parseNumber(rawQty) || 1;
        const unitPrice = this.parseNumber(rawPrice);
        const totalPrice = quantity * unitPrice;

        // 6. Extract VAT and Engineer
        const rawVat = this.findValue(row, ["VAT", "ภาษี"]);
        const rawEngineer = this.findValue(row, ["Engineer", "ผู้อนุมัติ", "วิศวกร"]);

        const vatRate = this.formatVat(rawVat?.toString() || "");
        const engineerName = rawEngineer?.toString().trim() || "Unassigned";

        // 7. Auto Category
        const category = this.autoCategorize(itemDescription);

        return {
            date: cleanedDate,
            poNumber,
            supplierName: supplierName || "Unknown",
            itemDescription,
            quantity,
            unit: unit || "Unit",
            projectCode: projectCode || "N/A",
            unitPrice,
            totalPrice,
            vatRate,
            engineerName,
            category,
            sourceSheet: row.Source_Sheet?.toString() || "Web Upload"
        };
    },

    /**
     * Helper to find value across multiple possible headers
     */
    findValue(row: RawDataRow, possibleHeaders: string[]): string | number | null | undefined {
        for (const header of possibleHeaders) {
            const key = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase());
            if (key && row[key] !== undefined && row[key] !== null) return row[key];
        }
        return null;
    },

    /**
     * Standardize date to ISO format (YYYY-MM-DD)
     */
    parseDate(dateValue: any): string {
        if (!dateValue) return format(new Date(), "yyyy-MM-dd");

        const dateStr = dateValue.toString().trim();

        // Try multiple formats
        const formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MM-yyyy"];
        for (const f of formats) {
            const parsed = parse(dateStr, f, new Date());
            if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
        }

        return format(new Date(), "yyyy-MM-dd");
    },

    /**
     * Standardize number parsing
     */
    parseNumber(value: any): number {
        if (!value) return 0;
        const cleanStr = value.toString().replace(/[^0-9.-]/g, "");
        return parseFloat(cleanStr) || 0;
    },

    /**
     * Split fields like "Supplier Name - Item Description"
     */
    splitCombinedField(value: string): { supplierName: string; itemDescription: string } {
        const parts = value.split(/[-–—]/);
        return {
            supplierName: parts[0]?.trim() || "",
            itemDescription: parts.slice(1).join("-")?.trim() || ""
        };
    },

    /**
     * Split fields like "Unit - Project Code"
     */
    splitProjectUnit(value: string): { unit: string; projectCode: string } {
        const parts = value.split(/[-–—]/);
        return {
            unit: parts[0]?.trim() || "",
            projectCode: parts[1]?.trim() || ""
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
        if (desc.includes("คอม") || desc.includes("computer") || desc.includes("laptop")) return "IT Equipment";
        if (desc.includes("โต๊ะ") || desc.includes("เก้าอี้") || desc.includes("furniture")) return "Furniture";
        if (desc.includes("ค่าแรง") || desc.includes("labor") || desc.includes("service")) return "Services";
        if (desc.includes("เหล็ก") || desc.includes("ปูน") || desc.includes("material")) return "Construction";
        return "Office Supplies";
    }
};
