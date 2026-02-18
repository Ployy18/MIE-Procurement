import { DataCleaningService, RawDataRow } from "./dataCleaning";

const sampleData: RawDataRow[] = [
    {
        "DATE": "18/02/2026",
        "PO": "PO-2026-001",
        "Supplier": "Google Thailand - Cloud Services",
        "Project": "Unit A - P67035",
        "Amount": "1,500.50",
        "Qty": "2",
        "Engineer": "Somchai"
    },
    {
        "DATE": "2026-02-19",
        "PO": "PO-2026-002",
        "Supplier": "Office Mate - Stationary",
        "Project": "Unit B - P67036",
        "Amount": "500",
        "Qty": "1",
        "Engineer": "Wichai"
    },
    {
        "DATE": "bad-date",
        "PO": "", // Should be filtered out
        "Supplier": "Test",
        "Amount": "0"
    }
];

console.log("Starting verification of DataCleaningService...");

const cleaned = DataCleaningService.cleanData(sampleData);

console.log(`Input rows: ${sampleData.length}`);
console.log(`Cleaned rows: ${cleaned.length}`);

if (cleaned.length !== 2) {
    console.error("FAIL: Expected 2 valid rows, got " + cleaned.length);
    process.exit(1);
}

const row1 = cleaned[0];
console.log("Checking Row 1...");
if (row1.date !== "2026-02-18") console.error(`FAIL: Date mismatch. Expected 2026-02-18, got ${row1.date}`);
if (row1.poNumber !== "PO-2026-001") console.error(`FAIL: PO mismatch. Expected PO-2026-001, got ${row1.poNumber}`);
if (row1.supplierName !== "Google Thailand") console.error(`FAIL: Supplier mismatch. Expected Google Thailand, got ${row1.supplierName}`);
if (row1.itemDescription !== "Cloud Services") console.error(`FAIL: Item mismatch. Expected Cloud Services, got ${row1.itemDescription}`);
if (row1.projectCode !== "P67035") console.error(`FAIL: Project Code mismatch. Expected P67035, got ${row1.projectCode}`);
if (row1.unitPrice !== 1500.50) console.error(`FAIL: Price mismatch. Expected 1500.50, got ${row1.unitPrice}`);
if (row1.totalPrice !== 3001.00) console.error(`FAIL: Total Price mismatch. Expected 3001.00, got ${row1.totalPrice}`);

console.log("Verification completed successfully!");
