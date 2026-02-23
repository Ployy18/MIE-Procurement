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
  Users,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DataCleaningService,
  CleanedDataRow,
  MultiTableData,
} from "../../services/dataCleaning";
import { uploadMultiTableData } from "../../services/googleSheetsService";
import { ChartContainer } from "./ChartContainer";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from "sonner";

export function DataUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [cleanedData, setCleanedData] = useState<CleanedDataRow[]>([]);
  const [multiTableData, setMultiTableData] = useState<MultiTableData | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "success">("upload");

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
                meta: results.meta
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
      const multiTable = DataCleaningService.processMultiTableData(cleaned, file.name);
      setMultiTableData(multiTable);
      
      setIsProcessing(false);
      setStep("preview");
      toast.success(`Successfully processed ${cleaned.length} rows (${multiTable.procurement_head.length} heads, ${multiTable.procurement_line.length} lines)`);

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
  };

  const handleCommit = async () => {
    console.log("💾 [DataUpload] Starting data commit process...");

    if (!file || cleanedData.length === 0) {
      console.error(
        "❌ [DataUpload] Cannot commit - missing file or no cleaned data:",
        {
          hasFile: !!file,
          cleanedDataLength: cleanedData.length,
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
      console.log("🌐 [DataUpload] Sending data to backend...");
      const result = await uploadMultiTableData(cleanedData, file.name);

      console.log("📨 [DataUpload] Backend response:", result);

      if (result.success) {
        console.log("✅ [DataUpload] Data saved successfully!");
        setStep("success");
        toast.success(
          result.message ||
            "Data successfully saved to multiple tables in Google Sheets",
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <ChartContainer
        title="Data Import & Cleaning"
        subtitle="Upload your procurement data for automated cleaning and centralization"
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
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  {isProcessing ? (
                    <Loader2 className="w-10 h-10 animate-spin" />
                  ) : (
                    <Upload className="w-10 h-10" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isDragActive
                    ? "Drop the file here"
                    : "Click or drag CSV or Excel file to upload"}
                </h3>
                <p className="text-gray-500 max-w-xs mx-auto mb-8">
                  Support .csv, .xlsx files with standard procurement headers
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">
                      Data Processed Successfully
                    </h3>
                    <p className="text-sm text-gray-500">
                      Found {cleanedData.length} valid rows from {file?.name}
                    </p>
                    <div className="flex gap-6 mt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-600 font-semibold">Head: {multiTableData?.procurement_head.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-600 font-semibold">Line: {multiTableData?.procurement_line.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-purple-600 font-semibold">Suppliers: {multiTableData?.suppliers_master.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-orange-600 font-semibold">Total: ฿{cleanedData.reduce((sum, r) => sum + (r.totalPrice || 0), 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Reset
                  </Button>
                  <Button
                    onClick={handleCommit}
                    disabled={isProcessing}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Confirm & Save to Sheets
                  </Button>
                </div>
              </div>

              <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-gray-50 border-b">
                    <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        All Data ({cleanedData.length})
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="head" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Head ({multiTableData?.procurement_head.length || 0})
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="line" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Line ({multiTableData?.procurement_line.length || 0})
                      </div>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="m-0">
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader className="bg-gray-50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Project</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cleanedData.slice(0, 50).map((row, idx) => {
                            const isHead = (row as any)._isHead;
                            const isLine = (row as any)._isLine;
                            
                            return (
                              <TableRow key={idx} className={isHead ? 'bg-blue-50/50' : isLine ? 'bg-green-50/50' : ''}>
                                <TableCell className="font-medium text-gray-600">
                                  {row.date}
                                </TableCell>
                                <TableCell>
                                  {row.poNumber}
                                  {isHead && (
                                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1 rounded">
                                      HEAD
                                    </span>
                                  )}
                                  {isLine && (
                                    <span className="ml-2 text-[10px] bg-green-100 text-green-800 px-1 rounded">
                                      LINE
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {row.supplierName}
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate">
                                  {row.itemDescription}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-blue-600">
                                  {row.totalPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                      row.category === 'HEADER' 
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {row.category}
                                  </span>
                                </TableCell>
                                <TableCell>{row.projectCode}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {cleanedData.length > 50 && (
                      <div className="p-4 bg-gray-50 text-center text-sm text-gray-500 border-t">
                        Showing first 50 rows. {cleanedData.length - 50} more rows hidden.
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="head" className="m-0">
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader className="bg-blue-50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Engineer</TableHead>
                            <TableHead>VAT Rate</TableHead>
                            <TableHead>Project</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(multiTableData?.procurement_head || []).slice(0, 50).map((row, idx) => (
                            <TableRow key={idx} className="bg-blue-50/30">
                              <TableCell className="font-medium text-gray-600">
                                {row.date}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {row.poNumber}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {row.supplierName}
                              </TableCell>
                              <TableCell>{row.engineerName}</TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {row.vatRate}
                                </span>
                              </TableCell>
                              <TableCell>{row.projectCode}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(multiTableData?.procurement_head.length || 0) > 50 && (
                      <div className="p-4 bg-blue-50 text-center text-sm text-blue-600 border-t">
                        Showing first 50 head rows. {(multiTableData?.procurement_head.length || 0) - 50} more rows hidden.
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="line" className="m-0">
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader className="bg-green-50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Category</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(multiTableData?.procurement_line || []).slice(0, 50).map((row, idx) => (
                            <TableRow key={idx} className="bg-green-50/30">
                              <TableCell className="font-medium text-gray-600">
                                {row.date}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {row.poNumber}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {row.supplierName}
                              </TableCell>
                              <TableCell className="max-w-[300px] truncate">
                                {row.itemDescription}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.quantity} {row.unit}
                              </TableCell>
                              <TableCell className="text-right">
                                ฿{row.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                ฿{row.totalPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                  {row.category}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(multiTableData?.procurement_line.length || 0) > 50 && (
                      <div className="p-4 bg-green-50 text-center text-sm text-green-600 border-t">
                        Showing first 50 line rows. {(multiTableData?.procurement_line.length || 0) - 50} more rows hidden.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-16 text-center"
            >
              <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                Your data has been cleaned and saved DIRECTLY to Google Sheets
                via the Node.js backend.
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleReset} size="lg">
                  Upload Another
                </Button>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Go to Dashboard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ChartContainer>

      {/* Helpful Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-3">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <TableIcon size={20} />
          </div>
          <h4 className="font-bold text-gray-900">Backend Storage</h4>
          <p className="text-sm text-gray-500">
            Data is now sent to a Node.js server which uses the Google Sheets
            API directly (no Apps Script).
          </p>
        </div>
        <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-3">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <h4 className="font-bold text-gray-900">Direct API Access</h4>
          <p className="text-sm text-gray-500">
            Uses a Google Service Account for faster and more reliable
            multi-table updates.
          </p>
        </div>
        <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-3">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <FileText size={20} />
          </div>
          <h4 className="font-bold text-gray-900">Excel Support</h4>
          <p className="text-sm text-gray-500">
            Natively read .xlsx and .xls files without any manual CSV
            conversion.
          </p>
        </div>
      </div>
    </div>
  );
}
