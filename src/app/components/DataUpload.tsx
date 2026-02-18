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
    Table as TableIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DataCleaningService, CleanedDataRow } from "../../services/dataCleaning";
import { ChartContainer } from "./ChartContainer";
import { Button } from "./ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "./ui/table";
import { toast } from "sonner";

export function DataUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rawData, setRawData] = useState<any[]>([]);
    const [cleanedData, setCleanedData] = useState<CleanedDataRow[]>([]);
    const [step, setStep] = useState<"upload" | "preview" | "success">("upload");

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0];
        if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv"))) {
            setFile(selectedFile);
            handleFileProcess(selectedFile);
        } else {
            toast.error("Please upload a valid CSV file");
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "text/csv": [".csv"] },
        multiple: false,
    });

    const handleFileProcess = (file: File) => {
        setIsProcessing(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: Papa.ParseResult<any>) => {
                setRawData(results.data);
                const cleaned = DataCleaningService.cleanData(results.data);
                setCleanedData(cleaned);
                setIsProcessing(false);
                setStep("preview");
                toast.success(`Successfully processed ${cleaned.length} rows`);
            },
            error: (error: Error) => {
                console.error("CSV Parsing Error:", error);
                setIsProcessing(false);
                toast.error("Failed to parse CSV file");
            }
        });
    };

    const handleReset = () => {
        setFile(null);
        setRawData([]);
        setCleanedData([]);
        setStep("upload");
    };

    const handleCommit = async () => {
        setIsProcessing(true);
        try {
            // Simulate API call to database
            // In a real scenario, this would be: 
            // await DatabaseService.uploadCleanedData(cleanedData);
            await new Promise(resolve => setTimeout(resolve, 2000));

            setStep("success");
            toast.success("Data successfully saved to database");
        } catch (error) {
            toast.error("Failed to save data to database");
        } finally {
            setIsProcessing(false);
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
                                    {isDragActive ? "Drop the file here" : "Click or drag CSV file to upload"}
                                </h3>
                                <p className="text-gray-500 max-w-xs mx-auto mb-8">
                                    Support .csv files with standard procurement headers (Date, PO, Supplier, etc.)
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
                                        <h3 className="text-lg font-bold text-gray-900 leading-tight">Data Processed Successfully</h3>
                                        <p className="text-sm text-gray-500">Found {cleanedData.length} valid rows out of {rawData.length} total</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={handleReset} className="gap-2">
                                        <Trash2 className="w-4 h-4" /> Reset
                                    </Button>
                                    <Button onClick={handleCommit} disabled={isProcessing} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                        Confirm & Save
                                    </Button>
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
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
                                            {cleanedData.slice(0, 50).map((row, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium text-gray-600">{row.date}</TableCell>
                                                    <TableCell>{row.poNumber}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate">{row.supplierName}</TableCell>
                                                    <TableCell className="max-w-[300px] truncate">{row.itemDescription}</TableCell>
                                                    <TableCell className="text-right font-semibold text-blue-600">
                                                        {row.totalPrice.toLocaleString()} ฿
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                                                            {row.category}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{row.projectCode}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {cleanedData.length > 50 && (
                                    <div className="p-4 bg-gray-50 text-center text-sm text-gray-500 border-t">
                                        Showing first 50 rows. {cleanedData.length - 50} more rows hidden.
                                    </div>
                                )}
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
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Success!</h2>
                            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                                Your data has been cleaned and saved to the database. All charts are now updated.
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
                    <h4 className="font-bold text-gray-900">Supported Headers</h4>
                    <p className="text-sm text-gray-500">
                        We automatically detect "Date", "PO", "Supplier", "Description", and "Amount" headers in many languages.
                    </p>
                </div>
                <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-3">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                        <AlertCircle size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">Data Validation</h4>
                    <p className="text-sm text-gray-500">
                        Rows without a PO Number are automatically filtered to ensure data integrity.
                    </p>
                </div>
                <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                        <FileText size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">Auto-Categorization</h4>
                    <p className="text-sm text-gray-500">
                        Our AI-powered engine automatically sorts your items into IT, Furniture, Services, and more.
                    </p>
                </div>
            </div>
        </div>
    );
}
