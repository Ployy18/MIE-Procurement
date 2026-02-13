import React, { useState, useEffect } from "react";
import { User, ChevronDown, RotateCcw, Upload } from "lucide-react";
import { getTab1Data } from "../../services/googleSheetsService";
import * as XLSX from "xlsx";

export function Header({
  title,
  onFilterChange,
}: {
  title: string;
  onFilterChange: (filters: { year: string; project: string }) => void;
}) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [importing, setImporting] = useState<boolean>(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const tab1Data = await getTab1Data();
        const uniqueProjects = new Set(
          tab1Data.rows
            .map((row) => String(row["Project Code"]))
            .filter((project) => project && project.trim() !== ""),
        );
        const projectList = Array.from(uniqueProjects) as string[];
        setAllProjects(projectList);
        setProjects(projectList);

        // Get all available years
        const uniqueYears = new Set(
          tab1Data.rows
            .map((row) => {
              const dateStr = row["DATE"];
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
            const dateStr = row["DATE"];
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
            .map((row) => String(row["Project Code"]))
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
            (row) => String(row["Project Code"]) === selectedProject,
          );
        }

        // Get unique years from filtered data
        const uniqueYears = new Set(
          filteredRows
            .map((row) => {
              const dateStr = row["DATE"];
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
      const data = await readExcelFile(file);
      console.log("Data read from file:", data);

      const result = await uploadToGoogleSheets(data);
      console.log("Upload result:", result);

      alert(
        "นำเข้าข้อมูลสำเร็จแล้ว!\n\nDebug info:\n" +
          JSON.stringify(result, null, 2),
      );

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error("Import error:", error);
      alert("นำเข้าข้อมูลไม่สำเร็จ: " + error);
    } finally {
      setImporting(false);
    }
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

  const uploadToGoogleSheets = async (data: any[]) => {
    // ใช้ Apps Script API แทนการส่งไปยัง Google Sheets โดยตรง
    const apiUrl = import.meta.env.VITE_APPS_SCRIPT_URL;

    console.log("=== DEBUG INFO ===");
    console.log("Raw import.meta.env:", import.meta.env);
    console.log("VITE_APPS_SCRIPT_URL:", import.meta.env.VITE_APPS_SCRIPT_URL);
    console.log("All env keys:", Object.keys(import.meta.env));
    console.log("Final API URL:", apiUrl);
    console.log("Uploading data to Apps Script:", data);

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

      // Test 2: POST request with simple data
      console.log("Testing POST request...");
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          action: "importAndProcess",
          data: data,
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

  const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) return "";

    // ดึง headers จากแถวแรก
    const headers = Object.keys(data[0]);

    // แปลงข้อมูลเป็น CSV
    const csvRows = data.map((row) => {
      return headers
        .map((header) => {
          const value = row[header] || "";
          // จัดการกับค่าที่มี comma หรือ newline
          const escapedValue = String(value).replace(/"/g, '""');
          return `"${escapedValue}"`;
        })
        .join(",");
    });

    // รวม headers และ rows
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    return csvContent;
  };

  return (
    <div className="h-auto bg-slate-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-16 flex items-center justify-between px-8 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white tracking-wide">
          {title}
        </h2>

        {/* Filter Section - Top Right */}
        <div className="flex gap-3 items-center">
          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {/* Year */}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {/* Project */}
            </label>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              title="Clear Filter"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-col justify-end">
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
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 border border-green-600 rounded text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Import Data"
            >
              <Upload size={16} />
              {importing ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
