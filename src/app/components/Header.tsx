import React, { useState, useEffect } from "react";
import {
  User,
  ChevronDown,
  RotateCcw,
  Upload,
  Search,
  Bell,
  Settings,
} from "lucide-react";
import { getTab1Data } from "../../services/googleSheetsService";
import Papa from "papaparse";
import { getSheetNames, addNewSheet } from "../../services/googleSheetsService";
import * as XLSX from "xlsx";

interface HeaderProps {
  title: string;
  onFilterChange: (filters: { year: string; project: string }) => void;
  showFilters?: boolean | { projectOnly: true };
}

export function Header({ title, onFilterChange, showFilters }: HeaderProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [showDestinationDialog, setShowDestinationDialog] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [shouldCreateChart, setShouldCreateChart] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [isNewSheet, setIsNewSheet] = useState(false);
  const [uploadData, setUploadData] = useState<any[] | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchSheetNames = async () => {
      try {
        const names = await getSheetNames();
        setSheetNames(names);
      } catch (error) {
        console.error("Error fetching sheet names:", error);
      }
    };
    fetchSheetNames();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const tab1Data = await getTab1Data();
        const uniqueProjects = new Set(
          tab1Data.rows
            .map((row) => String(row.projectCode || row["Project Code"] || ""))
            .filter((project) => project && project.trim() !== ""),
        );
        const projectList = Array.from(uniqueProjects) as string[];
        setAllProjects(projectList);
        setProjects(projectList);

        // Get all available years
        const uniqueYears = new Set(
          tab1Data.rows
            .map((row) => {
              const dateStr = row.date || row["DATE"];
              if (dateStr) {
                return new Date(dateStr).getFullYear().toString();
              }
              return null;
            })
            .filter((year) => year !== null),
        );
        const yearList = Array.from(uniqueYears) as string[];
        setAvailableYears(yearList.sort((a, b) => parseInt(b) - parseInt(a)));
      } catch (error) {
        console.error("Error fetching projects:", error);
        setAllProjects([]);
        setProjects([]);
        setAvailableYears([]);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const filterProjectsByYear = async () => {
      try {
        const tab1Data = await getTab1Data();
        let filteredRows = tab1Data.rows;

        // Filter by year if selected
        if (selectedYear !== "all") {
          filteredRows = filteredRows.filter((row) => {
            const dateStr = row.date || row["DATE"];
            if (dateStr) {
              const year = new Date(dateStr).getFullYear().toString();
              return year === selectedYear;
            }
            return false;
          });
        }

        // Get unique projects from filtered data
        const uniqueProjects = new Set(
          filteredRows
            .map((row) => String(row.projectCode || row["Project Code"] || ""))
            .filter((project) => project && project.trim() !== ""),
        );
        const projectList = Array.from(uniqueProjects) as string[];
        setProjects(projectList);

        // Reset selected project if it's not in filtered list
        if (
          selectedProject !== "all" &&
          !projectList.includes(selectedProject)
        ) {
          setSelectedProject("all");
          onFilterChange({ year: selectedYear, project: "all" });
        }
      } catch (error) {
        console.error("Error filtering projects by year:", error);
        setProjects([]);
      }
    };

    filterProjectsByYear();
  }, [selectedYear]);

  useEffect(() => {
    const filterYearsByProject = async () => {
      try {
        const tab1Data = await getTab1Data();
        let filteredRows = tab1Data.rows;

        // Filter by project if selected
        if (selectedProject !== "all") {
          filteredRows = filteredRows.filter(
            (row) =>
              String(row.projectCode || row["Project Code"] || "") ===
              selectedProject,
          );
        }

        // Get unique years from filtered data
        const uniqueYears = new Set(
          filteredRows
            .map((row) => {
              const dateStr = row.date || row["DATE"];
              if (dateStr) {
                return new Date(dateStr).getFullYear().toString();
              }
              return null;
            })
            .filter((year) => year !== null),
        );
        const yearList = Array.from(uniqueYears) as string[];
        setAvailableYears(yearList.sort((a, b) => parseInt(b) - parseInt(a)));

        // Reset selected year if it's not in filtered list
        if (selectedYear !== "all" && !yearList.includes(selectedYear)) {
          setSelectedYear("all");
          onFilterChange({ year: "all", project: selectedProject });
        }
      } catch (error) {
        console.error("Error filtering years by project:", error);
        setAvailableYears([]);
      }
    };

    filterYearsByProject();
  }, [selectedProject]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    onFilterChange({ year, project: selectedProject });
  };

  const handleProjectChange = (project: string) => {
    setSelectedProject(project);
    onFilterChange({ year: selectedYear, project });
  };

  const handleClearFilters = () => {
    setSelectedYear("all");
    setSelectedProject("all");
    onFilterChange({ year: "all", project: "all" });
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      // Check API URL first
      const apiUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      if (!apiUrl || apiUrl.includes("YOUR_SCRIPT_ID") || apiUrl.length < 10) {
        throw new Error(
          "API URL ยังไม่ถูกตั้งค่า กรุณาตรวจสอบ .env file และตั้งค่า Google Apps Script URL",
        );
      }

      // Dynamic file processing based on file type
      let data: any[] = [];

      if (file.name.endsWith(".csv")) {
        data = await readCSVFile(file);
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        data = await readExcelFile(file);
      } else {
        throw new Error(
          "Unsupported file format. Please use CSV, XLSX, or XLS files.",
        );
      }

      console.log("Data read from file:", data);

      // Validate data
      if (!data || data.length === 0) {
        throw new Error("ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบข้อมูลในไฟล์");
      }

      // Store data for later use after destination selection
      setUploadData(data);

      // Show destination selection dialog
      const destination = await selectDestination();

      // Validate destination
      if (!destination || !destination.sheet) {
        throw new Error("กรุณาเลือก sheet ปลายทาง");
      }

      // Process upload
      const result = await uploadToGoogleSheets(data, destination);
      console.log("Upload result:", result);

      // Success handling
      const chartMessage = destination.createChart ? " พร้อมสร้างแผนภูมิ" : "";
      alert(
        `นำเข้าข้อมูลสำเร็จไปยัง sheet: ${destination.sheet}${chartMessage}!\n\nจำนวนข้อมูล: ${data.length} แถว`,
      );

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error("Import error:", error);

      // Better error handling
      let errorMessage = "เกิดข้อผิดพลาดในการนำเข้าข้อมูล";

      if (error instanceof Error) {
        if (error.message.includes("API URL")) {
          errorMessage = "❌ ตั้งค่า API: " + error.message;
        } else if (error.message.includes("Unsupported file")) {
          errorMessage = "❌ รูปแบบไฟล์ไม่รองรับ: " + error.message;
        } else if (error.message.includes("ไม่พบข้อมูล")) {
          errorMessage = "❌ ไฟล์ว่างเปล่า: " + error.message;
        } else if (error.message.includes("sheet ปลายทาง")) {
          errorMessage = "❌ กรุณาเลือก sheet: " + error.message;
        } else {
          errorMessage = "❌ ข้อผิดพลาด: " + error.message;
        }
      }

      alert(errorMessage);
    } finally {
      setImporting(false);
      setShowDestinationDialog(false);
      setUploadData(null);
    }
  };

  const readCSVFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
              resolve(results.data as any[]);
            },
            error: (error: any) => {
              reject(error);
            },
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const selectDestination = async (): Promise<{
    sheet: string;
    createChart: boolean;
  }> => {
    return new Promise((resolve, reject) => {
      setShowDestinationDialog(true);

      // Store the resolve function to be called when user confirms
      (window as any).resolveDestination = resolve;
      (window as any).rejectDestination = reject;
    });
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const uploadToGoogleSheets = async (
    data: any[],
    destination: { sheet: string; createChart: boolean },
  ): Promise<any> => {
    // ใช้ Apps Script API แทนการส่งไปยัง Google Sheets โดยตรง
    const apiUrl = import.meta.env.VITE_APPS_SCRIPT_URL;

    console.log("=== DEBUG INFO ===");
    console.log("Raw import.meta.env:", import.meta.env);
    console.log("VITE_APPS_SCRIPT_URL:", import.meta.env.VITE_APPS_SCRIPT_URL);
    console.log("All env keys:", Object.keys(import.meta.env));
    console.log("Final API URL:", apiUrl);
    console.log("Uploading data to Apps Script:", data);
    console.log("Destination:", destination);

    // ตรวจสอบว่า URL ถูกต้องหรือไม่
    if (!apiUrl || apiUrl.includes("YOUR_SCRIPT_ID") || apiUrl.length < 10) {
      console.error("API URL validation failed:", {
        hasValue: !!apiUrl,
        isPlaceholder: apiUrl?.includes("YOUR_SCRIPT_ID"),
        isTooShort: apiUrl?.length < 10,
        actualValue: apiUrl,
      });
      throw new Error("API URL ยังไม่ถูกตั้งค่า กรุณาตรวจสอบ .env file");
    }

    try {
      // Test 1: Simple GET request first
      console.log("Testing GET request...");
      const getResponse = await fetch(apiUrl + "?action=test", {
        method: "GET",
      });

      if (!getResponse.ok) {
        throw new Error(
          `GET test failed: ${getResponse.status} ${getResponse.statusText}`,
        );
      }

      const getResult = await getResponse.json();
      console.log("GET test result:", getResult);

      // Test 2: POST request with enhanced data
      console.log("Testing POST request...");
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          action: "importAndCreateChart",
          data: data,
          destination: destination.sheet,
          createChart: destination.createChart,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `POST failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("POST test result:", result);

      return { success: true, message: result.message };
    } catch (error) {
      console.error("API test error:", error);

      // แสดง error ที่ละเอียดขึ้น
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          throw new Error(
            "Network error: กรุณาตรวจสอบ Apps Script URL และการตั้งค่า CORS",
          );
        } else if (
          error.message.includes("403") ||
          error.message.includes("Forbidden")
        ) {
          throw new Error(
            'Permission error: กรุณาตรวจสอบการ Deploy Apps Script (ต้องเป็น "Anyone" access)',
          );
        } else if (error.message.includes("CORS")) {
          throw new Error(
            "CORS error: กรุณาตรวจสอบการตั้งค่า CORS ใน Apps Script",
          );
        } else {
          throw error;
        }
      }

      throw error;
    }
  };

  const handleConfirmDestination = () => {
    const { resolveDestination } = window as any;

    if (!resolveDestination) {
      console.error("Resolve function not found");
      return;
    }

    let destinationSheet = "";

    if (isNewSheet) {
      if (!newSheetName.trim()) {
        alert("กรุณาระบุชื่อ sheet ใหม่");
        return;
      }
      destinationSheet = newSheetName.trim();
      addNewSheet(destinationSheet);
    } else {
      if (!selectedSheet) {
        alert("กรุณาเลือก sheet ปลายทาง");
        return;
      }
      destinationSheet = selectedSheet;
    }

    resolveDestination({
      sheet: destinationSheet,
      createChart: shouldCreateChart,
    });
  };

  const handleCancelDestination = () => {
    const { rejectDestination } = window as any;
    if (rejectDestination) {
      rejectDestination(new Error("Destination selection cancelled"));
    }
    setShowDestinationDialog(false);
  };

  return (
    <div className="h-auto bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="h-16 flex items-center justify-between px-6">
        {/* Left Section - Title */}
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* Right Section - Filters, Import */}
        <div className="flex items-center gap-3">
          {/* Filter Controls */}
          {(showFilters === true ||
            (typeof showFilters === "object" && showFilters.projectOnly)) && (
            <div className="flex items-center gap-3">
              {/* Year Filter - only show if not projectOnly */}
              {showFilters === true && (
                <div className="min-w-[120px]">
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project Filter - always show when filters are enabled */}
              <div className="min-w-[140px]">
                <select
                  value={selectedProject}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Projects</option>
                  {projects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                title="Clear Filter"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          )}

          {/* Import Button */}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
            disabled={importing}
          />
          <button
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={importing}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Import Data"
          >
            <Upload size={16} />
            {importing ? "Processing import..." : "Import Data"}
          </button>
        </div>
      </div>

      {/* Destination Selection Dialog */}
      {showDestinationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                เลือก Sheet ปลายทาง
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                เลือก sheet ที่มีอยู่หรือสร้าง sheet ใหม่สำหรับนำเข้าข้อมูล
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              {/* Sheet Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภท Sheet
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsNewSheet(false);
                      setSelectedSheet("");
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      !isNewSheet
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    เลือก Sheet ที่มีอยู่
                  </button>
                  <button
                    onClick={() => {
                      setIsNewSheet(true);
                      setNewSheetName("");
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      isNewSheet
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    สร้าง Sheet ใหม่
                  </button>
                </div>
              </div>

              {/* Existing Sheet Selection */}
              {!isNewSheet && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลือก Sheet
                  </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- เลือก Sheet --</option>
                    {sheetNames.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* New Sheet Name */}
              {isNewSheet && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อ Sheet ใหม่
                  </label>
                  <input
                    type="text"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    placeholder="เช่น Project_2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Chart Creation Option */}
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shouldCreateChart}
                    onChange={(e) => setShouldCreateChart(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      สร้างแผนภูมิอัตโนมัติ
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      สร้างแผนภูมิจากข้อมูลที่นำเข้า (Amount, Status, Timeline,
                      Category)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCancelDestination}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDestination}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                นำเข้าข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
