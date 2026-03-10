import React, { useState, useMemo, useCallback, memo, useEffect } from "react";
import { motion } from "framer-motion";
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
  AreaChart,
  Area,
} from "recharts";
import { Calendar, AlertCircle } from "lucide-react";
import {
  getTab1Data,
  getProcurementLineData,
} from "../../services/googleSheetsService";
import { LoadingState } from "./ui/LoadingState";

// TypeScript types for better type safety
type MonthlySpend = {
  month: string;
  year: string;
  date: number; // Use timestamp for compatibility
  actual: number | null;
  forecast: number | null;
};

type MonthlyCategory = {
  month: string;
  year: string;
  date: number; // Use timestamp for compatibility
} & Record<string, string | number | undefined>;

type ProcurementLineData = {
  month: string;
  year: string;
  date: number; // Use timestamp for compatibility
  totalQuantity: number;
  totalAmount: number;
} & Record<string, number | undefined>;

interface ProjectBurnRateData {
  month: string;
  year: string;
  monthLabel: string;
  yearLabel: string;
  date: Date;
  monthly_spend: number;
  cumulative_spend: number;
  budget: number;
  project: string;
}

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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Reusable helper function for parsing numeric values from Google Sheets
function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const clean =
    typeof value === "string"
      ? value.replace(/,/g, "").trim()
      : String(value).trim();
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Reusable helper function for winsorization using IQR method
function winsorizeSeries(values: number[]): number[] {
  if (values.length < 12) return values; // Not enough data for meaningful winsorization

  const sortedValues = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sortedValues.length * 0.25);
  const q3Index = Math.floor(sortedValues.length * 0.75);
  const q1 = sortedValues[q1Index];
  const q3 = sortedValues[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Cap extreme values instead of removing them
  return values.map((v) => Math.min(Math.max(v, lowerBound), upperBound));
}

// Reusable helper function for calculating seasonal factors
function calculateSeasonalFactors(
  series: { month: string; value: number }[],
): Record<string, number> {
  if (series.length < 24) {
    // Return neutral factors for insufficient data - need at least 2 years for seasonal patterns
    const factors: Record<string, number> = {};
    MONTHS.forEach((m) => {
      factors[m] = 1.0;
    });
    return factors;
  }

  // Compute 6-month moving averages (including current observation)
  const movingAverages: number[] = [];
  for (let i = 5; i < series.length; i++) {
    const window = series.slice(i - 5, i + 1).map((d) => d.value);
    const ma = window.reduce((sum, val) => sum + val, 0) / 6;
    movingAverages.push(ma);
  }

  // Calculate seasonal ratios: actual / movingAverage
  const monthlyRatios: Record<string, number[]> = {};
  series.forEach((d, index) => {
    if (index >= 5 && index < series.length) {
      const movingAverage = movingAverages[index - 5];
      if (movingAverage <= 0) return; // Prevent divide-by-zero

      const month = d.month;
      const actual = d.value;
      const ratio = actual / movingAverage;

      if (!monthlyRatios[month]) {
        monthlyRatios[month] = [];
      }
      monthlyRatios[month].push(ratio);
    }
  });

  // Average ratios per month to obtain seasonal factor
  const seasonalFactors: Record<string, number> = {};
  MONTHS.forEach((month) => {
    const ratios = monthlyRatios[month] || [];
    if (ratios.length > 0) {
      seasonalFactors[month] =
        ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    } else {
      seasonalFactors[month] = 1.0;
    }
  });

  // Normalize seasonal factors so that the sum equals 12
  const sumOfFactors = Object.values(seasonalFactors).reduce(
    (sum, factor) => sum + factor,
    0,
  );
  if (sumOfFactors > 0) {
    Object.keys(seasonalFactors).forEach((month) => {
      seasonalFactors[month] = (seasonalFactors[month] * 12) / sumOfFactors;
    });
  }

  // Clamp factors between 0.6 and 1.4 for reduced volatility
  Object.keys(seasonalFactors).forEach((month) => {
    seasonalFactors[month] = Math.max(
      0.6,
      Math.min(1.4, seasonalFactors[month]),
    );
  });

  return seasonalFactors;
}

// ============================================================================
// RECOMMENDED FILE STRUCTURE IMPROVEMENTS
// ============================================================================
//
// The following utilities could be extracted into separate modules:
//
// 1. forecastUtils.ts:
//    - forecastWeightedMovingAverage
//    - calculateTrendSlope
//    - winsorizeSeries
//    - calculateSeasonalFactors
//
// 2. dataTransform.ts:
//    - transformProcurementLineData
//    - transformSheetData
//    - transformCategoryData
//    - transformProjectBurnRateData
//    - parseNumber
//
// 3. statistics.ts:
//    - calculateMAPE
//    - calculateRMSE
//    - validateSpendingData
//    - generateHistoricalOptions
//
// 4. categorization.ts:
//    - CATEGORY_RULES
//    - categorizeItemCode
//
// This would improve maintainability and make the main component more focused.
// ============================================================================

// Configuration-based item code categorization for better maintainability
const CATEGORY_RULES: Record<string, string[]> = {
  CCTV: ["CAMERA", "DVR", "NVR", "P-CAMERA", "P-NVR"],
  Storage: ["HDD", "SSD"],
  Network: ["SWITCH", "P-SWITCH", "LAN", "SFP"],
  "Power & Electrical": ["POWER", "POWERSUP", "THW", "VCT", "NYY"],
  "Installation Material": ["ACCS", "BNC", "CLAMP"],
  "Office Supply": ["TONER"],
  "IT Device": ["P-PHONE", "P-IPAD", "SERVER"],
  Software: ["P-SOFTWARE"],
  "Service Operation": ["SVSUB"],
  "Other Expense": ["SVOTHER"],
  Finance: ["SV150100"],
};

// Function to categorize Item Codes based on procurement patterns
const categorizeItemCode = (code: string): string => {
  if (!code) return "Uncategorized";

  const upperCode = code.toUpperCase();

  // Loop through category rules for efficient matching
  for (const [category, prefixes] of Object.entries(CATEGORY_RULES)) {
    if (prefixes.some((prefix) => upperCode.startsWith(prefix))) {
      return category;
    }
  }

  return "Uncategorized";
};
// DATA TRANSFORMATION FUNCTIONS
// ============================================================================

interface SheetDataRow {
  Date?: string;
  "Total Amount"?: string | number;
  [key: string]: any;
}

interface LineDataRow {
  Date?: string;
  "Item Code"?: string;
  Quantity?: string | number;
  "Total Amount"?: string | number;
  [key: string]: any;
}

// Transform procurement line data to forecast format
const transformProcurementLineData = (
  lineData: LineDataRow[],
): ProcurementLineData[] => {
  // Group by month-year and category
  const monthlyCategoryData = lineData.reduce(
    (
      acc: Record<string, Record<string, { quantity: number; amount: number }>>,
      row,
    ) => {
      const dateStr = row.Date;
      const itemCode = row["Item Code"] || "";

      const quantity = parseNumber(row.Quantity);
      const amount = parseNumber(row["Total Amount"]);

      if (!dateStr) return acc;

      const date = new Date(`${dateStr}T00:00:00`);
      const year = date.getFullYear().toString();
      const month = MONTHS[date.getMonth()];
      const monthYearKey = `${year}-${month}`;

      const category = categorizeItemCode(itemCode);

      if (!acc[monthYearKey]) {
        acc[monthYearKey] = {};
      }

      if (!acc[monthYearKey][category]) {
        acc[monthYearKey][category] = { quantity: 0, amount: 0 };
      }

      acc[monthYearKey][category].quantity += quantity;
      acc[monthYearKey][category].amount += amount;

      return acc;
    },
    {},
  );

  // Convert to array format and create continuous timeline
  const monthEntries = Object.entries(monthlyCategoryData);
  if (monthEntries.length === 0) return [];

  // Sort chronologically using proper Date sorting
  monthEntries.sort((a, b) => {
    const [year1, month1] = a[0].split("-");
    const [year2, month2] = b[0].split("-");

    const date1 = createMonthDate(year1, month1);
    const date2 = createMonthDate(year2, month2);

    return date1.getTime() - date2.getTime();
  });

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const firstMonthIndex = Math.max(0, MONTHS.indexOf(firstMonth));
  const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

  const result: ProcurementLineData[] = [];
  let currentDate = createMonthDate(firstYear, firstMonth);
  const endDate = createMonthDate(lastYear, lastMonth);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear().toString();
    const month = MONTHS[currentDate.getMonth()];
    const monthYearKey = `${year}-${month}`;
    const categoryData = monthlyCategoryData[monthYearKey] || {};

    // Calculate total quantity and amount for the month
    let totalQuantity = 0;
    let totalAmount = 0;

    Object.values(categoryData).forEach((data) => {
      totalQuantity += data.quantity;
      totalAmount += data.amount;
    });

    const monthData: Record<string, number | string | undefined> = {
      month: month,
      year: year,
      date: new Date(currentDate).getTime(),
      totalQuantity,
      totalAmount,
    };

    // Add category-specific data
    Object.entries(categoryData).forEach(([category, data]) => {
      monthData[category] = data.amount;
    });

    result.push(monthData as ProcurementLineData);

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};

// ============================================================================
// FORECAST UTILITIES
// ============================================================================

// Calculate trend slope using linear regression for stable trend estimation
const calculateTrendSlope = (values: number[]): number => {
  if (values.length < 2) return 0;

  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;

  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate covariance and variance
  let covariance = 0;
  let variance = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = y[i] - yMean;
    covariance += xDiff * yDiff;
    variance += xDiff * xDiff;
  }

  // Prevent division by zero
  if (variance === 0) return 0;

  const slope = covariance / variance;

  // Prevent extreme trend amplification
  const historicalMean = yMean;
  const maxSlope = historicalMean * 0.2;

  return Math.max(-maxSlope, Math.min(maxSlope, slope));
};

// Shared forecasting utility function for consistent model across the system
interface ForecastOptions {
  horizon?: number;
  seasonalFactors?: Record<string, number>;
  lastMonth?: string;
  lastYear?: number;
  enableSeasonality?: boolean;
}

const forecastWeightedMovingAverage = (
  data: number[],
  options: ForecastOptions = {},
): number[] => {
  const {
    horizon = 6,
    seasonalFactors = {},
    lastMonth = "Dec",
    lastYear = new Date().getFullYear(),
    enableSeasonality = true,
  } = options;

  // Sanitize input data to remove invalid values
  const cleanData = data.filter((v) => Number.isFinite(v));

  if (cleanData.length < 6) {
    // Fallback to simple growth for insufficient data
    const lastValue =
      cleanData.length > 0
        ? Math.max(...cleanData.filter((v) => !isNaN(v) && v > 0))
        : 100000;
    const growthRate = 0.05; // 5% default growth
    const forecasts: number[] = [];

    for (let i = 1; i <= horizon; i++) {
      const forecastValue = lastValue * Math.pow(1 + growthRate, i);
      forecasts.push(
        Math.max(0, !isNaN(forecastValue) ? forecastValue : lastValue),
      );
    }

    return forecasts;
  }

  const weights = [0.35, 0.25, 0.18, 0.12, 0.07, 0.03];
  const forecasts: number[] = [];
  let rollingWindow = [...cleanData];

  for (let i = 1; i <= horizon; i++) {
    // Adaptive window size based on available historical data
    let windowSize = 6;
    if (rollingWindow.length >= 24) {
      windowSize = 12;
    } else if (rollingWindow.length >= 18) {
      windowSize = 9;
    } else if (rollingWindow.length >= 12) {
      windowSize = 8;
    }

    const windowValues = rollingWindow.slice(
      Math.max(rollingWindow.length - windowSize, 0),
    );

    if (windowValues.length < 6) {
      // Use fallback logic to maintain forecast horizon
      const fallback = rollingWindow[rollingWindow.length - 1] || 0;
      forecasts.push(Math.max(0, fallback));
      rollingWindow.push(fallback);
      continue;
    }

    // Apply 6-month weighted moving average (explicitly use last 6 observations)
    const effectiveWindow = windowValues.slice(-6);
    const baseForecast = weights.reduce(
      (sum, weight, j) =>
        sum + effectiveWindow[effectiveWindow.length - 1 - j] * weight,
      0,
    );

    // Add trend adjustment using linear regression slope with increased responsiveness
    const trendSlope = calculateTrendSlope(windowValues);
    const trendWeight = Math.min(0.4, 2 / windowValues.length);
    const trendAdjustedForecast = baseForecast + trendSlope * trendWeight;

    // Apply seasonal factor only if enabled and sufficient data
    let seasonalFactor = 1.0;
    if (enableSeasonality) {
      const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));
      const forecastMonthIndex = (lastMonthIndex + i) % 12;
      const forecastMonth = MONTHS[forecastMonthIndex];

      // Get seasonal factor with bounds checking
      const rawSeasonalFactor = seasonalFactors[forecastMonth] || 1.0;
      seasonalFactor = Math.max(0.6, Math.min(1.4, rawSeasonalFactor));
    }

    const seasonalForecast = trendAdjustedForecast * seasonalFactor;

    // Clamp extreme spikes with volatility-adaptive bounds
    const historicalAvg =
      cleanData.reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0) /
      cleanData.length;

    // Stabilize volatility calculation by filtering zero values
    const positiveValues = cleanData.filter((v) => v > 0);
    const minValue =
      positiveValues.length > 0 ? Math.min(...positiveValues) : 1;

    const volatility =
      cleanData.length > 1 ? Math.max(...cleanData) / Math.max(1, minValue) : 1;

    const maxAllowed = historicalAvg * Math.min(4, 2 + volatility);

    const clampedForecast = Math.max(
      0,
      seasonalForecast > maxAllowed
        ? historicalAvg * (1.8 + volatility * 0.2)
        : seasonalForecast,
    );

    const forecastValue = Math.max(
      0,
      Math.round(!isNaN(clampedForecast) ? clampedForecast : historicalAvg),
    );

    // Ensure forecast value is finite before pushing
    const safeForecastValue = Number.isFinite(forecastValue)
      ? forecastValue
      : 0;
    forecasts.push(safeForecastValue);

    // Add forecast to rolling window for next iteration
    rollingWindow.push(safeForecastValue);
  }

  if (process.env.NODE_ENV === "development") {
    // Calculate final window size for logging
    let finalWindowSize = 6;
    if (cleanData.length >= 24) {
      finalWindowSize = 12;
    } else if (cleanData.length >= 18) {
      finalWindowSize = 9;
    } else if (cleanData.length >= 12) {
      finalWindowSize = 8;
    }

    console.log("[Forecast Debug]", {
      dataLength: cleanData.length,
      windowSize: finalWindowSize,
      seasonalityEnabled: enableSeasonality,
    });

    console.log("[Forecast Model]", {
      model: "WeightedMovingAverage",
      window: finalWindowSize,
      weights,
      seasonality: enableSeasonality,
    });
  }

  return forecasts;
};

// Generate monthly expense forecast using shared weighted moving average
const generateMonthlyExpenseForecast = (
  historicalData: ProcurementLineData[],
): ProcurementLineData[] => {
  // Extract total amounts without filtering zeros
  const values = historicalData.map((d) => d.totalAmount || 0);

  if (values.length < 3) {
    const lastValue = values.length > 0 ? Math.max(...values) : 100000;
    const firstValue =
      values.length > 1 ? Math.min(...values.filter((v) => v > 0)) : lastValue;
    const n = values.length > 1 ? values.length - 1 : 1;

    // Calculate CAGR: (last/first)^(1/n) - 1
    const cagr =
      firstValue > 0 ? Math.pow(lastValue / firstValue, 1 / n) - 1 : 0.05;
    const growthRate = Math.max(0.01, Math.min(0.5, cagr)); // Clamp between 1% and 50%

    // Generate 6 months of CAGR-based fallback forecast (updated from 3)
    const lastYear = Number(
      historicalData[historicalData.length - 1]?.year ||
        new Date().getFullYear(),
    );
    const lastMonth = historicalData[historicalData.length - 1]?.month || "Dec";
    const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

    const fallbackForecast = [];
    for (let i = 1; i <= 6; i++) {
      const forecastValue = lastValue * Math.pow(1 + growthRate, i);
      const monthIndex = (lastMonthIndex + i) % 12;
      const yearOffset = Math.floor((lastMonthIndex + i) / 12);
      const forecastYear = (lastYear + yearOffset).toString();

      fallbackForecast.push({
        month: MONTHS[monthIndex],
        year: forecastYear,
        date: new Date(parseInt(forecastYear), monthIndex, 1).getTime(),
        totalQuantity: 0,
        totalAmount: Math.round(forecastValue),
      } as any);
    }

    return fallbackForecast;
  }

  // Use shared forecasting utility for consistent model with seasonal factors
  if (!historicalData.length) return [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;

  // Calculate seasonal factors using shared helper
  const seriesData = historicalData.map((d) => ({
    month: d.month,
    value: d.totalAmount || 0,
  }));
  const seasonalFactors = calculateSeasonalFactors(seriesData);

  const forecasts = forecastWeightedMovingAverage(values, {
    horizon: 6,
    seasonalFactors,
    lastMonth,
    lastYear,
    enableSeasonality: historicalData.length >= 24, // Align with seasonal factor calculation requirements
  });

  // Convert forecasts back to ProcurementLineData format
  const forecastData: ProcurementLineData[] = [];
  const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

  forecasts.forEach((forecastValue, i) => {
    const monthIndex = (lastMonthIndex + i + 1) % 12;
    const yearOffset = Math.floor((lastMonthIndex + i + 1) / 12);
    const forecastYear = (lastYear + yearOffset).toString();

    // Ensure forecast value is finite before pushing
    const safeForecastValue = Number.isFinite(forecastValue)
      ? forecastValue
      : 0;

    forecastData.push({
      month: MONTHS[monthIndex],
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1).getTime(),
      totalQuantity: 0,
      totalAmount: safeForecastValue,
    } as any);
  });

  return forecastData;
};

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

// Transform project-wise burn rate data (cumulative spend vs budget)
const transformProjectBurnRateData = (
  sheetData: SheetDataRow[],
  selectedProject: string,
): ProjectBurnRateData[] => {
  const monthGroups: Record<
    string,
    { month: string; year: string; date: Date; monthly_spend: number }
  > = {};

  // Debug metrics
  const totalRows = sheetData.length;
  let totalAmountBefore = 0;

  sheetData.forEach((row) => {
    // 1. Parse Total Amount: remove commas and whitespace
    const amountStrRaw = String(row["Total Amount"] || "0");
    const amountStrClean = amountStrRaw.replace(/,/g, "").trim();
    const amount = parseFloat(amountStrClean);

    // 2. Handle Date parsing and conversion
    const dateStr = row.Date;
    if (!dateStr || isNaN(amount) || amount <= 0) return;

    totalAmountBefore += amount;

    let date: Date;
    if (typeof dateStr === "string" && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        let year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        if (year > 2400) year -= 543; // Buddhist to Gregorian
        date = new Date(year, month, day);
      } else {
        date = new Date(`${dateStr}T00:00:00`);
      }
    } else {
      date = new Date(`${dateStr}T00:00:00`);
      if (date && date.getFullYear() > 2400) {
        date.setFullYear(date.getFullYear() - 543);
      }
    }

    if (!date || isNaN(date.getTime())) return;

    const year = date.getFullYear().toString();
    const displayYear = (date.getFullYear() + 543).toString();
    const month = MONTHS[date.getMonth()];
    const monthYearKey = `${year}-${month}`;

    // 3. Grouping by month
    if (!monthGroups[monthYearKey]) {
      monthGroups[monthYearKey] = {
        month,
        year: displayYear,
        date: new Date(date.getFullYear(), date.getMonth(), 1),
        monthly_spend: 0,
      };
    }
    monthGroups[monthYearKey].monthly_spend += amount;
  });

  // Log debug information
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG_BURN_RATE] Project: ${selectedProject}
      - Total Rows: ${totalRows}
      - Total Amount: ${totalAmountBefore.toLocaleString()}`);
  }

  const sortedMonths = Object.values(monthGroups).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const result: ProjectBurnRateData[] = [];
  let cumulative = 0;

  // Calculate budget from sheet data or fallback
  const totalProjectSpend = sortedMonths.reduce(
    (sum, d) => sum + d.monthly_spend,
    0,
  );

  // Extract budget from sheet data if available
  let budgetValue = 0;
  if (sheetData.length > 0) {
    const firstRow = sheetData[0];

    budgetValue =
      parseNumber(firstRow["Budget"]) ||
      parseNumber(firstRow["Project Budget"]) ||
      parseNumber(firstRow.Budget) ||
      0;
  }

  // Fallback budget only when no budget exists in dataset
  const fallbackBudget =
    Math.ceil((totalProjectSpend * 1.05) / 100000) * 100000;
  const mockBudget = budgetValue > 0 ? budgetValue : fallbackBudget;

  for (let i = 0; i < sortedMonths.length; i++) {
    const d = sortedMonths[i];
    // Cumulative = running total across months
    cumulative += d.monthly_spend;
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[CUMULATIVE_DEBUG] ${d.month} ${d.year}: Monthly Spend = ${d.monthly_spend.toLocaleString()}, Cumulative = ${cumulative.toLocaleString()}`,
      );
    }
    result.push({
      month: d.month,
      year: d.year,
      monthLabel: d.month,
      yearLabel: d.year,
      date: d.date,
      monthly_spend: d.monthly_spend,
      cumulative_spend: cumulative,
      budget: mockBudget,
      project: selectedProject,
    });
  }

  return result;
};

// Transform Google Sheets data to forecast format
const transformSheetData = (sheetData: SheetDataRow[]) => {
  // Group by month-year and sum amounts from procurement_head table
  const monthlyData = sheetData.reduce((acc: Record<string, number>, row) => {
    // Strictly use procurement_head.Date and procurement_head.Total Amount
    const dateStr = row.Date;
    if (!dateStr) return acc;

    const date = new Date(`${dateStr}T00:00:00`);
    const year = date.getFullYear().toString();
    const month = MONTHS[date.getMonth()];
    const monthYearKey = `${year}-${month}`;

    // Fix numeric parsing bug with commas
    const amount = parseNumber(row["Total Amount"]);

    // Add validation against invalid values
    if (isNaN(amount) || amount <= 0) return acc;

    // Sum amounts for the same month
    acc[monthYearKey] = (acc[monthYearKey] || 0) + amount;

    return acc;
  }, {});

  // Convert to array format and create continuous timeline
  const monthEntries = Object.entries(monthlyData);
  if (monthEntries.length === 0) return [];

  // Sort chronologically using proper Date sorting instead of localeCompare
  monthEntries.sort((a, b) => {
    const [year1, month1] = a[0].split("-");
    const [year2, month2] = b[0].split("-");

    const date1 = createMonthDate(year1, month1);
    const date2 = createMonthDate(year2, month2);

    return date1.getTime() - date2.getTime();
  });

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const firstMonthIndex = Math.max(0, MONTHS.indexOf(firstMonth));
  const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

  const result: MonthlySpend[] = [];
  let currentDate = createMonthDate(firstYear, firstMonth);
  const endDate = createMonthDate(lastYear, lastMonth);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear().toString();
    const month = MONTHS[currentDate.getMonth()];
    const monthYearKey = `${year}-${month}`;

    result.push({
      month,
      year,
      date: new Date(currentDate).getTime(),
      actual: monthlyData[monthYearKey] || 0,
      forecast: null,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};

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

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

// Helper functions for model accuracy evaluation using backtesting
const calculateMAPE = (historicalData: MonthlySpend[]): number => {
  if (historicalData.length < 8) return 0;

  // Cache numeric conversions to avoid repeated parseNumber calls
  const actualValues = historicalData.map((d) => parseNumber(d.actual));

  const errors: number[] = [];

  // Walk through entire dataset using rolling predictions with shared forecasting logic
  for (let i = 6; i < historicalData.length; i++) {
    const windowData = historicalData.slice(0, i);
    const actualValue = actualValues[i];

    if (actualValue > 0) {
      // Extract cached values for shared forecasting
      const windowValues = actualValues.slice(0, i);

      if (windowValues.length >= 6) {
        // Use shared forecasting utility for backtesting
        const backtestForecasts = forecastWeightedMovingAverage(windowValues, {
          horizon: 1,
          enableSeasonality: false, // Disable seasonality for backtesting
        });

        if (backtestForecasts.length > 0) {
          const backtestForecast = backtestForecasts[0];
          const backtestTrendAdjusted = backtestForecast;

          const percentageError = Math.abs(
            (actualValue - backtestTrendAdjusted) / actualValue,
          );
          errors.push(percentageError);
        }
      }
    }
  }

  return errors.length > 0
    ? (errors.reduce((sum, error) => sum + error, 0) / errors.length) * 100
    : 0;
};

const calculateRMSE = (historicalData: MonthlySpend[]): number => {
  if (historicalData.length < 8) return 0;

  // Cache numeric conversions to avoid repeated parseNumber calls
  const actualValues = historicalData.map((d) => parseNumber(d.actual));

  const errors: number[] = [];

  // Walk through entire dataset using rolling predictions with shared forecasting logic
  for (let i = 6; i < historicalData.length; i++) {
    const actualValue = actualValues[i];

    // Extract cached values for shared forecasting
    const windowValues = actualValues.slice(0, i);

    if (windowValues.length >= 6) {
      // Use shared forecasting utility for backtesting
      const backtestForecasts = forecastWeightedMovingAverage(windowValues, {
        horizon: 1,
        enableSeasonality: false, // Disable seasonality for backtesting
      });

      if (backtestForecasts.length > 0) {
        const backtestForecast = backtestForecasts[0];
        const backtestTrendAdjusted = backtestForecast;

        const err = actualValue - backtestTrendAdjusted;
        if (Number.isFinite(err)) {
          errors.push(err);
        }
      }
    }
  }

  return errors.length > 0
    ? Math.sqrt(
        errors.reduce((sum, error) => sum + error * error, 0) / errors.length,
      )
    : 0;
};

interface ForecastDataPoint {
  month: string;
  year: string;
  date: number;
  actual: number | null;
  forecast: number | null;
  forecast_low?: number;
  forecast_high?: number;
}

interface CategoryForecastData {
  month: string;
  year: string;
  date: number;
  [category: string]: number | string | undefined;
}

// Helper function for creating month dates consistently
function createMonthDate(year: string, month: string): Date {
  return new Date(parseInt(year), Math.max(0, MONTHS.indexOf(month)), 1);
}

// Helper function for extracting category keys
function extractCategories(item: Record<string, any>): string[] {
  return Object.keys(item).filter(
    (key) => key !== "month" && key !== "year" && key !== "date",
  );
}

// Generate forecast data using 6-month weighted moving average with outlier removal
const generateMovingAverageForecast = (
  historicalData: MonthlySpend[],
): ForecastDataPoint[] => {
  // Prevent array access errors
  if (!historicalData.length) return [];

  // Extract actual values using parseNumber for safety
  const values = historicalData.map((d) => parseNumber(d.actual));

  if (process.env.NODE_ENV === "development") {
    console.log("Moving Average Forecast - Actual values:", values);
  }

  if (values.length < 6) {
    // Fallback to CAGR-based growth if insufficient data
    const lastValue = values.length > 0 ? Math.max(...values) : 200000;
    const firstValue =
      values.length > 1 ? Math.min(...values.filter((v) => v > 0)) : lastValue;
    const n = values.length > 1 ? values.length - 1 : 1;

    // Calculate CAGR: (last/first)^(1/n) - 1
    const cagr =
      firstValue > 0 ? Math.pow(lastValue / firstValue, 1 / n) - 1 : 0.05;
    const growthRate = Math.max(0.01, Math.min(0.5, cagr)); // Clamp between 1% and 50%

    if (process.env.NODE_ENV === "development") {
      console.log("Moving Average Forecast - Using CAGR fallback:", {
        lastValue,
        firstValue,
        n,
        cagr,
        growthRate,
      });
    }

    // Generate 6 months of fallback forecast
    if (!historicalData.length) return [];
    const lastYear = Number(historicalData[historicalData.length - 1].year);
    const lastMonth = historicalData[historicalData.length - 1].month;
    const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

    const fallbackForecast = [];
    for (let i = 1; i <= 6; i++) {
      const monthIndex = (lastMonthIndex + i) % 12;
      const yearOffset = Math.floor((lastMonthIndex + i) / 12);
      const forecastYear = (lastYear + yearOffset).toString();
      const forecastMonth = MONTHS[monthIndex];

      const forecastValue = lastValue * Math.pow(1 + growthRate, i);

      fallbackForecast.push({
        month: forecastMonth,
        year: forecastYear,
        date: new Date(parseInt(forecastYear), monthIndex, 1).getTime(),
        actual: null,
        forecast: Math.max(Math.round(forecastValue), 0),
        forecast_low: Math.max(0, Math.round(forecastValue * 0.8)),
        forecast_high: Math.round(forecastValue * 1.2),
      });
    }

    return fallbackForecast;
  }

  // Apply winsorization to cap extreme values while preserving time series continuity
  let series = [...values];
  if (values.length >= 12) {
    series = winsorizeSeries(values);
  }

  // STEP 2: Create consistent dataset structure for seasonal calculations
  const seriesData = historicalData.map((d) => ({
    month: d.month,
    value: parseNumber(d.actual),
  }));

  // Apply winsorization to values while preserving structure
  if (values.length >= 12) {
    const winsorizedValues = winsorizeSeries(seriesData.map((d) => d.value));
    for (let i = 0; i < seriesData.length; i++) {
      seriesData[i].value = winsorizedValues[i];
    }
  }

  // Calculate seasonal factors using reusable helper
  const seasonalFactors = calculateSeasonalFactors(seriesData);

  // Calculate RMSE for confidence intervals using the same forecasting model as production
  const errors: number[] = [];
  for (let i = 6; i < seriesData.length; i++) {
    const actualValue = seriesData[i].value;

    // Use full series up to current point to match production forecasting model
    const windowValues = seriesData.slice(0, i).map((d) => d.value);

    const backtestForecasts = forecastWeightedMovingAverage(windowValues, {
      horizon: 1,
      enableSeasonality: false, // Disable seasonality for backtesting
    });

    if (backtestForecasts.length > 0) {
      const backtestForecast = backtestForecasts[0];
      const err = actualValue - backtestForecast;
      if (Number.isFinite(err)) {
        errors.push(err);
      }
    }
  }

  const rmse =
    errors.length > 0
      ? Math.sqrt(
          errors.reduce((sum, error) => sum + error * error, 0) / errors.length,
        )
      : 0;

  // Use shared forecasting utility with full historical series (winsorized if applicable)
  if (!historicalData.length) return [];
  const enableSeasonality = historicalData.length >= 24; // Align with seasonal factor calculation requirements
  const fullSeries = series; // Use the winsorized series instead of original values
  const forecasts = forecastWeightedMovingAverage(fullSeries, {
    horizon: 6,
    seasonalFactors,
    lastMonth: historicalData[historicalData.length - 1].month,
    lastYear: Number(historicalData[historicalData.length - 1].year),
    enableSeasonality,
  });

  // Convert forecasts back to original format
  if (!historicalData.length) return [];
  const forecastData: any[] = [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;
  const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

  forecasts.forEach((forecastValue, i) => {
    const monthIndex = (lastMonthIndex + i + 1) % 12;
    const yearOffset = Math.floor((lastMonthIndex + i + 1) / 12);
    const forecastYear = (lastYear + yearOffset).toString();
    const forecastMonth = MONTHS[monthIndex];

    // Ensure forecast value is finite
    const safeForecastValue = Number.isFinite(forecastValue)
      ? forecastValue
      : 0;

    forecastData.push({
      month: forecastMonth,
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1).getTime(),
      actual: null,
      forecast: safeForecastValue,
      forecast_low: Math.max(
        0,
        Math.round(safeForecastValue - 1.96 * rmse * Math.sqrt(i + 1)),
      ),
      forecast_high: Math.round(
        safeForecastValue + 1.96 * rmse * Math.sqrt(i + 1),
      ),
    });
  });

  if (process.env.NODE_ENV === "development") {
    console.log("Moving Average Forecast - Final metrics:", {
      rmse,
      forecastHorizon: 6,
      outliersAdjusted: series.some((v, i) => v !== values[i]),
      seasonalFactors,
    });
  }

  return forecastData;
};

const transformCategoryData = (lineData: LineDataRow[]) => {
  // Group by month-year and category
  const monthlyCategoryData = lineData.reduce(
    (acc: Record<string, Record<string, number>>, row) => {
      const dateStr = row.Date;
      const category = categorizeItemCode(row["Item Code"] || "");

      // Fix numeric parsing bug with commas
      const amount = parseNumber(row["Total Amount"]);

      if (!dateStr || !category || isNaN(amount) || amount <= 0) return acc;

      const date = new Date(`${dateStr}T00:00:00`);
      const year = date.getFullYear().toString();
      const month = MONTHS[date.getMonth()];
      const monthYearKey = `${year}-${month}`;

      if (!acc[monthYearKey]) {
        acc[monthYearKey] = {};
      }

      acc[monthYearKey][category] = (acc[monthYearKey][category] || 0) + amount;

      return acc;
    },
    {},
  );

  // Convert to array format and create continuous timeline
  const monthEntries = Object.entries(monthlyCategoryData);
  if (monthEntries.length === 0) return [];

  // Sort by date
  monthEntries.sort((a, b) => {
    const [year1, month1] = a[0].split("-");
    const [year2, month2] = b[0].split("-");

    const date1 = createMonthDate(year1, month1);
    const date2 = createMonthDate(year2, month2);

    return date1.getTime() - date2.getTime();
  });

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const firstMonthIndex = Math.max(0, MONTHS.indexOf(firstMonth));
  const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

  const result: MonthlyCategory[] = [];
  let currentDate = createMonthDate(firstYear, firstMonth);
  const endDate = createMonthDate(lastYear, lastMonth);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear().toString();
    const month = MONTHS[currentDate.getMonth()];
    const monthYearKey = `${year}-${month}`;
    const categoryData = monthlyCategoryData[monthYearKey] || {};

    result.push({
      month,
      year,
      date: new Date(currentDate).getTime(),
      ...categoryData,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};

// Generate category forecast using 6-month weighted moving average with seasonal adjustment
const generateCategoryForecast = (
  historicalData: MonthlyCategory[],
  categories: string[],
): CategoryForecastData[] => {
  // Prevent array access errors
  if (!historicalData.length) return [];

  const forecastData: CategoryForecastData[] = [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;
  const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

  // Compute seasonal factors per category using shared helper
  const categorySeasonalFactors: {
    [category: string]: Record<string, number>;
  } = {};

  categories.forEach((category) => {
    // Create series data for seasonal factor calculation
    const categorySeriesData = historicalData.map((d) => ({
      month: d.month,
      value: parseNumber(d[category]),
    }));

    // Use shared seasonal factor calculator
    categorySeasonalFactors[category] =
      calculateSeasonalFactors(categorySeriesData);
  });

  // Pre-compute full category values for better model accuracy
  const categoryValues: { [key: string]: number[] } = {};
  categories.forEach((category) => {
    // Use full historical series instead of just last 6 months
    const values = historicalData.map((item) => parseNumber(item[category]));
    categoryValues[category] = values.length > 0 ? values : [0];
  });

  // Limit forecast horizon to 6 months
  const maxForecastHorizon = 6;

  // Pre-compute forecasts for all categories to avoid recalculation in loop
  const categoryForecasts: { [category: string]: number[] } = {};
  categories.forEach((category) => {
    const values = categoryValues[category];

    // Use shared forecasting utility with seasonal factors
    categoryForecasts[category] = forecastWeightedMovingAverage(values, {
      horizon: maxForecastHorizon,
      seasonalFactors: categorySeasonalFactors[category] || {},
      lastMonth: lastMonth,
      lastYear: Number(lastYear),
      enableSeasonality: historicalData.length >= 24,
    });
  });

  for (let i = 1; i <= maxForecastHorizon; i++) {
    const monthIndex = (lastMonthIndex + i) % 12;
    const yearOffset = Math.floor((lastMonthIndex + i) / 12);
    const forecastYear = (lastYear + yearOffset).toString();
    const forecastMonth = MONTHS[monthIndex];

    const forecastItem: any = {
      month: forecastMonth,
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1).getTime(),
    };

    // Generate forecast for each category using cached results
    categories.forEach((category) => {
      const forecasts = categoryForecasts[category];
      // Get the forecast for this month (index i-1 since arrays are 0-based)
      forecastItem[category] =
        forecasts && forecasts.length >= i ? forecasts[i - 1] : 0;
    });

    forecastData.push(forecastItem);
  }

  return forecastData;
};

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
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"12months" | "18months">(
    "12months",
  );
  const [procurementLineData, setProcurementLineData] = useState<
    ProcurementLineData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [projectBurnRateData, setProjectBurnRateData] = useState<
    ProjectBurnRateData[]
  >([]);
  const [selectedProjectBurnRate, setSelectedProjectBurnRate] =
    useState<string>("");
  const [budgetLimit, setBudgetLimit] = useState<string>("");
  const [allHeadRows, setAllHeadRows] = useState<any[]>([]);
  const [allProjectsList, setAllProjectsList] = useState<string[]>([]);

  // Fetch data from Google Sheets on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch procurement head data
        const headData = await getTab1Data();
        const transformedHeadData = transformSheetData(headData.rows);
        setSheetData(transformedHeadData);

        // Fetch procurement line data for categories
        const lineData = await getProcurementLineData();
        const transformedCategoryData = transformCategoryData(lineData.rows);
        setCategoryData(transformedCategoryData);

        // Transform line data for procurement line forecasting
        const transformedProcurementLineData = transformProcurementLineData(
          lineData.rows,
        );
        setProcurementLineData(transformedProcurementLineData);

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
  const categories = useMemo(() => {
    const allCategories = new Set<string>();
    categoryData.forEach((item) => {
      const extractedCategories = extractCategories(item);
      extractedCategories.forEach((category) => allCategories.add(category));
    });
    // Sort categories in specific order: Service, Material, Other
    const categoryOrder = ["Service", "Material", "Other"];
    const sortedCategories = Array.from(allCategories).sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    return sortedCategories;
  }, [categoryData]);

  const categoryForecastData = useMemo(() => {
    if (categoryData.length === 0) return [];
    return generateCategoryForecast(categoryData, categories);
  }, [categoryData, categories]);

  const categorySpendingData = useMemo(() => {
    const historical = categoryData; // Use full historical data
    return [...historical, ...categoryForecastData];
  }, [categoryData, categoryForecastData]);

  // Memoized procurement line forecast data
  const monthlyExpenseForecastData = useMemo(() => {
    if (procurementLineData.length === 0) return [];
    return generateMonthlyExpenseForecast(procurementLineData);
  }, [procurementLineData]);

  const categoriesList = useMemo(() => {
    const allCategories = new Set<string>();
    procurementLineData.forEach((item) => {
      const categories = extractCategories(item);
      categories.forEach((category) => allCategories.add(category));
    });
    return Array.from(allCategories).sort();
  }, [procurementLineData]);

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
    // If manual budget limit is provided, override the calculated budget
    if (budgetLimit && budgetLimit.trim() !== "") {
      const manualBudget = parseFloat(budgetLimit.replace(/,/g, ""));
      if (!isNaN(manualBudget)) {
        return projectBurnRateData.map((item) => ({
          ...item,
          budget: manualBudget,
        }));
      }
    }

    return projectBurnRateData;
  }, [projectBurnRateData, budgetLimit]);

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
                    Total Amount
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
                    monthLabel: mon.slice(0, 3),
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
                          MONTHS[new Date(value).getMonth()]
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
                        tickFormatter={(value, index) => {
                          if (!chartData || chartData.length === 0) return "";
                          const yearGroups: { [key: string]: number[] } = {};
                          chartData.forEach((item: any, idx: number) => {
                            const year = item.yearLabel;
                            if (!yearGroups[year]) yearGroups[year] = [];
                            yearGroups[year].push(idx);
                          });
                          for (const year in yearGroups) {
                            const indices = yearGroups[year];
                            const targetIndex =
                              indices[6] ||
                              indices[Math.floor(indices.length / 2)];
                            if (index === targetIndex) return value;
                          }
                          return "";
                        }}
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
                            return date.toLocaleString("en-US", {
                              month: "long",
                              year: "numeric",
                            });
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
                        name="Total Amount"
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
                  <select
                    value={selectedProjectBurnRate}
                    onChange={(e) => setSelectedProjectBurnRate(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    {projectsForSelect.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">
                    Budget Limit :
                  </span>
                  <input
                    type="text"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder="Auto-calculate"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all w-32"
                  />
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
                    tickFormatter={(value, index) => {
                      if (
                        !projectBurnRatePlotData ||
                        projectBurnRatePlotData.length === 0
                      )
                        return "";
                      const yearGroups: { [key: string]: number[] } = {};
                      projectBurnRatePlotData.forEach(
                        (item: ProjectBurnRateData, idx: number) => {
                          const year = item.yearLabel;
                          if (!yearGroups[year]) yearGroups[year] = [];
                          yearGroups[year].push(idx);
                        },
                      );
                      for (const year in yearGroups) {
                        const indices = yearGroups[year];
                        const targetIndex =
                          indices[6] || indices[Math.floor(indices.length / 2)];
                        if (index === targetIndex) return value;
                      }
                      return "";
                    }}
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
                      const fullMonth = MONTH_MAP[label] || label;
                      const year = payload?.[0]?.payload?.year || "";
                      return `${fullMonth} ${year}`;
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
