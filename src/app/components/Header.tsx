import React, { useState, useEffect, useRef } from "react";
import {
  User,
  ChevronDown,
  RotateCcw,
  Search,
  Bell,
  Settings,
  X,
} from "lucide-react";
import { getSheetDataByName } from "../../services/googleSheetsService";

const THAI_MONTHS = [
  { value: "1", label: "มกราคม" },
  { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" },
  { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" },
  { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" },
  { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" },
  { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" },
  { value: "12", label: "ธันวาคม" },
];

interface HeaderProps {
  title: string;
  onFilterChange: (filters: {
    year: string;
    project: string;
    months?: string[];
  }) => void;
  showFilters?: boolean | { projectOnly: true };
  userEmail?: string;
  onLogout?: () => void;
}

export function Header({ title, onFilterChange, showFilters, userEmail, onLogout }: HeaderProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [headRows, setHeadRows] = useState<any[]>([]);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<
    "month" | "year" | "project" | null
  >(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // Load data once
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const headData = await getSheetDataByName("procurement_head");
        setHeadRows(headData.rows);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setHeadRows([]);
      }
    };

    fetchInitialData();
  }, []);

  // Unified filtering engine
  useEffect(() => {
    if (headRows.length === 0) return;

    let filteredRows = [...headRows];

    // Filter by project
    if (selectedProject !== "all") {
      filteredRows = filteredRows.filter(
        (row) =>
          String(
            row.Project || row.projectCode || row["Project Code"] || "",
          ) === selectedProject,
      );
    }

    // Filter by year
    if (selectedYear !== "all") {
      filteredRows = filteredRows.filter((row) => {
        const dateStr = row.Date || row.date || row["DATE"];
        if (dateStr) {
          let year = new Date(dateStr).getFullYear();
          if (year < 2400) year += 543;
          return year.toString() === selectedYear;
        }
        return false;
      });
    }

    // Filter by months
    if (selectedMonths.length > 0) {
      filteredRows = filteredRows.filter((row) => {
        const dateStr = row.Date || row.date || row["DATE"];
        if (dateStr) {
          const month = (new Date(dateStr).getMonth() + 1).toString();
          return selectedMonths.includes(month);
        }
        return false;
      });
    }

    // Derive available projects from filtered rows
    const uniqueProjects = new Set(
      filteredRows
        .map((row) =>
          String(row.Project || row.projectCode || row["Project Code"] || ""),
        )
        .filter((p) => p && p.trim() !== ""),
    );
    const projectList = Array.from(uniqueProjects).sort();

    // Derive available years from filtered rows
    const uniqueYears = new Set(
      filteredRows
        .map((row) => {
          const dateStr = row.Date || row.date || row["DATE"];
          if (dateStr) {
            let year = new Date(dateStr).getFullYear();
            if (year < 2400) year += 543;
            return year.toString();
          }
          return null;
        })
        .filter((year) => year !== null),
    );
    const yearList = Array.from(uniqueYears) as string[];

    // Derive available months from filtered rows
    const uniqueMonths = new Set(
      filteredRows
        .map((row) => {
          const dateStr = row.Date || row.date || row["DATE"];
          if (dateStr) {
            return (new Date(dateStr).getMonth() + 1).toString();
          }
          return null;
        })
        .filter((month) => month !== null),
    );
    const monthList = Array.from(uniqueMonths) as string[];

    // Update dropdown options
    setProjects(projectList);
    setAvailableYears(yearList.sort((a, b) => parseInt(b) - parseInt(a)));

    // Check if selected values are still valid and reset if necessary
    if (selectedProject !== "all" && !projectList.includes(selectedProject)) {
      setSelectedProject("all");
      onFilterChange({
        year: selectedYear,
        project: "all",
        months: selectedMonths,
      });
    }

    if (selectedYear !== "all" && !yearList.includes(selectedYear)) {
      setSelectedYear("all");
      onFilterChange({
        year: "all",
        project: selectedProject,
        months: selectedMonths,
      });
    }

    // Filter selected months to only include available months
    const validSelectedMonths = selectedMonths.filter((month) =>
      monthList.includes(month),
    );
    if (validSelectedMonths.length !== selectedMonths.length) {
      setSelectedMonths(validSelectedMonths);
      onFilterChange({
        year: selectedYear,
        project: selectedProject,
        months: validSelectedMonths,
      });
    }
  }, [selectedYear, selectedProject, selectedMonths, headRows]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    onFilterChange({ year, project: selectedProject, months: selectedMonths });
  };

  const handleProjectChange = (project: string) => {
    setSelectedProject(project);
    onFilterChange({ year: selectedYear, project, months: selectedMonths });
  };

  const handleMonthChange = (months: string[]) => {
    setSelectedMonths(months);
    onFilterChange({ year: selectedYear, project: selectedProject, months });
  };

  const toggleMonth = (monthValue: string) => {
    const newMonths = selectedMonths.includes(monthValue)
      ? selectedMonths.filter((m) => m !== monthValue)
      : [...selectedMonths, monthValue];
    handleMonthChange(newMonths);
  };

  const removeMonth = (monthValue: string) => {
    const newMonths = selectedMonths.filter((m) => m !== monthValue);
    handleMonthChange(newMonths);
  };

  const getSelectedMonthLabels = () => {
    return selectedMonths.map(
      (monthValue) =>
        THAI_MONTHS.find((m) => m.value === monthValue)?.label || "",
    );
  };

  const getAvailableMonths = () => {
    if (headRows.length === 0) return THAI_MONTHS;

    let filteredRows = [...headRows];

    // Apply same filtering logic as in the main useEffect
    if (selectedProject !== "all") {
      filteredRows = filteredRows.filter(
        (row) =>
          String(
            row.Project || row.projectCode || row["Project Code"] || "",
          ) === selectedProject,
      );
    }

    if (selectedYear !== "all") {
      filteredRows = filteredRows.filter((row) => {
        const dateStr = row.Date || row.date || row["DATE"];
        if (dateStr) {
          let year = new Date(dateStr).getFullYear();
          if (year < 2400) year += 543;
          return year.toString() === selectedYear;
        }
        return false;
      });
    }

    // Get available months from filtered rows
    const availableMonthValues = new Set(
      filteredRows
        .map((row) => {
          const dateStr = row.Date || row.date || row["DATE"];
          if (dateStr) {
            return (new Date(dateStr).getMonth() + 1).toString();
          }
          return null;
        })
        .filter((month) => month !== null),
    );

    return THAI_MONTHS.filter((month) => availableMonthValues.has(month.value));
  };

  const handleClearFilters = () => {
    setSelectedYear("all");
    setSelectedProject("all");
    setSelectedMonths([]);
    onFilterChange({ year: "all", project: "all", months: [] });
  };

  // Close dropdown when clicking outside
  return (
    <div
      ref={headerRef}
      className="h-auto bg-white border-b border-gray-200 sticky top-0 z-40"
    >
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
              {/* Month Filter - only show if not projectOnly */}
              {showFilters === true && (
                <div className="relative" ref={monthDropdownRef}>
                  <button
                    onClick={() =>
                      setActiveDropdown(
                        activeDropdown === "month" ? null : "month",
                      )
                    }
                    className="h-[38px] w-[140px] px-3 py-2 text-sm font-normal border border-gray-300 rounded-lg bg-white text-gray-900 flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <div className="flex items-center gap-1 flex-wrap overflow-hidden">
                      {selectedMonths.length === 0 ? (
                        <span className="text-gray-900">All Months</span>
                      ) : selectedMonths.length === 1 ? (
                        <span className="text-gray-900">
                          {getSelectedMonthLabels()[0]}
                        </span>
                      ) : (
                        <span className="text-gray-900">
                          {selectedMonths.length} Months
                        </span>
                      )}
                    </div>

                    <ChevronDown
                      size={16}
                      className={`text-gray-500 transition-transform ${
                        activeDropdown === "month" ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown */}
                  {activeDropdown === "month" && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="p-2 max-h-64 overflow-y-auto">
                        {getAvailableMonths().map((month) => (
                          <div
                            key={month.value}
                            onClick={() => toggleMonth(month.value)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedMonths.includes(month.value)}
                              onChange={() => {}}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              {month.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      {selectedMonths.length > 0 && (
                        <div className="border-t border-gray-200 p-2">
                          <button
                            onClick={() => {
                              handleMonthChange([]);
                              setActiveDropdown(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            ล้างทั้งหมด
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Year Filter - only show if not projectOnly */}
              {showFilters === true && (
                <div className="relative" ref={yearDropdownRef}>
                  <button
                    onClick={() =>
                      setActiveDropdown(
                        activeDropdown === "year" ? null : "year",
                      )
                    }
                    className="h-[38px] w-[140px] px-3 py-2 text-sm font-normal border border-gray-300 rounded-lg bg-white text-gray-900 flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <span>
                      {selectedYear === "all" ? "All Years" : selectedYear}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-gray-500 transition-transform ${
                        activeDropdown === "year" ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown */}
                  {activeDropdown === "year" && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="p-1 max-h-64 overflow-y-auto">
                        <div
                          onClick={() => {
                            handleYearChange("all");
                            setActiveDropdown(null);
                          }}
                          className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer rounded"
                        >
                          All Years
                        </div>
                        {availableYears.map((year) => (
                          <div
                            key={year}
                            onClick={() => {
                              handleYearChange(year);
                              setActiveDropdown(null);
                            }}
                            className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer rounded"
                          >
                            {year}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Project Filter - always show when filters are enabled */}
              <div className="relative" ref={projectDropdownRef}>
                <button
                  onClick={() =>
                    setActiveDropdown(
                      activeDropdown === "project" ? null : "project",
                    )
                  }
                  className="h-[38px] w-[140px] px-3 py-2 text-sm font-normal border border-gray-300 rounded-lg bg-white text-gray-900 flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <span>
                    {selectedProject === "all"
                      ? "All Projects"
                      : selectedProject}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-500 transition-transform ${
                      activeDropdown === "project" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown */}
                {activeDropdown === "project" && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-1 max-h-64 overflow-y-auto">
                      <div
                        onClick={() => {
                          handleProjectChange("all");
                          setActiveDropdown(null);
                        }}
                        className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer rounded"
                      >
                        All Projects
                      </div>
                      {projects.map((project) => (
                        <div
                          key={project}
                          onClick={() => {
                            handleProjectChange(project);
                            setActiveDropdown(null);
                          }}
                          className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer rounded"
                        >
                          {project}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleClearFilters}
                className="h-[38px] px-3 py-2 text-sm font-normal bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                title="Clear Filter"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          )}

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-semibold text-gray-900 leading-none">
                {userEmail?.split('@')[0] || "User"}
              </span>
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-1">
                {userEmail?.includes('admin') ? 'Administrator' : 'General User'}
              </span>
            </div>
            <div className="relative">
               <button 
                 onClick={() => setShowUserMenu(!showUserMenu)}
                 className="h-9 w-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"
               >
                 <User size={20} />
               </button>
               
               {showUserMenu && (
                 <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                   <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                     <p className="text-xs text-gray-500 font-medium truncate">{userEmail}</p>
                   </div>
                   <button 
                     onClick={onLogout}
                     className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                   >
                     <RotateCcw size={16} className="rotate-90" />
                     <span>Sign Out</span>
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
