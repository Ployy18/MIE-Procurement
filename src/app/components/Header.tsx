import React, { useState, useEffect } from "react";
import {
  User,
  ChevronDown,
  RotateCcw,
  Search,
  Bell,
  Settings,
} from "lucide-react";
import { getSheetDataByName } from "../../services/googleSheetsService";

interface HeaderProps {
  title: string;
  onFilterChange: (filters: { year: string; project: string }) => void;
  showFilters?: boolean | { projectOnly: true };
}

export function Header({ title, onFilterChange, showFilters }: HeaderProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const headData = await getSheetDataByName("procurement_head");

        // Initial unique projects
        const uniqueProjects = new Set(
          headData.rows
            .map((row) => String(row.Project || row.projectCode || row["Project Code"] || ""))
            .filter((project) => project && project.trim() !== ""),
        );
        const projectList = Array.from(uniqueProjects).sort();
        setProjects(projectList);

        // Initial unique years
        const uniqueYears = new Set(
          headData.rows
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
        setAvailableYears(yearList.sort((a, b) => parseInt(b) - parseInt(a)));
      } catch (error) {
        console.error("Error fetching initial filter data:", error);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const filterOptions = async () => {
      try {
        const headData = await getSheetDataByName("procurement_head");
        let filteredRows = headData.rows;

        // If a year is selected, filter project list
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

        const uniqueProjects = new Set(
          filteredRows
            .map((row) => String(row.Project || row.projectCode || row["Project Code"] || ""))
            .filter((p) => p && p.trim() !== ""),
        );
        const projectList = Array.from(uniqueProjects).sort();
        setProjects(projectList);

        // Check if selected project is still valid in these projects
        if (selectedProject !== "all" && !projectList.includes(selectedProject)) {
          setSelectedProject("all");
          onFilterChange({ year: selectedYear, project: "all" });
        }
      } catch (error) {
        console.error("Error filtering project options:", error);
      }
    };

    if (selectedYear !== "all") {
      filterOptions();
    } else {
      // If no year selected, reset projects to all possible projects
      const resetProjects = async () => {
        const headData = await getSheetDataByName("procurement_head");
        const uniqueProjects = new Set(
          headData.rows
            .map((row) => String(row.Project || row.projectCode || row["Project Code"] || ""))
            .filter((p) => p && p.trim() !== ""),
        );
        setProjects(Array.from(uniqueProjects).sort());
      };
      resetProjects();
    }
  }, [selectedYear]);

  useEffect(() => {
    const filterOptions = async () => {
      try {
        const headData = await getSheetDataByName("procurement_head");
        let filteredRows = headData.rows;

        // If a project is selected, filter year list
        if (selectedProject !== "all") {
          filteredRows = filteredRows.filter(
            (row) => String(row.Project || row.projectCode || row["Project Code"] || "") === selectedProject
          );
        }

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
            .filter((y) => y !== null)
        );
        const yearList = Array.from(uniqueYears) as string[];
        setAvailableYears(yearList.sort((a, b) => parseInt(b) - parseInt(a)));

        // Check if selected year is still valid
        if (selectedYear !== "all" && !yearList.includes(selectedYear)) {
          setSelectedYear("all");
          onFilterChange({ year: "all", project: selectedProject });
        }
      } catch (error) {
        console.error("Error filtering year options:", error);
      }
    };

    if (selectedProject !== "all") {
      filterOptions();
    } else {
      // Reset years if no project selected
      const resetYears = async () => {
        const headData = await getSheetDataByName("procurement_head");
        const uniqueYears = new Set(
          headData.rows
            .map((row) => {
              const dateStr = row.Date || row.date || row["DATE"];
              if (dateStr) {
                let year = new Date(dateStr).getFullYear();
                if (year < 2400) year += 543;
                return year.toString();
              }
              return null;
            })
            .filter((y) => y !== null)
        );
        const yearList = Array.from(uniqueYears) as string[];
        setAvailableYears(yearList.sort((a, b) => parseInt(b) - parseInt(a)));
      };
      resetYears();
    }
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
        </div>
      </div>
    </div>
  );
}
