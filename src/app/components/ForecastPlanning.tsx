import React, {
  useState,
  useMemo,
  useCallback,
  memo,
  useEffect,
  useRef,
} from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";
import { Calendar, AlertCircle, ChevronDown } from "lucide-react";
import { getTab1Data } from "../../services/googleSheetsService";
import { LoadingState } from "./ui/LoadingState";
import {
  THAI_MONTHS,
  convertToThaiMonth,
  convertToThaiMonthFull,
  getThaiMonthFullByIndex,
} from "../utils/thaiMonthUtils";

// Chart Utils
import { shouldShowYearLabel } from "../../utils/chartAxisUtils";
import { parseNumber, parseDateSafe } from "@/utils/dataParser";

// Business Logic Services
import {
  forecastWeightedMovingAverage,
  generateMovingAverageForecast,
} from "../../services/forecast/forecastModel";
import {
  calculateSeasonalFactors,
  winsorizeSeries,
  MONTHS,
} from "../../services/forecast/seasonality";
import {
  calculateMAPE,
  calculateRMSE,
  calculateTrendSlope,
} from "../../services/forecast/statistics";
import {
  transformSheetData,
  transformProjectBurnRateData,
  createMonthDate,
  MonthlySpend,
  ProjectBurnRateData,
  SheetDataRow,
} from "../../services/forecast/dataTransform";

// TypeScript types for better type safety
// TypeScript types moved to services

// Month name mapping for tooltips (moved outside component to avoid recreation)
const MONTH_MAP: { [key: string]: string } = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

// MONTHS moved to services


// Seasonality logic moved to services

// Recommended file structure improvements implemented

// Forecast model logic moved to services

// SheetDataRow moved to services

// Data validation utilities
const validateSpendingData = (data: MonthlySpend[]): boolean => {
  return data.every(
    (item) =>
      item &&
      typeof item.month === "string" &&
      (item.actual === null || typeof item.actual === "number") &&
      (item.forecast === null || typeof item.forecast === "number"),
  );
};

// Burn rate data transformation moved to services

// Sheet data transformation moved to services

// Generate historical data options from real data
const generateHistoricalOptions = (allData: MonthlySpend[]) => {
  // Clone array before sorting to avoid mutation
  const sortedData = [...allData].sort(
    (a, b) =>
      createMonthDate(a.year, a.month).getTime() -
      createMonthDate(b.year, b.month).getTime(),
  );

  // Get last 12 and 18 months from all data (counting backwards from latest data)
  const last12Months = sortedData.slice(-12);
  const last18Months = sortedData.slice(-18);

  return {
    "12months": last12Months,
    "18months": last18Months,
  };
};

// Generate historical data options from demand data

// Statistics calculation moved to services

// Forecast generation logic moved to services

const ChartContainer = memo(
  ({
    title,
    subtitle,
    children,
    className = "",
    delay = 0,
    headerAction,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
    delay?: number;
    headerAction?: React.ReactNode;
  }) => {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay }}
        className={`bg-white shadow-md rounded-2xl border border-gray-200 p-6 ${className}`}
      >
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">
              {title}
            </h3>
            {subtitle && (
              <p className="text-gray-600 text-sm mt-1">{subtitle}</p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
        <div className="flex-1">{children}</div>
      </motion.div>
    );
  },
);

ChartContainer.displayName = "ChartContainer";

// ============================================================================
// REACT COMPONENT
// ============================================================================

const ForecastPlanning: React.FC = () => {
  const [sheetData, setSheetData] = useState<MonthlySpend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"12months" | "18months">(
    "12months",
  );
  const [loading, setLoading] = useState(true);
  const [projectBurnRateData, setProjectBurnRateData] = useState<
    ProjectBurnRateData[]
  >([]);
  const [selectedProjectBurnRate, setSelectedProjectBurnRate] =
    useState<string>("");
  const [budgetLimit, setBudgetLimit] = useState<string>("");
  const [budgetByProject, setBudgetByProject] = useState<
    Record<string, number>
  >({});
  const [allHeadRows, setAllHeadRows] = useState<any[]>([]);
  const [allProjectsList, setAllProjectsList] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<"project" | null>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("budgetByProject");
      if (stored) {
        setBudgetByProject(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load budgetByProject", e);
    }
  }, []);

  // Fetch data from Google Sheets on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch procurement head data
        const headData = await getTab1Data();
        const transformedHeadData = transformSheetData(headData.rows);
        setSheetData(transformedHeadData);

        // Initialize project list and selection
        const allProjects = Array.from(
          new Set(
            headData.rows.map((row) =>
              String(
                row.Project ||
                  row.projectCode ||
                  row["Project Code"] ||
                  "Default Project",
              ),
            ),
          ),
        ).sort();

        const initialProject = allProjects.includes("P65019")
          ? "P65019"
          : allProjects[0] || "";
        setSelectedProjectBurnRate(initialProject);
        setAllProjectsList(allProjects);
        setAllHeadRows(headData.rows); // Store all rows for reuse

        // Transform project burn rate data for specific project
        const projectRows = headData.rows.filter((row) => {
          const p =
            row.Project ||
            row.projectCode ||
            row["Project Code"] ||
            "Default Project";
          return p === initialProject;
        });

        const burnRate = transformProjectBurnRateData(
          projectRows,
          initialProject,
        );
        setProjectBurnRateData(burnRate);
      } catch (error) {
        console.error("Error fetching sheet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update project burn rate data when selected project changes
  useEffect(() => {
    const updateProjectData = () => {
      if (!selectedProjectBurnRate || allHeadRows.length === 0) return;

      try {
        // Filter stored data for selected project instead of calling API
        const projectRows = allHeadRows.filter((row) => {
          const p = String(
            row.Project ||
              row.projectCode ||
              row["Project Code"] ||
              "Default Project",
          );
          return p === selectedProjectBurnRate;
        });

        const burnRate = transformProjectBurnRateData(
          projectRows,
          selectedProjectBurnRate,
        );
        setProjectBurnRateData(burnRate);
      } catch (error) {
        console.error("Error updating project data:", error);
      }
    };

    updateProjectData();
  }, [selectedProjectBurnRate, allHeadRows]);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!projectDropdownRef.current?.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync input when project changes
  useEffect(() => {
    if (!selectedProjectBurnRate) return;

    const existing = budgetByProject[selectedProjectBurnRate];
    if (existing !== undefined) {
      setBudgetLimit(existing.toString());
    } else {
      setBudgetLimit("");
    }
  }, [selectedProjectBurnRate, budgetByProject]);

  const handleSetBudget = () => {
    if (!selectedProjectBurnRate) return;

    const parsed = parseNumber(budgetLimit);
    if (isNaN(parsed)) return;

    const updated = {
      ...budgetByProject,
      [selectedProjectBurnRate]: parsed,
    };

    setBudgetByProject(updated);

    try {
      localStorage.setItem("budgetByProject", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save budgetByProject", e);
    }
  };

  // Generate historical data options from real data
  const historicalDataOptions = useMemo(() => {
    return generateHistoricalOptions(sheetData);
  }, [sheetData]);

  // Memoized forecast data to prevent duplicate calculations
  const forecastTrainingData = historicalDataOptions[selectedPeriod];

  const forecastData = useMemo(() => {
    if (!forecastTrainingData || forecastTrainingData.length === 0) {
      return [];
    }
    return generateMovingAverageForecast(forecastTrainingData);
  }, [forecastTrainingData]);

  // Memoized category data and forecast

  const spendingData = useMemo(() => {
    const historical = historicalDataOptions[selectedPeriod];
    return [...historical, ...forecastData];
  }, [selectedPeriod, historicalDataOptions, forecastData]);

  // Data validation
  const isDataValid = useMemo(() => {
    return validateSpendingData(spendingData);
  }, [spendingData]);

  const projectsForSelect = useMemo(() => {
    return [...allProjectsList].sort();
  }, [allProjectsList]);

  const projectBurnRatePlotData = useMemo(() => {
    const savedBudget = budgetByProject[selectedProjectBurnRate];

    if (savedBudget !== undefined) {
      return projectBurnRateData.map((item) => ({
        ...item,
        budget: savedBudget,
      }));
    }

    return projectBurnRateData;
  }, [projectBurnRateData, budgetByProject, selectedProjectBurnRate]);

  // Memoized calculations for better performance
  const statistics = useMemo(() => {
    const historicalData = historicalDataOptions[selectedPeriod];
    if (process.env.NODE_ENV === "development") {
      console.log("Debug - Selected period:", selectedPeriod);
      console.log("Debug - Historical data for period:", historicalData);
    }

    const actualValues = historicalData
      .filter((d: MonthlySpend) => d.actual !== null && d.actual > 0)
      .map((d: MonthlySpend) => d.actual as number);

    const forecastValues = forecastData.map((d: any) => d.forecast);

    if (process.env.NODE_ENV === "development") {
      console.log("Debug - Actual values:", actualValues);
    }

    // Guard against invalid data
    if (actualValues.length === 0) {
      return {
        averageSpend: 0,
        totalForecast: 0,
        maxForecast: 0,
        forecastGrowth: 0,
        mape: 0,
        rmse: 0,
      };
    }

    const averageSpend =
      actualValues.length > 0
        ? actualValues.reduce((sum: number, val: number) => sum + val, 0) /
          actualValues.length
        : 0;
    const totalForecast = forecastData.reduce(
      (sum: number, d: any) => sum + d.forecast,
      0,
    );
    const maxForecast = Math.max(...forecastData.map((d: any) => d.forecast));

    // Calculate model accuracy metrics using backtesting
    const mape = calculateMAPE(historicalData);
    const rmse = calculateRMSE(historicalData);

    // Calculate forecast reliability based on coefficient of variation
    const mean =
      actualValues.length > 0
        ? actualValues.reduce((sum: number, val: number) => sum + val, 0) /
          actualValues.length
        : 0;
    const variance =
      actualValues.length > 0
        ? actualValues.reduce(
            (sum: number, val: number) => sum + Math.pow(val - mean, 2),
            0,
          ) / actualValues.length
        : 0;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    let forecastReliability: "High" | "Moderate" | "Low";
    if (coefficientOfVariation > 0.6) {
      forecastReliability = "Low";
    } else if (coefficientOfVariation > 0.3) {
      forecastReliability = "Moderate";
    } else {
      forecastReliability = "High";
    }

    // Calculate growth percentage safely
    const forecastGrowth =
      averageSpend > 0
        ? ((totalForecast / forecastData.length - averageSpend) /
            averageSpend) *
          100
        : 0;

    if (process.env.NODE_ENV === "development") {
      console.log("Statistics Debug:", {
        selectedPeriod,
        averageSpend,
        totalForecast,
        maxForecast,
        forecastGrowth,
        mape,
        rmse,
        actualValuesLength: actualValues.length,
      });
    }

    return {
      averageSpend,
      totalForecast,
      maxForecast,
      forecastGrowth,
      mape,
      rmse,
      forecastReliability,
    };
  }, [selectedPeriod, historicalDataOptions, forecastData]);

  // Memoized callback functions
  const getPeriodLabel = useCallback((period: string) => {
    switch (period) {
      case "12months":
        return "Last 12 Months";
      case "18months":
        return "Last 18 Months";
      default:
        return period;
    }
  }, []);

  const getHistoricalMonths = useCallback((period: string) => {
    switch (period) {
      case "12months":
        return 12;
      case "18months":
        return 18;
      default:
        return 12;
    }
  }, []);

  return (
    <div className="space-y-6">
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Procurement Demand Forecast */}
          <ChartContainer
            title="Procurement Demand Forecast"
            subtitle="Shows historical demand and forecasted future procurement demand"
            delay={0.2}
            className="px-8 pt-6 pb-5"
            headerAction={
              <ul
                className="recharts-default-legend"
                style={{
                  padding: "0px",
                  margin: "0px",
                  textAlign: "center",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "rgb(71, 85, 105)",
                }}
              >
                <li
                  className="recharts-legend-item legend-item-0"
                  style={{ display: "inline-block", marginRight: "10px" }}
                >
                  <svg
                    className="recharts-surface"
                    width="10"
                    height="10"
                    viewBox="0 0 32 32"
                    style={{
                      display: "inline-block",
                      verticalAlign: "middle",
                      marginRight: "4px",
                    }}
                  >
                    <title></title>
                    <desc></desc>
                    <path
                      fill="#3b82f6"
                      cx="16"
                      cy="16"
                      className="recharts-symbols"
                      transform="translate(16, 16)"
                      d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                    ></path>
                  </svg>
                  <span
                    className="recharts-legend-item-text"
                    style={{ color: "rgb(59, 130, 246)" }}
                  >
                    Net Amount
                  </span>
                </li>
                <li
                  className="recharts-legend-item legend-item-1"
                  style={{ display: "inline-block", marginRight: "10px" }}
                >
                  <svg
                    className="recharts-surface"
                    width="10"
                    height="10"
                    viewBox="0 0 32 32"
                    style={{
                      display: "inline-block",
                      verticalAlign: "middle",
                      marginRight: "4px",
                    }}
                  >
                    <title></title>
                    <desc></desc>
                    <path
                      fill="#a855f7"
                      cx="16"
                      cy="16"
                      className="recharts-symbols"
                      transform="translate(16, 16)"
                      d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                    ></path>
                  </svg>
                  <span
                    className="recharts-legend-item-text"
                    style={{ color: "rgb(168, 85, 247)" }}
                  >
                    Forecast Amount
                  </span>
                </li>
              </ul>
            }
          >
            {/* Historical Data Selection */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={18} />
                <span className="text-sm font-medium">Historical Data :</span>
              </div>

              <div className="flex gap-2">
                {["12months", "18months"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period as any)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      selectedPeriod === period
                        ? "bg-blue-600 text-white shadow-md transform scale-105"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {period === "12months"
                      ? "Last 12 Months"
                      : "Last 18 Months"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {(() => {
                // Use procurement spending data from spendingData
                const chartData = spendingData.map((d: any) => {
                  const [mon, yr] = [d.month, d.year];
                  return {
                    ...d,
                    monthLabel: convertToThaiMonth(mon.slice(0, 3)),
                    yearLabel: yr,
                  };
                });

                if (chartData.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="text-gray-400 mb-2">📊</div>
                        <div className="text-sm text-gray-500">
                          No procurement data available
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart
                      data={chartData}
                      margin={{
                        top: 20,
                        right: 40,
                        left: 30,
                        bottom: 20,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e5e7eb"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 20, right: 20 }}
                        stroke="#6b7280"
                        fontSize={12}
                        xAxisId="primary"
                        tickMargin={5}
                        tickFormatter={(value) =>
                          THAI_MONTHS[new Date(value).getMonth()]
                        }
                      />
                      <XAxis
                        dataKey="yearLabel"
                        stroke="#6b7280"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        xAxisId="secondary"
                        orientation="bottom"
                        padding={{ left: 20, right: 20 }}
                        height={10}
                        tick={{ dy: -2 }}
                        interval={0}
                        tickFormatter={(value, index) =>
                          shouldShowYearLabel(chartData, index, "yearLabel")
                        }
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        tickFormatter={(value) => {
                          const numValue = Number(value) || 0;
                          return numValue === 0
                            ? "0k"
                            : `${(numValue / 1000).toLocaleString("en-US", {
                                minimumFractionDigits:
                                  (numValue / 1000) % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}k`;
                        }}
                      />
                      <Tooltip
                        wrapperStyle={{ zIndex: 1000 }}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          fontSize: "16px",
                          lineHeight: "1.5",
                          fontFamily: "inherit",
                          boxShadow:
                            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        }}
                        labelStyle={{
                          fontWeight: 700,
                          color: "#111827",
                          marginBottom: "8px",
                          fontSize: "18px",
                          lineHeight: "1.5",
                        }}
                        itemStyle={{
                          color: "#111827",
                          fontSize: "16px",
                          lineHeight: "1.5",
                          padding: "0px",
                        }}
                        formatter={(
                          value: number,
                          name: string,
                          payload: any,
                        ) => {
                          // Fix tooltip payload crash risk with safe optional chaining
                          const data = payload?.[0]?.payload;

                          if (name === "Forecast Amount" && data) {
                            const forecast = Number(data.forecast) || 0;
                            const low = Number(data.forecast_low) || 0;
                            const high = Number(data.forecast_high) || 0;
                            return [
                              `Forecast: ${forecast.toLocaleString("en-US", {
                                minimumFractionDigits:
                                  forecast % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}`,
                              `Range: ${low.toLocaleString("en-US", {
                                minimumFractionDigits: low % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })} - ${high.toLocaleString("en-US", {
                                minimumFractionDigits: high % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}`,
                            ];
                          }

                          const numValue = Number(value) || 0;
                          return [
                            `${numValue.toLocaleString("en-US", {
                              minimumFractionDigits: numValue % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })}`,
                            name,
                          ];
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload?.[0]) {
                            const date = new Date(label);
                            const thaiMonth = getThaiMonthFullByIndex(
                              date.getMonth(),
                            );
                            const year = date.getFullYear();
                            return `${thaiMonth} ${year}`;
                          }
                          return label;
                        }}
                      />
                      <Area
                        dataKey="forecast_high"
                        stroke="none"
                        fill="#a855f7"
                        fillOpacity={0.15}
                      />
                      <Area
                        dataKey="forecast_low"
                        stroke="none"
                        fill="#ffffff"
                        fillOpacity={1}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{
                          fill: "#3b82f6",
                          r: 4,
                          strokeWidth: 2,
                          stroke: "#fff",
                        }}
                        activeDot={{
                          r: 5,
                          fill: "#3b82f6",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        animationDuration={1500}
                        xAxisId="primary"
                        name="Net Amount"
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        strokeDasharray="8 4"
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: "#a855f7",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        animationDuration={1500}
                        xAxisId="primary"
                        name="Forecast Amount"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </ChartContainer>

          {/* Project Budget Burn Rate Chart */}
          <ChartContainer
            title="Project Budget Burn Rate"
            subtitle="Tracks cumulative project spending against the budget limit"
            delay={0.6}
            className="px-8 pt-6 pb-5"
            headerAction={
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">
                    Project :
                  </span>
                  <div className="relative" ref={projectDropdownRef}>
                    <button
                      onClick={() =>
                        setActiveDropdown(
                          activeDropdown === "project" ? null : "project",
                        )
                      }
                      className="h-[38px] w-[100px] px-3 py-2 text-sm font-normal border border-gray-300 rounded-lg bg-white text-gray-900 flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <span className="truncate">
                        {selectedProjectBurnRate || "Select Project"}
                      </span>

                      <ChevronDown
                        size={16}
                        className={`text-gray-500 transition-transform ${
                          activeDropdown === "project" ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {activeDropdown === "project" && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="p-1 max-h-64 overflow-y-auto">
                          {projectsForSelect.map((p) => (
                            <div
                              key={p}
                              onClick={() => {
                                setSelectedProjectBurnRate(p);
                                setActiveDropdown(null);
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer rounded hover:bg-gray-50 ${
                                selectedProjectBurnRate === p
                                  ? "bg-blue-50 text-blue-600 font-medium"
                                  : ""
                              }`}
                            >
                              {p}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">
                    Budget Limit :
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={budgetLimit}
                      onChange={(e) => setBudgetLimit(e.target.value)}
                      placeholder="Auto-calculate"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all w-32"
                    />
                    <button
                      onClick={handleSetBudget}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      SET
                    </button>
                  </div>
                </div>

                <ul
                  className="recharts-default-legend"
                  style={{
                    padding: "0px",
                    margin: "0px",
                    textAlign: "center",
                    fontSize: "16px",
                    fontWeight: "400",
                    color: "rgb(71, 85, 105)",
                  }}
                >
                  <li
                    className="recharts-legend-item legend-item-0"
                    style={{ display: "inline-block", marginRight: "10px" }}
                  >
                    <svg
                      className="recharts-surface"
                      width="10"
                      height="10"
                      viewBox="0 0 32 32"
                      style={{
                        display: "inline-block",
                        verticalAlign: "middle",
                        marginRight: "4px",
                      }}
                    >
                      <path
                        fill="#3b82f6"
                        cx="16"
                        cy="16"
                        className="recharts-symbols"
                        transform="translate(16, 16)"
                        d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                      ></path>
                    </svg>
                    <span
                      className="recharts-legend-item-text"
                      style={{ color: "rgb(59, 130, 246)" }}
                    >
                      Cumulative Spend
                    </span>
                  </li>
                  <li
                    className="recharts-legend-item legend-item-1"
                    style={{ display: "inline-block", marginRight: "10px" }}
                  >
                    <svg
                      className="recharts-surface"
                      width="10"
                      height="10"
                      viewBox="0 0 32 32"
                      style={{
                        display: "inline-block",
                        verticalAlign: "middle",
                        marginRight: "4px",
                      }}
                    >
                      <path
                        fill="#ef4444"
                        cx="16"
                        cy="16"
                        className="recharts-symbols"
                        transform="translate(16, 16)"
                        d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                      ></path>
                    </svg>
                    <span
                      className="recharts-legend-item-text"
                      style={{ color: "#ef4444" }}
                    >
                      Budget Limit
                    </span>
                  </li>
                </ul>
              </div>
            }
          >
            <div className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={projectBurnRatePlotData}
                  margin={{ top: 20, right: 40, left: 30, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickFormatter={(value) => {
                      const numValue = Number(value) || 0;
                      return numValue === 0
                        ? "0k"
                        : `${(numValue / 1000).toLocaleString("en-US", {
                            minimumFractionDigits:
                              (numValue / 1000) % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}k`;
                    }}
                  />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    stroke="#6b7280"
                    fontSize={12}
                    xAxisId="primary"
                    padding={{ left: 20, right: 20 }}
                    tickMargin={5}
                  />
                  <XAxis
                    dataKey="yearLabel"
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    xAxisId="secondary"
                    orientation="bottom"
                    padding={{ left: 20, right: 20 }}
                    height={10}
                    tick={{ dy: -2 }}
                    interval={0}
                    tickFormatter={(value, index) =>
                      shouldShowYearLabel(
                        projectBurnRatePlotData,
                        index,
                        "yearLabel",
                      )
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontSize: "16px",
                      lineHeight: "1.5",
                      fontFamily: "inherit",
                      boxShadow:
                        "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    }}
                    labelStyle={{
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: "8px",
                      fontSize: "18px",
                      lineHeight: "1.5",
                    }}
                    itemStyle={{
                      color: "#111827",
                      fontSize: "16px",
                      lineHeight: "1.5",
                      padding: "0px",
                    }}
                    formatter={(value: number, name: string) => {
                      const numValue = Number(value) || 0;
                      return [
                        `${numValue.toLocaleString("en-US", {
                          minimumFractionDigits: numValue % 1 === 0 ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}`,
                        name,
                      ];
                    }}
                    labelFormatter={(label: any, payload: any) => {
                      const thaiMonthFull = convertToThaiMonthFull(label);
                      const year = payload?.[0]?.payload?.year || "";
                      return `${thaiMonthFull} ${year}`;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative_spend"
                    name="Cumulative Spend"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#3b82f6",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    animationDuration={2000}
                    xAxisId="primary"
                  />
                  <Line
                    type="stepAfter"
                    dataKey="budget"
                    name="Budget Limit"
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    animationDuration={1000}
                    xAxisId="primary"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {projectBurnRatePlotData.length > 0 &&
              (() => {
                const currentData =
                  projectBurnRatePlotData[projectBurnRatePlotData.length - 1];
                const totalSpend = projectBurnRatePlotData.reduce(
                  (sum, d) => sum + (Number(d.monthly_spend) || 0),
                  0,
                );
                const numberOfMonths = projectBurnRatePlotData.length;
                const averageSpend = totalSpend / numberOfMonths;

                // Calculate project duration dynamically
                const projectStartDate = projectBurnRatePlotData[0].date;
                const currentDate = currentData.date;

                // Estimate project duration (fallback: historical data span * 1.5)
                const projectDurationMonths = Math.ceil(numberOfMonths * 1.5);
                const projectEndDate = new Date(projectStartDate);
                projectEndDate.setMonth(
                  projectEndDate.getMonth() + projectDurationMonths,
                );

                // Calculate remaining months
                const remainingMonths = Math.max(
                  0,
                  (projectEndDate.getFullYear() - currentDate.getFullYear()) *
                    12 +
                    (projectEndDate.getMonth() - currentDate.getMonth()),
                );

                const projectedSpend =
                  currentData.cumulative_spend + averageSpend * remainingMonths;

                return (
                  projectedSpend > (Number(currentData.budget) || 0) &&
                  (Number(currentData.cumulative_spend) || 0) <=
                    (Number(currentData.budget) || 0)
                );
              })() && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 text-orange-700">
                  <AlertCircle className="w-5 h-5 text-orange-600 animate-pulse" />
                  <span className="text-sm font-semibold">
                    Budget Overrun Risk : Project spending may exceed the
                    defined budget.
                  </span>
                </div>
              )}
            {projectBurnRatePlotData.length > 0 &&
              projectBurnRatePlotData[projectBurnRatePlotData.length - 1]
                .cumulative_spend >
                (Number(
                  projectBurnRatePlotData[projectBurnRatePlotData.length - 1]
                    .budget,
                ) || 0) && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />
                  <span className="text-sm font-semibold">
                    Budget Limit Exceeded : Project spending has surpassed the
                    defined budget.
                  </span>
                </div>
              )}
          </ChartContainer>
        </>
      )}
    </div>
  );
};

export default ForecastPlanning;
