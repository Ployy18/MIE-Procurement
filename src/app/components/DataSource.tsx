import React, { useState, useEffect, useMemo } from "react";
import {
  Upload,
  RefreshCw,
  Database,
  EyeOff,
  Settings,
  Eye,
  Filter,
  Edit,
  X,
  Trash,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { LoadingState } from "./ui/LoadingState";
import {
  getTab1Data,
  getTab2Data,
  getMainSheetData,
  getSheetNames,
  getSheetDataByName,
  addNewSheet,
  addSheetURL,
  updateSheetData,
  deleteFileData,
  SheetData,
} from "../../services/googleSheetsService";

// Helper function to format numbers with commas
const formatNumberWithCommas = (value: any) => {
  if (value === null || value === undefined || value === "") return "";
  const num =
    typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US");
};

// Helper function to get display name for sheet
const getSheetDisplayName = (sheetName: string) => {
  const nameMap: { [key: string]: string } = {
    upload_logs: "Data Files",
  };
  return nameMap[sheetName] || sheetName;
};

// Helper function to filter columns for specific sheets
const getFilteredDataForSheet = (sheetName: string, data: any[]) => {
  if (sheetName === "upload_logs") {
    // For Data Files, only show filename and row_count columns with custom names
    return data.map((row) => {
      const filteredRow: any = {};
      if (row.filename) filteredRow["Source File"] = row.filename;
      if (row.row_count !== undefined)
        filteredRow["Total Records"] = row.row_count;
      return filteredRow;
    });
  }

  if (
    sheetName === "procurement_data" ||
    sheetName === "procurement_head" ||
    sheetName === "procurement_line"
  ) {
    // Remove Discount, sourceSheet, and batchId columns from procurement sheets
    return data.map((row) => {
      const filteredRow: any = { ...row };
      delete filteredRow["Discount"];
      delete filteredRow["sourceSheet"];
      delete filteredRow["batchId"];
      return filteredRow;
    });
  }

  return data;
};

// Helper function to delete entire file from upload_logs
const deleteFileFromUploadLogs = async (filename: string, allData: any[]) => {
  // Filter out all rows with the specified filename
  const updatedData = allData.filter((row) => row.filename !== filename);
  return updatedData;
};

interface DataSourceConfig {
  id: string;
  name: string;
  type: "google-sheets" | "api" | "database";
  status: "connected" | "disconnected" | "syncing";
  lastSync?: string;
  url?: string;
  apiKey?: string;
}

interface DataSourceItem {
  id: string;
  name: string;
  type: string;
  size: string;
  records: number;
  lastUpdated: string;
  status: "active" | "inactive";
}

export function DataSource() {
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<
    "connected" | "disconnected" | "syncing"
  >("connected");
  const [selectedTab, setSelectedTab] = useState<string>("upload_logs");
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [filteredSheets, setFilteredSheets] = useState<string[]>([]);

  // Force update key to trigger re-render
  const [forceUpdate, setForceUpdate] = useState(0);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editHistory, setEditHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Memoize filtered data to prevent unnecessary recalculation
  const filteredData = useMemo(
    () => getFilteredDataForSheet(selectedTab, currentData),
    [selectedTab, currentData],
  );

  // Sheets to display
  const allowedSheets = [
    "procurement_data",
    "procurement_head",
    "procurement_line",
    "upload_logs",
  ];

  const [configs, setConfigs] = useState<DataSourceConfig[]>([
    {
      id: "1",
      name: "Google Sheets - df_HEADER",
      type: "google-sheets",
      status: syncStatus,
      lastSync: new Date().toLocaleString(),
      url: "https://docs.google.com/spreadsheets/d/...",
    },
    {
      id: "2",
      name: "Google Sheets - df_LINE",
      type: "google-sheets",
      status: "connected",
      lastSync: "2025-02-16 10:30:00",
      url: "https://docs.google.com/spreadsheets/d/...",
    },
  ]);

  const [dataItems, setDataItems] = useState<DataSourceItem[]>([
    {
      id: "1",
      name: "Purchase Orders",
      type: "Main Dataset",
      size: loading
        ? "Loading..."
        : `${(sheetData.length * 0.5).toFixed(2)} KB`,
      records: loading ? 0 : sheetData.length,
      lastUpdated: loading ? "Loading..." : new Date().toLocaleString(),
      status: syncStatus === "connected" ? "active" : "inactive",
    },
    {
      id: "2",
      name: "Line Items",
      type: "Supporting Dataset",
      size: "1.8 MB",
      records: 3420,
      lastUpdated: "2025-02-16 09:15:00",
      status: "active",
    },
    {
      id: "3",
      name: "Suppliers",
      type: "Reference Data",
      size: "0.3 MB",
      records: 45,
      lastUpdated: "2025-02-15 14:30:00",
      status: "active",
    },
  ]);

  // Initialize available sheets and check for new sheets periodically
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const sheets = await getSheetNames();
        setAvailableSheets(sheets);

        // Filter sheets to show only allowed ones
        const filtered = sheets.filter((sheet) =>
          allowedSheets.includes(sheet),
        );
        setFilteredSheets(filtered);

        // Set default tab if none selected or if default doesn't exist in filtered list
        if (
          filtered.length > 0 &&
          (!selectedTab || !filtered.includes(selectedTab))
        ) {
          setSelectedTab(filtered[0]);
        }
      } catch (error) {
        console.error("Failed to initialize sheet names:", error);
      }
    };

    fetchNames();

    // Listen for data upload events
    const handleDataUploaded = (event: CustomEvent) => {
      console.log("🔄 [DataSource] Data uploaded, refreshing all tabs...");
      console.log("🔄 [DataSource] Event detail:", event.detail);

      // Force refresh all sheets with longer delay to ensure backend processing is complete
      setTimeout(async () => {
        console.log("🔄 [DataSource] Delayed refresh after upload...");

        try {
          // First refresh - get initial data
          await handleRefresh();
          console.log("🔄 [DataSource] First refresh completed");

          // Wait longer for backend to fully process
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Second refresh - ensure all data is updated
          console.log("🔄 [DataSource] Second refresh after upload...");
          await handleRefresh();
          console.log("🔄 [DataSource] Second refresh completed");

          // Final check after another delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("🔄 [DataSource] Final refresh check...");
          await handleRefresh();
          console.log("🔄 [DataSource] All refreshes completed");
        } catch (error) {
          console.error("❌ [DataSource] Error during upload refresh:", error);
        }
      }, 3000); // Wait 3 seconds for backend to complete (increased from 2)
    };

    // Listen for data update events
    const handleDataUpdated = (event: CustomEvent) => {
      console.log("🔄 [DataSource] Data updated, refreshing current tab...");
      handleRefresh();
    };

    // Listen for page visibility changes (when user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("🔄 [DataSource] Page became visible, refreshing data...");
        handleRefresh();
      }
    };

    window.addEventListener(
      "dataUploaded",
      handleDataUploaded as EventListener,
    );
    window.addEventListener("dataUpdated", handleDataUpdated as EventListener);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Set up interval to check for new sheets every 30 seconds (more frequent)
    const interval = setInterval(async () => {
      try {
        const updatedSheets = await getSheetNames();
        setAvailableSheets((prev) => {
          if (updatedSheets.length !== prev.length) {
            // Update filtered sheets when available sheets change
            const filtered = updatedSheets.filter((sheet) =>
              allowedSheets.includes(sheet),
            );
            setFilteredSheets(filtered);
            return updatedSheets;
          }
          return prev;
        });
      } catch (e) {
        console.error("Failed to refresh sheet names in background:", e);
      }
    }, 30000); // Reduced from 60s to 30s for more responsive updates

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "dataUploaded",
        handleDataUploaded as EventListener,
      );
      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated as EventListener,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedTab]);

  // Fetch data from Google Sheets on component mount and tab change
  useEffect(() => {
    const fetchData = async () => {
      try {
        setSyncStatus("syncing");

        // Fetch data specific to the selected sheet
        const data = await getSheetDataByName(selectedTab);

        setSheetData(data.rows);
        setCurrentData(data.rows);

        // Update data items with real data
        const realRecords = data.rows.length;
        const realSize = (
          JSON.stringify(data.rows).length /
          1024 /
          1024
        ).toFixed(2);
        const currentTime = new Date().toLocaleString();

        setDataItems((prev) =>
          prev.map((item) =>
            item.id === "1"
              ? {
                  ...item,
                  records: realRecords,
                  size: `${realSize} MB`,
                  lastUpdated: currentTime,
                }
              : item,
          ),
        );

        setSyncStatus("connected");
      } catch (error) {
        console.error(`Error fetching data for sheet ${selectedTab}:`, error);
        setSyncStatus("disconnected");
      } finally {
        setLoading(false);
      }
    };

    if (filteredSheets.length > 0) {
      fetchData();
    }
  }, [selectedTab, filteredSheets]);

  const handleRefresh = async () => {
    console.log(`🔄 [DEBUG] Refreshing data for current tab: ${selectedTab}`);

    try {
      setLoading(true);
      setSelectedRows(new Set());
      setSyncStatus("syncing");

      // Clear any cached data first
      setSheetData([]);
      setCurrentData([]);

      // Small delay to ensure clear takes effect
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Show loading state for large datasets
      console.log(`📊 [DEBUG] Fetching data for sheet: ${selectedTab}`);

      // Add timeout for large datasets
      const dataPromise = getSheetDataByName(selectedTab, {
        forceRefresh: true,
      });
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error("Timeout fetching data")), 45000), // 45 seconds
      );

      const data = (await Promise.race([
        dataPromise,
        timeoutPromise,
      ])) as SheetData;

      console.log(`📊 [DEBUG] Raw data received:`, {
        rows: data.rows.length,
        headers: data.headers.length,
        sheetName: selectedTab,
      });

      // For large datasets, show progress
      if (data.rows.length > 1000) {
        console.log(
          `📊 [DEBUG] Large dataset detected: ${data.rows.length} rows`,
        );
        // Process in chunks for better performance
        const chunkSize = 500;
        const processedData = [];

        for (let i = 0; i < data.rows.length; i += chunkSize) {
          const chunk = data.rows.slice(i, i + chunkSize);
          processedData.push(...chunk);

          // Update UI progressively
          if (i % 1000 === 0) {
            setSheetData([...processedData]);
            setCurrentData([...processedData]);
            setForceUpdate((prev) => prev + 1);
            await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay for UI
          }
        }

        setSheetData(processedData);
        setCurrentData(processedData);
      } else {
        // For smaller datasets, update all at once
        setSheetData(data.rows);
        setCurrentData(data.rows);
      }

      // Force re-render by updating forceUpdate key
      setForceUpdate((prev) => prev + 1);

      // Additional delay to ensure React processes the update
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(
        `✅ [DEBUG] Refreshed ${data.rows.length} rows for ${selectedTab}`,
      );

      // Update data items with real data
      const realRecords = data.rows.length;
      const realSize = (JSON.stringify(data.rows).length / 1024 / 1024).toFixed(
        2,
      );
      const currentTime = new Date().toLocaleString();

      setDataItems((prev) =>
        prev.map((item) =>
          item.id === "1"
            ? {
                ...item,
                records: realRecords,
                size: `${realSize} MB`,
                lastUpdated: currentTime,
              }
            : item,
        ),
      );

      setConfigs((prev) =>
        prev.map((config) =>
          config.type === "google-sheets"
            ? { ...config, lastSync: currentTime }
            : config,
        ),
      );

      setSyncStatus("connected");
      setLoading(false);
      console.log(`✅ [DEBUG] Refresh completed for ${selectedTab}`);

      // Force another re-render to ensure UI updates
      setTimeout(() => {
        setForceUpdate((prev) => prev + 1);
        console.log("🔄 [DEBUG] Final force re-render completed");
      }, 200);
    } catch (error) {
      console.error(
        `❌ [ERROR] Error refreshing data for sheet ${selectedTab}:`,
        error,
      );
      setSyncStatus("disconnected");
      setLoading(false); // Added setLoading(false) here

      // Show error details to user
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Timeout")) {
        alert(
          `ข้อมูลใน ${selectedTab} มีขนาดใหญ่มาก การโหลดใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง`,
        );
      } else {
        alert(`เกิดข้อผิดพลาดในการรีเฟรชข้อมูล: ${errorMessage}`);
      }
    }
  };
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSync = async (configId: string) => {
    await handleRefresh();
    setIsSyncing(false);
  };

  // Edit mode functions
  const handleEditData = () => {
    if (!isEditMode) {
      // Enter edit mode
      setIsEditMode(true);
      setEditHistory([JSON.parse(JSON.stringify(currentData))]);
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
        }
      } else {
        setIsEditMode(false);
      }
    }
  };

  const handleCellEdit = (
    rowIndex: number,
    colIndex: number,
    newValue: string,
  ) => {
    const newData = JSON.parse(JSON.stringify(currentData));
    const headers = Object.keys(newData[0]);
    const header = headers[colIndex];

    newData[rowIndex][header] = newValue;
    setCurrentData(newData);

    // Add to history
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData)));
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedChanges(true);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (confirm("คุณต้องการลบแถวนี้หรือไม่?")) {
      const newData = currentData.filter((_, index) => index !== rowIndex);
      setCurrentData(newData);

      // Add to history
      const newHistory = editHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setHasUnsavedChanges(true);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentData(JSON.parse(JSON.stringify(editHistory[historyIndex - 1])));
      setHasUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < editHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentData(JSON.parse(JSON.stringify(editHistory[historyIndex + 1])));
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = async () => {
    try {
      // Save to Google Sheets
      console.log("💾 Saving data to Google Sheets...");

      // Here you would implement the actual save logic
      // For now, just show success message
      alert("บันทึกข้อมูลสำเร็จ!");

      setHasUnsavedChanges(false);
      setIsEditMode(false);

      // Refresh data
      await fetchSheetData(selectedTab);
    } catch (error) {
      console.error("❌ Error saving data:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleDeleteFile = async (filename: string) => {
    console.log("🗑️ [DEBUG] Starting file deletion for:", filename);

    // Show confirmation dialog
    const confirmed = window.confirm(
      `ยืนยันการลบไฟล์ "${filename}" จะถูกลบออกจากระบบและ Google Sheets อย่างถาวร`,
    );

    if (!confirmed) {
      console.log("🚫 [DEBUG] User cancelled deletion");
      return;
    }

    try {
      // Set syncing status
      setSyncStatus("syncing");
      console.log("� [DEBUG] Deleting file from backend:", filename);

      // Call the backend endpoint
      const result = await deleteFileData(filename);

      console.log("✅ [DEBUG] Backend deletion result:", result);

      // Check if deletion was actually successful
      const hasErrors = Object.values(result.results).some(
        (sheetResult: any) => sheetResult.status === "error",
      );

      const totalDeleted = Object.values(result.results)
        .filter((sheetResult: any) => sheetResult.status === "success")
        .reduce(
          (sum: number, sheetResult: any) => sum + (sheetResult.deleted || 0),
          0,
        );

      if (hasErrors || totalDeleted === 0) {
        console.warn("⚠️ [DEBUG] Backend deletion failed");
        alert(`การลบข้อมูลมีปัญหาบางส่วน\nกรุณาตรวจสอบข้อมูลและลองใหม่`);
        setSyncStatus("disconnected");
        return;
      }

      // Backend deletion successful - refresh data
      console.log("✅ [DEBUG] Backend deletion successful - refreshing data");

      await handleRefresh();

      // Automatically exit Edit Mode and return to normal view
      setIsEditMode(false);
      setSelectedRows(new Set());
      setSyncStatus("connected");

      console.log("🎉 [SUCCESS] File deletion completed successfully");
    } catch (error) {
      console.error("❌ [ERROR] Backend deletion failed:", error);

      // Show error message
      alert("เกิดข้อผิดพลาดในการลบไฟล์ กรุณาลองใหม่");
      setSyncStatus("disconnected");
    }
  };

  const fetchSheetData = async (sheetName: string) => {
    try {
      setSyncStatus("syncing");
      const data = await getSheetDataByName(sheetName);
      setSheetData(data.rows);
      setCurrentData(data.rows);
      setSelectedRows(new Set()); // Clear selection when data changes
      setSyncStatus("connected");
    } catch (error) {
      console.error(`Error fetching data for sheet ${sheetName}:`, error);
      setSyncStatus("disconnected");
    }
  };

  // Row selection functions
  const toggleRowSelection = (rowIndex: number) => {
    // Only allow single selection for file deletion
    if (selectedRows.has(rowIndex)) {
      // Deselect if clicking on selected row
      setSelectedRows(new Set());
    } else {
      // Select only this row (clear previous selection)
      setSelectedRows(new Set([rowIndex]));
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === currentData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(currentData.map((_, index) => index)));
    }
  };

  const handleDeleteRows = async () => {
    if (selectedRows.size === 0) {
      alert("กรุณาเลือกแถวที่ต้องการลบ");
      return;
    }

    if (confirm(`คุณต้องการลบ ${selectedRows.size} แถวนี้หรือไม่?`)) {
      try {
        // Filter out selected rows
        const newData = currentData.filter(
          (_, index) => !selectedRows.has(index),
        );

        // Update Google Sheets
        console.log("🗑️ [DataSource] Deleting rows from Google Sheets...");
        await updateSheetData(selectedTab, newData);

        // Update local state
        setCurrentData(newData);
        setSheetData(newData);

        // Add to history
        const newHistory = editHistory.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newData)));
        setEditHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setHasUnsavedChanges(false); // Reset since we already saved
        setSelectedRows(new Set());

        alert("ลบข้อมูลสำเร็จ!");
      } catch (error) {
        console.error("❌ Error deleting rows:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-600 bg-green-100";
      case "disconnected":
        return "text-red-600 bg-red-100";
      case "syncing":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Database size={16} />;
      case "disconnected":
        return <EyeOff size={16} />;
      case "syncing":
        return <RefreshCw size={16} className="animate-spin" />;
      default:
        return <Database size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Header */}
          <ChartContainer
            title="Data Source Management"
            subtitle="Configure and monitor your data connections"
            delay={0.1}
            headerAction={
              <button
                onClick={handleRefresh}
                disabled={syncStatus === "syncing"}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  size={16}
                  className={syncStatus === "syncing" ? "animate-spin" : ""}
                />
                {syncStatus === "syncing" ? "Refreshing..." : "Refresh"}
              </button>
            }
          >
            {/* Tab Selection */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
              {filteredSheets.map((sheetName) => (
                <button
                  key={sheetName}
                  onClick={() => setSelectedTab(sheetName)}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                    selectedTab === sheetName
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent hover:text-gray-700"
                  }`}
                >
                  {getSheetDisplayName(sheetName)}
                </button>
              ))}
            </div>

            <div className="flex gap-4 mb-6">
              {selectedTab === "upload_logs" && (
                <>
                  <button
                    onClick={handleEditData}
                    disabled={syncStatus === "syncing"}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      isEditMode
                        ? "bg-gray-600 text-white hover:bg-gray-700"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    } ${syncStatus === "syncing" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isEditMode ? (
                      <>
                        <X size={16} />
                        Exit
                      </>
                    ) : (
                      <>
                        <Edit size={16} />
                        Edit Data
                      </>
                    )}
                  </button>
                  {isEditMode && (
                    <button
                      onClick={() => {
                        // Get selected filename (only one allowed)
                        const selectedFiles = Array.from(selectedRows).map(
                          (index) => {
                            const filteredData = getFilteredDataForSheet(
                              selectedTab,
                              currentData,
                            );
                            return filteredData[index]["Source File"];
                          },
                        );

                        if (selectedFiles.length > 1) {
                          alert("กรุณาเลือกไฟล์เดียวเท่านั้น");
                          return;
                        }

                        if (selectedFiles.length === 0) {
                          alert("กรุณาเลือกไฟล์ที่ต้องการลบ");
                          return;
                        }

                        // Delete the selected file (confirmation is in handleDeleteFile)
                        handleDeleteFile(selectedFiles[0]);
                      }}
                      disabled={
                        selectedRows.size === 0 || syncStatus === "syncing"
                      }
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash size={16} />
                      Delete File
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Data Table */}
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {loading
                  ? "Loading data..."
                  : `Data Table - ${getSheetDisplayName(selectedTab)}`}
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin mr-2" size={20} />
                  <span>Loading data...</span>
                </div>
              ) : filteredData.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto overflow-y-auto max-h-96">
                    <table className="w-full text-sm sticky top-0 bg-white">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          {selectedTab === "upload_logs" && isEditMode && (
                            <th className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 w-12">
                              {/* No select all checkbox for single selection mode */}
                            </th>
                          )}
                          {Object.keys(filteredData[0]).map((header, index) => (
                            <th
                              key={index}
                              className={`px-4 py-3 font-medium text-gray-900 border-r border-gray-200 last:border-r-0 ${
                                header.toLowerCase() === "item code"
                                  ? "min-w-[80px] max-w-[120px]"
                                  : header.toLowerCase() === "po number" ||
                                      header.toLowerCase() === "source file"
                                    ? "min-w-[120px] max-w-[180px]"
                                    : "min-w-[120px] max-w-[200px]"
                              } text-center`}
                            >
                              <span className="block truncate" title={header}>
                                {header}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredData.map((row, rowIndex) => (
                          <tr
                            key={`${row["Source File"]}-${rowIndex}`}
                            className="hover:bg-gray-50 transition-colors cursor-default"
                          >
                            {selectedTab === "upload_logs" && isEditMode && (
                              <td className="px-4 py-3 border-r border-gray-200">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(rowIndex)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Select only this row (clear previous selection)
                                      setSelectedRows(new Set([rowIndex]));
                                    } else {
                                      // Deselect this row
                                      setSelectedRows(new Set());
                                    }
                                  }}
                                  className="rounded border-gray-300"
                                />
                              </td>
                            )}
                            {Object.values(row).map((value, colIndex) => (
                              <td
                                key={colIndex}
                                className={`px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0 ${
                                  Object.keys(filteredData[0])[
                                    colIndex
                                  ].toLowerCase() === "description"
                                    ? "max-w-xs truncate"
                                    : Object.keys(filteredData[0])[
                                          colIndex
                                        ].toLowerCase() === "po number" ||
                                        Object.keys(filteredData[0])[
                                          colIndex
                                        ].toLowerCase() === "source file"
                                      ? "max-w-[180px] truncate"
                                      : "whitespace-nowrap"
                                } ${
                                  [
                                    "category",
                                    "quantity",
                                    "unit",
                                    "project",
                                    "sourcesheet",
                                    "total records",
                                  ].includes(
                                    Object.keys(filteredData[0])[
                                      colIndex
                                    ].toLowerCase(),
                                  )
                                    ? "text-center"
                                    : ""
                                }`}
                              >
                                {(() => {
                                  const headerKey = Object.keys(
                                    filteredData[0],
                                  )[colIndex].toLowerCase();
                                  const stringValue = value?.toString() || "";

                                  if (headerKey === "description") {
                                    return (
                                      <span title={stringValue}>
                                        {stringValue.substring(0, 50) +
                                          (stringValue.length > 50
                                            ? "..."
                                            : "")}
                                      </span>
                                    );
                                  }

                                  if (
                                    headerKey === "po number" ||
                                    headerKey === "source file"
                                  ) {
                                    return (
                                      <span
                                        title={stringValue}
                                        className="block truncate"
                                      >
                                        {stringValue}
                                      </span>
                                    );
                                  }

                                  if (headerKey === "category") {
                                    if (!stringValue || stringValue === "-")
                                      return "";
                                    return (
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          stringValue === "Service"
                                            ? "bg-green-100 text-green-700"
                                            : stringValue === "Material"
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {stringValue}
                                      </span>
                                    );
                                  }

                                  if (
                                    [
                                      "unit price",
                                      "net amount",
                                      "discount",
                                      "vat",
                                      "total amount",
                                      "quantity",
                                      "total vat",
                                      "total price",
                                    ].includes(headerKey)
                                  ) {
                                    return formatNumberWithCommas(value);
                                  }

                                  return stringValue;
                                })()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </ChartContainer>
        </>
      )}
    </div>
  );
}
