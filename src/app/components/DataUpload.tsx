import React, { useState, useCallback } from "react";

import { useDropzone } from "react-dropzone";

import Papa from "papaparse";

import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Trash2,
  Table as TableIcon,
  FileSpreadsheet,
  ReceiptText,
  List,
  Users,
  Folder,
  Database,
  Zap,
  X,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

import {
  DataCleaningService,
  CleanedDataRow,
  MultiTableData,
} from "../../services/dataCleaning";

import { uploadMultiTableData } from "../../services/googleSheetsService";

import { ChartContainer } from "./ChartContainer";
import { LoadingState } from "./ui/LoadingState";

import { Button } from "./ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useNavigate } from "react-router-dom";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

import { toast } from "sonner";

// Shared column width mapping for consistency across components
const columnWidthMap: Record<string, string> = {
  date: "w-[120px]",
  "po number": "w-[130px]",
  supplier: "w-[250px]",
  description: "w-[350px]",
  "item code": "w-[140px]",
  category: "w-[120px]",
  quantity: "w-[100px]",
  unit: "w-[90px]",
  "unit price": "w-[130px]",
  "net amount": "w-[130px]",
  vat: "w-[130px]",
  "total amount": "w-[130px]",
  "total price": "w-[130px]",
  project: "w-[120px]",
  "project code": "w-[120px]",
  "source file": "w-[220px]",
  "total records": "w-[140px]",
};

// Helper function to get category styling
const getCategoryStyle = (category: string) => {
  const normalizedCategory = category?.toLowerCase().trim();

  switch (normalizedCategory) {
    case "material":
      return "bg-blue-100 text-blue-700";
    case "service":
      return "bg-green-100 text-green-700";
    case "other":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// Helper function to format numbers with commas
const formatNumberWithCommas = (value: any) => {
  if (value === null || value === undefined || value === "") return "";
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: value.toString().includes(".") ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

interface DataUploadProps {
  onChangeView: (view: string) => void;
}

export function DataUpload({ onChangeView }: DataUploadProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const [rawData, setRawData] = useState<any[]>([]);

  const [cleanedData, setCleanedData] = useState<CleanedDataRow[]>([]);

  const [multiTableData, setMultiTableData] = useState<MultiTableData | null>(
    null,
  );

  const [step, setStep] = useState<"upload" | "preview" | "success">("upload");

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editHistory, setEditHistory] = useState<CleanedDataRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Pagination states
  const [allDataPage, setAllDataPage] = useState(1);
  const [headDataPage, setHeadDataPage] = useState(1);
  const [lineDataPage, setLineDataPage] = useState(1);
  const pageSize = 50;
  const formatNumber = (value?: number | string) => {
    if (value === undefined || value === null || value === "") return "";

    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "";

    return numValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const formatInteger = (value?: number | string) => {
    if (value === undefined || value === null || value === "") return "";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "";
    return Math.round(numValue).toLocaleString();
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log(" [DataUpload] Files dropped:", acceptedFiles);

    const selectedFile = acceptedFiles[0];

    if (
      selectedFile &&
      (selectedFile.type === "text/csv" ||
        selectedFile.name.endsWith(".csv") ||
        selectedFile.name.endsWith(".xlsx") ||
        selectedFile.name.endsWith(".xls"))
    ) {
      console.log(" [DataUpload] Valid file detected:", {
        name: selectedFile.name,

        size: selectedFile.size,

        type: selectedFile.type,

        lastModified: new Date(selectedFile.lastModified),
      });

      setFile(selectedFile);

      handleFileProcess(selectedFile);
    } else {
      console.error(
        " [DataUpload] Invalid file type:",

        selectedFile?.name,

        selectedFile?.type,
      );

      toast.error("Please upload a valid CSV or Excel file");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,

    accept: {
      "text/csv": [".csv"],

      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],

      "application/vnd.ms-excel": [".xls"],
    },

    multiple: false,
  });

  const handleFileProcess = async (file: File) => {
    console.log("🔄 [DataUpload] Starting file processing for:", file.name);

    setIsProcessing(true);

    try {
      let data: any[] = [];

      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        console.log("📊 [DataUpload] Processing Excel file...");

        data = await DataCleaningService.parseExcel(file);

        console.log(
          "✅ [DataUpload] Excel parsing completed, rows:",

          data.length,
        );
      } else {
        console.log("📋 [DataUpload] Processing CSV file...");

        // PapaParse for CSV

        await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,

            skipEmptyLines: true,

            complete: (results) => {
              console.log("📋 [DataUpload] CSV parsing completed:", {
                totalRows: results.data.length,

                errors: results.errors,

                meta: results.meta,
              });

              data = results.data;

              resolve(data);
            },

            error: (error) => {
              console.error("❌ [DataUpload] CSV parsing error:", error);

              reject(error);
            },
          });
        });
      }

      console.log("🧹 [DataUpload] Starting data cleaning...");

      console.log("📊 [DataUpload] Raw data sample:", data.slice(0, 3));

      setRawData(data);

      const cleaned = DataCleaningService.cleanData(data);

      console.log("✨ [DataUpload] Data cleaning completed:", {
        originalRows: data.length,

        cleanedRows: cleaned.length,

        filteredRows: data.length - cleaned.length,
      });

      console.log("📋 [DataUpload] Cleaned data sample:", cleaned.slice(0, 2));

      setCleanedData(cleaned);

      // Process into Head/Line tables

      const multiTable = DataCleaningService.processMultiTableData(
        cleaned,

        file.name,
      );

      setMultiTableData(multiTable);

      setIsProcessing(false);

      setStep("preview");

      toast.success(
        `Successfully processed ${cleaned.length} rows (${multiTable.procurement_head.length} heads, ${multiTable.procurement_line.length} lines)`,
      );

      console.log("🎯 [DataUpload] Processing completed successfully!");
    } catch (error) {
      console.error("💥 [DataUpload] File Processing Error:", error);

      setIsProcessing(false);

      toast.error("Failed to process file");
    }
  };

  const handleReset = () => {
    setFile(null);
    setRawData([]);
    setCleanedData([]);
    setMultiTableData(null);
    setStep("upload");
    setIsEditMode(false);
    setEditHistory([]);
    setHistoryIndex(-1);
    setHasUnsavedChanges(false);
    setSelectedRows(new Set());
    // Reset pagination
    setAllDataPage(1);
    setHeadDataPage(1);
    setLineDataPage(1);
  };

  // Edit mode functions
  const handleEditData = () => {
    if (!isEditMode) {
      // Enter edit mode
      setIsEditMode(true);
      setEditHistory([JSON.parse(JSON.stringify(cleanedData))]);
      setHistoryIndex(0);
      setHasUnsavedChanges(false);
    } else {
      // Exit edit mode
      if (hasUnsavedChanges) {
        if (
          confirm(
            "คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากโหมดแก้ไขหรือไม่?",
          )
        ) {
          setIsEditMode(false);
          setHasUnsavedChanges(false);
          setSelectedRows(new Set());
        }
      } else {
        setIsEditMode(false);
        setSelectedRows(new Set());
      }
    }
  };

  const handleCellEdit = (
    rowIndex: number,
    field: keyof CleanedDataRow,
    newValue: string,
  ) => {
    const newData = cleanedData.map((row, index) =>
      index === rowIndex ? { ...row, [field]: newValue } : row,
    );
    setCleanedData(newData);

    // Update multiTableData
    if (multiTableData) {
      const updatedMultiTableData = {
        ...multiTableData,
        procurement_data: newData,
        procurement_head: newData.filter((row) => row._isHead),
        procurement_line: newData.filter((row) => row._isLine),
      };
      setMultiTableData(updatedMultiTableData);
    }

    // Add to history
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData)));
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedChanges(true);
  };

  const handleDeleteRows = () => {
    if (selectedRows.size === 0) {
      alert("กรุณาเลือกแถวที่ต้องการลบ");
      return;
    }

    if (confirm(`คุณต้องการลบ ${selectedRows.size} แถวนี้หรือไม่?`)) {
      const newData = cleanedData.filter(
        (_, index) => !selectedRows.has(index),
      );
      setCleanedData(newData);

      // Update multiTableData
      if (multiTableData) {
        const updatedMultiTableData = {
          ...multiTableData,
          procurement_data: newData,
          procurement_head: newData.filter((row) => row._isHead),
          procurement_line: newData.filter((row) => row._isLine),
        };
        setMultiTableData(updatedMultiTableData);
      }

      // Add to history
      const newHistory = editHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setHasUnsavedChanges(true);
      setSelectedRows(new Set());
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const previousData = JSON.parse(
        JSON.stringify(editHistory[historyIndex - 1]),
      );
      setCleanedData(previousData);

      // Update multiTableData
      if (multiTableData) {
        const updatedMultiTableData = {
          ...multiTableData,
          procurement_data: previousData,
          procurement_head: previousData.filter((row: any) => row._isHead),
          procurement_line: previousData.filter((row: any) => row._isLine),
        };
        setMultiTableData(updatedMultiTableData);
      }

      setHasUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < editHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const nextData = JSON.parse(
        JSON.stringify(editHistory[historyIndex + 1]),
      );
      setCleanedData(nextData);

      // Update multiTableData
      if (multiTableData) {
        const updatedMultiTableData = {
          ...multiTableData,
          procurement_data: nextData,
          procurement_head: nextData.filter((row: any) => row._isHead),
          procurement_line: nextData.filter((row: any) => row._isLine),
        };
        setMultiTableData(updatedMultiTableData);
      }

      setHasUnsavedChanges(true);
    }
  };

  const handleSave = async () => {
    try {
      console.log("💾 [DataUpload] Saving edited data to Google Sheets...");

      // Upload edited data to Google Sheets
      if (multiTableData) {
        const result = await uploadMultiTableData(
          multiTableData.procurement_data,
          file?.name || "edited_data",
          multiTableData,
        );

        console.log("📨 [DataUpload] Save response:", result);

        if (result.success) {
          toast.success("บันทึกข้อมูลสำเร็จ!");
          setHasUnsavedChanges(false);
          setIsEditMode(false);
          setSelectedRows(new Set());

          // Refresh data from Google Sheets
          // Here you might want to re-fetch the data to ensure consistency
        } else {
          console.error("❌ [DataUpload] Save failed:", result);
          toast.error("การบันทึกล้มเหลว");
        }
      }
    } catch (error) {
      console.error("❌ [DataUpload] Save error:", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const toggleRowSelection = (rowIndex: number) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex);
    } else {
      newSelection.add(rowIndex);
    }
    setSelectedRows(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === cleanedData.length) {
      setSelectedRows(new Set());
    } else {
      const indices = cleanedData.map((_, index) => index);
      setSelectedRows(new Set(indices));
    }
  };

  const handleCommit = async () => {
    console.log("💾 [DataUpload] Starting data commit process...");

    if (!file || cleanedData.length === 0 || !multiTableData) {
      console.error(
        "❌ [DataUpload] Cannot commit - missing file, no cleaned data, or no multiTableData:",
        {
          hasFile: !!file,
          cleanedDataLength: cleanedData.length,
          hasMultiTableData: !!multiTableData,
        },
      );

      return;
    }

    console.log("📤 [DataUpload] Preparing to upload:", {
      fileName: file.name,

      dataRows: cleanedData.length,

      dataSample: cleanedData.slice(0, 2),
    });

    setIsProcessing(true);

    try {
      // Upload to Google Sheets via Node.js Backend
      // Send both raw data and processed tables
      const result = await uploadMultiTableData(
        multiTableData.procurement_data,
        file.name,
        multiTableData,
      );

      console.log("📨 [DataUpload] Backend response:", result);

      if (result.success) {
        console.log("✅ [DataUpload] Data saved successfully!");

        setStep("success");

        toast.success(
          result.message ||
            "Data successfully saved to multiple tables in Google Sheets",
        );

        // Trigger refresh in DataSource component
        window.dispatchEvent(
          new CustomEvent("dataUploaded", {
            detail: { success: true, message: result.message },
          }),
        );
      } else {
        console.error("❌ [DataUpload] Backend returned error:", result);

        toast.error(
          result.message ||
            "Failed to save data. Please check your backend connection.",
        );
      }
    } catch (error) {
      console.error("💥 [DataUpload] Commit error:", error);

      toast.error("An error occurred while saving data");
    } finally {
      setIsProcessing(false);

      console.log("🏁 [DataUpload] Commit process finished");
    }
  };

  return (
    // <div className="space-y-6 max-w-6xl mx-auto">
    <div className="space-y-10 w-full px-8">
      <ChartContainer
        title="Data Import & Cleaning"
        subtitle="Upload procurement data for automated processing and centralization"
      >
        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="py-12"
            >
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer

                  ${isDragActive ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-blue-400 hover:bg-gray-50"}

                `}
              >
                <input {...getInputProps()} />

                <div
                  className="w-20 h-20 
                
                text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  {isProcessing ? (
                    <Loader2 className="w-10 h-10 animate-spin" />
                  ) : (
                    <Upload className="w-10 h-10" />
                  )}
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isDragActive
                    ? "Drop the file here"
                    : "Click or drag a CSV or Excel file to upload"}
                </h3>

                <p className="text-gray-500 max-w-xs mx-auto mb-8">
                  Supports CSV and Excel files with standard procurement headers
                </p>

                <Button size="lg" className="rounded-full px-8">
                  Select File
                </Button>
              </div>
            </motion.div>
          )}

          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between p-4 bg-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">
                      Data Loaded Successfully
                    </h3>

                    <p className="text-sm text-gray-500">
                      Found {cleanedData.length} valid rows from {file?.name}
                    </p>

                    <div className="flex gap-6 mt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-orange-600 font-semibold">
                          Head: {multiTableData?.procurement_head?.length || 0}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-600 font-semibold">
                          Line: {multiTableData?.procurement_line?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X size={20} />
                    Close
                  </Button>
                  <Button
                    onClick={handleCommit}
                    disabled={isProcessing}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Confirm & Save
                  </Button>
                </div>
              </div>

              <div className="border-b border-gray-200">
                {/* <Tabs defaultValue="all" className="w-full">
                  <TabsList className="flex gap-8 bg-transparent h-auto p-0 items-end"> */}
                <Tabs defaultValue="all" className="w-full">
                  <div className="border-b border-gray-200">
                    <TabsList className="flex gap-4 bg-transparent h-auto p-0 items-end">
                      <TabsTrigger
                        value="all"
                        className="relative pb-3 text-sm text-slate-700
                          hover:text-blue-600
                          data-[state=active]:text-blue-600
                          data-[state=active]:font-semibold
                          after:absolute
                          after:left-0
                          after:-bottom-[1px]
                          after:h-[2px]
                          after:w-0
                          after:bg-blue-600
                          data-[state=active]:after:w-full
                          transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          All Data ({cleanedData.length})
                        </div>
                      </TabsTrigger>

                      <TabsTrigger
                        value="head"
                        className="relative pb-3 text-sm text-slate-700
                          hover:text-orange-600
                          data-[state=active]:text-orange-600
                          data-[state=active]:font-semibold
                          after:absolute
                          after:left-0
                          after:-bottom-[1px]
                          after:h-[2px]
                          after:w-0
                          after:bg-orange-600
                          data-[state=active]:after:w-full
                          transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4" />
                          Head ({multiTableData?.procurement_head?.length || 0})
                        </div>
                      </TabsTrigger>

                      <TabsTrigger
                        value="line"
                        className="relative pb-3 text-sm text-slate-700
                          hover:text-green-600
                          data-[state=active]:text-green-600
                          data-[state=active]:font-semibold
                          after:absolute
                          after:left-0
                          after:-bottom-[1px]
                          after:h-[2px]
                          after:w-0
                          after:bg-green-600
                          data-[state=active]:after:w-full
                          transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <List className="w-4 h-4" />
                          Line ({multiTableData?.procurement_line?.length || 0})
                        </div>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="all" className="m-0">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto overflow-y-auto max-h-96">
                        <table className="w-full text-sm table-fixed">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["date"] || "w-[120px]"}`}
                              >
                                Date
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["po number"] || "w-[150px]"}`}
                              >
                                PO Number
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["supplier"] || "w-[220px]"}`}
                              >
                                Supplier
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["description"] || "w-[320px]"}`}
                              >
                                Description
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["item code"] || "w-[120px]"}`}
                              >
                                Item Code
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["category"] || "w-[120px]"}`}
                              >
                                Category
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["quantity"] || "w-[100px]"}`}
                              >
                                Quantity
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["unit"] || "w-[90px]"}`}
                              >
                                Unit
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["unit price"] || "w-[140px]"}`}
                              >
                                Unit Price
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["net amount"] || "w-[140px]"}`}
                              >
                                Net Amount
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["vat"] || "w-[120px]"}`}
                              >
                                VAT
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["total amount"] || "w-[140px]"}`}
                              >
                                Total Amount
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["project"] || "w-[120px]"}`}
                              >
                                Project
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(() => {
                              const start = (allDataPage - 1) * pageSize;
                              const end = start + pageSize;
                              const visibleRows = cleanedData.slice(start, end);
                              return visibleRows.map((row, idx) => {
                                const isHead = (row as any)._isHead;
                                const isLine = (row as any)._isLine;

                                return (
                                  <tr
                                    key={start + idx}
                                    className="hover:bg-gray-50"
                                  >
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={row.date}
                                    >
                                      {row.date}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={row.poNumber}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        {row.poNumber}
                                        {isHead && (
                                          <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded shadow-sm flex-shrink-0">
                                            HEAD
                                          </span>
                                        )}
                                        {isLine && (
                                          <span className="text-[9px] bg-green-600 text-white font-black px-1.5 py-0.5 rounded shadow-sm flex-shrink-0">
                                            LINE
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={row.supplier}
                                    >
                                      {row.supplier}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={row.description}
                                    >
                                      {row.description}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={row.itemCode}
                                    >
                                      {row.itemCode}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                      title={row.category}
                                    >
                                      {row.category ? (
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryStyle(row.category)}`}
                                        >
                                          {row.category}
                                        </span>
                                      ) : (
                                        ""
                                      )}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                      title={row.quantity?.toString()}
                                    >
                                      {formatNumberWithCommas(row.quantity)}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                      title={row.unit}
                                    >
                                      {row.unit}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={formatNumberWithCommas(
                                        row.unitPrice,
                                      )}
                                    >
                                      {formatNumberWithCommas(row.unitPrice)}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={formatNumberWithCommas(
                                        row.netAmount,
                                      )}
                                    >
                                      {formatNumberWithCommas(row.netAmount)}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={formatNumberWithCommas(
                                        row.totalVat,
                                      )}
                                    >
                                      {formatNumberWithCommas(row.totalVat)}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                      title={formatNumberWithCommas(
                                        row.totalPrice,
                                      )}
                                    >
                                      {formatNumberWithCommas(row.totalPrice)}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                      title={row.projectCode}
                                    >
                                      {row.projectCode}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination Controls */}
                      {cleanedData.length > pageSize && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                          <div className="text-sm text-gray-700">
                            Showing {(allDataPage - 1) * pageSize + 1}-
                            {Math.min(
                              allDataPage * pageSize,
                              cleanedData.length,
                            )}{" "}
                            of {cleanedData.length} rows
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() =>
                                setAllDataPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={allDataPage === 1}
                              variant="outline"
                              size="sm"
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-gray-600">
                              Page {allDataPage} of{" "}
                              {Math.ceil(cleanedData.length / pageSize)}
                            </span>
                            <Button
                              onClick={() =>
                                setAllDataPage((prev) =>
                                  Math.min(
                                    Math.ceil(cleanedData.length / pageSize),
                                    prev + 1,
                                  ),
                                )
                              }
                              disabled={
                                allDataPage >=
                                Math.ceil(cleanedData.length / pageSize)
                              }
                              variant="outline"
                              size="sm"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="head" className="m-0">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto overflow-y-auto max-h-96">
                        <table className="w-full text-sm table-fixed">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["date"] || "w-[120px]"}`}
                              >
                                Date
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["po number"] || "w-[150px]"}`}
                              >
                                PO Number
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["supplier"] || "w-[220px]"}`}
                              >
                                Supplier
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["description"] || "w-[320px]"}`}
                              >
                                Description
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["net amount"] || "w-[140px]"}`}
                              >
                                Net Amount
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["vat"] || "w-[120px]"}`}
                              >
                                VAT
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["total amount"] || "w-[140px]"}`}
                              >
                                Total Amount
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["project"] || "w-[120px]"}`}
                              >
                                Project
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(() => {
                              const headData =
                                multiTableData?.procurement_head || [];
                              const start = (headDataPage - 1) * pageSize;
                              const end = start + pageSize;
                              const visibleRows = headData.slice(start, end);
                              return visibleRows.map((row, idx) => (
                                <tr
                                  key={start + idx}
                                  className="hover:bg-gray-50"
                                >
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.date}
                                  >
                                    {row.date}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.poNumber}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      {row.poNumber}
                                    </div>
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.supplier}
                                  >
                                    {row.supplier}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.description}
                                  >
                                    {row.description}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={formatNumberWithCommas(
                                      row.netAmount,
                                    )}
                                  >
                                    {formatNumberWithCommas(row.netAmount)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={formatNumberWithCommas(row.totalVat)}
                                  >
                                    {formatNumberWithCommas(row.totalVat)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={formatNumberWithCommas(
                                      row.totalPrice,
                                    )}
                                  >
                                    {formatNumberWithCommas(row.totalPrice)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                    title={row.projectCode}
                                  >
                                    {row.projectCode}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination Controls */}
                      {(multiTableData?.procurement_head?.length || 0) >
                        pageSize && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                          <div className="text-sm text-gray-700">
                            Showing {(headDataPage - 1) * pageSize + 1}-
                            {Math.min(
                              headDataPage * pageSize,
                              multiTableData?.procurement_head?.length || 0,
                            )}{" "}
                            of {multiTableData?.procurement_head?.length || 0}{" "}
                            rows
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() =>
                                setHeadDataPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={headDataPage === 1}
                              variant="outline"
                              size="sm"
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-gray-600">
                              Page {headDataPage} of{" "}
                              {Math.ceil(
                                (multiTableData?.procurement_head?.length ||
                                  0) / pageSize,
                              )}
                            </span>
                            <Button
                              onClick={() =>
                                setHeadDataPage((prev) =>
                                  Math.min(
                                    Math.ceil(
                                      (multiTableData?.procurement_head
                                        ?.length || 0) / pageSize,
                                    ),
                                    prev + 1,
                                  ),
                                )
                              }
                              disabled={
                                headDataPage >=
                                Math.ceil(
                                  (multiTableData?.procurement_head?.length ||
                                    0) / pageSize,
                                )
                              }
                              variant="outline"
                              size="sm"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="line" className="m-0">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto overflow-y-auto max-h-96">
                        <table className="w-full text-sm table-fixed">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["date"] || "w-[120px]"}`}
                              >
                                Date
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["po number"] || "w-[150px]"}`}
                              >
                                PO Number
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["supplier"] || "w-[220px]"}`}
                              >
                                Supplier
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["description"] || "w-[320px]"}`}
                              >
                                Description
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["item code"] || "w-[120px]"}`}
                              >
                                Item Code
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["category"] || "w-[120px]"}`}
                              >
                                Category
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["quantity"] || "w-[100px]"}`}
                              >
                                Quantity
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["unit"] || "w-[90px]"}`}
                              >
                                Unit
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["unit price"] || "w-[140px]"}`}
                              >
                                Unit Price
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["total amount"] || "w-[140px]"}`}
                              >
                                Total Amount
                              </th>
                              <th
                                className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap text-center ${columnWidthMap["project"] || "w-[120px]"}`}
                              >
                                Project
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(() => {
                              const lineData =
                                multiTableData?.procurement_line || [];
                              const start = (lineDataPage - 1) * pageSize;
                              const end = start + pageSize;
                              const visibleRows = lineData.slice(start, end);
                              return visibleRows.map((row, idx) => (
                                <tr
                                  key={start + idx}
                                  className="hover:bg-gray-50"
                                >
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.date}
                                  >
                                    {row.date}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.poNumber}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      {row.poNumber}
                                    </div>
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.supplier}
                                  >
                                    {row.supplier}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.description}
                                  >
                                    {row.description}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={row.itemCode}
                                  >
                                    {row.itemCode}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                    title={row.category}
                                  >
                                    {row.category ? (
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryStyle(row.category)}`}
                                      >
                                        {row.category}
                                      </span>
                                    ) : (
                                      ""
                                    )}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                    title={row.quantity?.toString()}
                                  >
                                    {formatNumberWithCommas(row.quantity)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                    title={row.unit}
                                  >
                                    {row.unit}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={formatNumberWithCommas(
                                      row.unitPrice,
                                    )}
                                  >
                                    {formatNumberWithCommas(row.unitPrice)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis"
                                    title={formatNumberWithCommas(
                                      row.totalPrice,
                                    )}
                                  >
                                    {formatNumberWithCommas(row.totalPrice)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 truncate overflow-hidden whitespace-nowrap text-ellipsis text-center"
                                    title={row.projectCode}
                                  >
                                    {row.projectCode}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination Controls */}
                      {(multiTableData?.procurement_line?.length || 0) >
                        pageSize && (
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                          <div className="text-sm text-gray-700">
                            Showing {(lineDataPage - 1) * pageSize + 1}-
                            {Math.min(
                              lineDataPage * pageSize,
                              multiTableData?.procurement_line?.length || 0,
                            )}{" "}
                            of {multiTableData?.procurement_line?.length || 0}{" "}
                            rows
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() =>
                                setLineDataPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={lineDataPage === 1}
                              variant="outline"
                              size="sm"
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-gray-600">
                              Page {lineDataPage} of{" "}
                              {Math.ceil(
                                (multiTableData?.procurement_line?.length ||
                                  0) / pageSize,
                              )}
                            </span>
                            <Button
                              onClick={() =>
                                setLineDataPage((prev) =>
                                  Math.min(
                                    Math.ceil(
                                      (multiTableData?.procurement_line
                                        ?.length || 0) / pageSize,
                                    ),
                                    prev + 1,
                                  ),
                                )
                              }
                              disabled={
                                lineDataPage >=
                                Math.ceil(
                                  (multiTableData?.procurement_line?.length ||
                                    0) / pageSize,
                                )
                              }
                              variant="outline"
                              size="sm"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="py-12"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Upload Successful
                </h2>

                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                  Your data has been cleaned and saved to Google Sheets
                  successfully.
                </p>

                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={handleReset} size="lg">
                    Upload Another
                  </Button>

                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      navigate("/overview");
                      window.location.reload();
                    }}
                  >
                    Go to Overview
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ChartContainer>
    </div>
  );
}
