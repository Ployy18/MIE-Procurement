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
import { Calendar } from "lucide-react";
import {
  getTab1Data,
  getProcurementLineData,
} from "../../services/googleSheetsService";
import { LoadingState } from "./ui/LoadingState";

// TypeScript types for better type safety
type MonthlySpend = {
  month: string;
  year: string;
  date: Date;
  actual: number | null;
  forecast: number | null;
};

type MonthlyDemand = {
  month: string;
  year: string;
  date: Date;
  demand: number | null;
  forecast: number | null;
};

type MonthlyCategory = {
  month: string;
  year: string;
  date: Date;
} & Record<string, number | undefined>;

type ProcurementLineData = {
  month: string;
  year: string;
  date: number; // Use timestamp for compatibility
  totalQuantity: number;
  totalAmount: number;
} & Record<string, number | undefined>;

type CategoryForecast = {
  month: string;
  year: string;
  date: Date;
  category: string;
  actualQuantity: number | null;
  forecastQuantity: number | null;
  actualAmount: number | null;
  forecastAmount: number | null;
};

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

// Function to categorize Item Codes based on procurement patterns
const categorizeItemCode = (code: string): string => {
  if (!code) return "Uncategorized";

  const upperCode = code.toUpperCase();

  // CCTV
  if (
    upperCode.startsWith("CAMERA") ||
    upperCode.startsWith("DVR") ||
    upperCode.startsWith("NVR") ||
    upperCode.startsWith("P-CAMERA") ||
    upperCode.startsWith("P-NVR")
  ) {
    return "CCTV";
  }

  // Storage
  if (upperCode.startsWith("HDD") || upperCode.startsWith("SSD")) {
    return "Storage";
  }

  // Network
  if (
    upperCode.startsWith("SWITCH") ||
    upperCode.startsWith("P-SWITCH") ||
    upperCode.startsWith("LAN") ||
    upperCode.startsWith("SFP")
  ) {
    return "Network";
  }

  // Power & Electrical
  if (
    upperCode.startsWith("POWER") ||
    upperCode.startsWith("POWERSUP") ||
    upperCode.startsWith("THW") ||
    upperCode.startsWith("VCT") ||
    upperCode.startsWith("NYY")
  ) {
    return "Power & Electrical";
  }

  // Installation Material
  if (
    upperCode.startsWith("ACCS") ||
    upperCode.startsWith("BNC") ||
    upperCode.startsWith("CLAMP")
  ) {
    return "Installation Material";
  }

  // Office Supply
  if (upperCode.startsWith("TONER")) {
    return "Office Supply";
  }

  // IT Device
  if (
    upperCode.startsWith("P-PHONE") ||
    upperCode.startsWith("P-IPAD") ||
    upperCode.startsWith("SERVER")
  ) {
    return "IT Device";
  }

  // Software
  if (upperCode.startsWith("P-SOFTWARE")) {
    return "Software";
  }

  // Service Operation
  if (upperCode.startsWith("SVSUB")) {
    return "Service Operation";
  }

  // Other Expense
  if (upperCode.startsWith("SVOTHER")) {
    return "Other Expense";
  }

  // Finance
  if (upperCode.startsWith("SV150100")) {
    return "Finance";
  }

  return "Uncategorized";
};

// Transform procurement line data for forecasting
const transformProcurementLineData = (
  lineData: any[],
): ProcurementLineData[] => {
  // Group by month-year and category
  const monthlyCategoryData = lineData.reduce(
    (
      acc: Record<string, Record<string, { quantity: number; amount: number }>>,
      row,
    ) => {
      const dateStr = row.Date;
      const itemCode = row["Item Code"] || "";
      const quantity = parseFloat(row.Quantity || 0);
      const amount = parseFloat(row["Total Amount"] || 0);

      if (!dateStr || isNaN(quantity) || isNaN(amount)) return acc;

      const date = new Date(dateStr);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString("en-US", { month: "short" });
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

    const date1 = new Date(`${month1} 1, ${year1}`);
    const date2 = new Date(`${month2} 1, ${year2}`);

    return date1.getTime() - date2.getTime();
  });

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const firstMonthIndex = MONTHS.indexOf(firstMonth);
  const lastMonthIndex = MONTHS.indexOf(lastMonth);

  const result: ProcurementLineData[] = [];
  let currentDate = new Date(parseInt(firstYear), firstMonthIndex, 1);
  const endDate = new Date(parseInt(lastYear), lastMonthIndex, 1);

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

    const monthData: Record<string, number | undefined> = {
      month: currentDate.getTime(), // Use timestamp as key
      year: currentDate.getTime(), // Use timestamp as key
      date: new Date(currentDate).getTime(),
      totalQuantity,
      totalAmount,
    };

    // Add category-specific data
    Object.entries(categoryData).forEach(([category, data]) => {
      monthData[category] = data.amount;
    });

    // Add month and year as separate properties
    const finalData = monthData as ProcurementLineData;
    (finalData as any).month = month;
    (finalData as any).year = year;

    result.push(finalData);

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};
// Generate monthly expense forecast using weighted moving average
const generateMonthlyExpenseForecast = (
  historicalData: ProcurementLineData[],
): ProcurementLineData[] => {
  // Extract total amounts without filtering zeros
  const values = historicalData.map((d) => d.totalAmount || 0);

  if (values.length < 3) {
    const lastValue = values.length > 0 ? Math.max(...values) : 100000;

    // Generate 3 months of fallback forecast
    const lastYear = Number(
      historicalData[historicalData.length - 1]?.year ||
        new Date().getFullYear(),
    );
    const lastMonth = historicalData[historicalData.length - 1]?.month || "Dec";
    const lastMonthIndex = MONTHS.indexOf(lastMonth);

    return [
      {
        month: MONTHS[(lastMonthIndex + 1) % 12],
        year: (lastMonthIndex === 11 ? lastYear + 1 : lastYear).toString(),
        date: new Date(
          lastMonthIndex === 11 ? lastYear + 1 : lastYear,
          (lastMonthIndex + 1) % 12,
          1,
        ).getTime(),
        totalQuantity: 0,
        totalAmount: lastValue * 1.05,
      } as any,
      {
        month: MONTHS[(lastMonthIndex + 2) % 12],
        year: (lastMonthIndex >= 10 ? lastYear + 1 : lastYear).toString(),
        date: new Date(
          lastMonthIndex >= 10 ? lastYear + 1 : lastYear,
          (lastMonthIndex + 2) % 12,
          1,
        ).getTime(),
        totalQuantity: 0,
        totalAmount: lastValue * 1.07,
      } as any,
      {
        month: MONTHS[(lastMonthIndex + 3) % 12],
        year: (lastMonthIndex >= 9 ? lastYear + 1 : lastYear).toString(),
        date: new Date(
          lastMonthIndex >= 9 ? lastYear + 1 : lastYear,
          (lastMonthIndex + 3) % 12,
          1,
        ).getTime(),
        totalQuantity: 0,
        totalAmount: lastValue * 1.09,
      } as any,
    ];
  }

  // Generate forecast for next 3 months using weighted moving average
  const forecastData: ProcurementLineData[] = [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;
  const lastMonthIndex = MONTHS.indexOf(lastMonth);

  // Use rolling historical window
  let rollingValues = [...values];

  for (let i = 1; i <= 3; i++) {
    const lastThreeValues = rollingValues.slice(-3);

    // Apply weighted moving average: 0.5 * last + 0.3 * second + 0.2 * third
    let weightedAverage = 0;
    if (lastThreeValues.length === 3) {
      weightedAverage =
        0.5 * lastThreeValues[2] + // last month
        0.3 * lastThreeValues[1] + // second month
        0.2 * lastThreeValues[0]; // third month
    } else if (lastThreeValues.length === 2) {
      weightedAverage =
        0.7 * lastThreeValues[1] + // last month
        0.3 * lastThreeValues[0]; // second month
    } else {
      weightedAverage = lastThreeValues[0]; // only one value available
    }

    const forecastValue = Math.max(Math.round(weightedAverage), 0);

    let monthIndex = (lastMonthIndex + i) % 12;
    let yearOffset = Math.floor((lastMonthIndex + i) / 12);
    let forecastYear = (lastYear + yearOffset).toString();

    forecastData.push({
      month: MONTHS[monthIndex],
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1).getTime(),
      totalQuantity: 0,
      totalAmount: forecastValue,
    } as any);

    // Update rolling values
    rollingValues = [...rollingValues.slice(-3), forecastValue];
  }

  return forecastData;
};

// Generate category demand forecast
const generateCategoryDemandForecast = (
  historicalData: ProcurementLineData[],
  categories: string[],
): CategoryForecast[] => {
  const forecastData: CategoryForecast[] = [];

  categories.forEach((category) => {
    // Extract historical amounts for this category
    const values = historicalData.map((d) => d[category] || 0);

    if (values.length < 3) return; // Skip if insufficient data

    const lastYear = Number(historicalData[historicalData.length - 1].year);
    const lastMonth = historicalData[historicalData.length - 1].month;
    const lastMonthIndex = MONTHS.indexOf(lastMonth);

    // Use rolling historical window
    let rollingValues = [...values];

    for (let i = 1; i <= 3; i++) {
      const lastThreeValues = rollingValues.slice(-3);

      // Apply weighted moving average
      let weightedAverage = 0;
      if (lastThreeValues.length === 3) {
        weightedAverage =
          0.5 * lastThreeValues[2] + // last month
          0.3 * lastThreeValues[1] + // second month
          0.2 * lastThreeValues[0]; // third month
      } else if (lastThreeValues.length === 2) {
        weightedAverage =
          0.7 * lastThreeValues[1] + // last month
          0.3 * lastThreeValues[0]; // second month
      } else {
        weightedAverage = lastThreeValues[0];
      }

      const forecastValue = Math.max(Math.round(weightedAverage), 0);

      let monthIndex = (lastMonthIndex + i) % 12;
      let yearOffset = Math.floor((lastMonthIndex + i) / 12);
      let forecastYear = (lastYear + yearOffset).toString();

      forecastData.push({
        month: MONTHS[monthIndex],
        year: forecastYear,
        date: new Date(parseInt(forecastYear), monthIndex, 1),
        category,
        actualQuantity: null,
        forecastQuantity: Math.round(forecastValue / 1000), // Rough quantity estimate
        actualAmount: null,
        forecastAmount: forecastValue,
      });

      // Update rolling values
      rollingValues = [...rollingValues.slice(-3), forecastValue];
    }
  });

  return forecastData;
};

// Data validation utilities
const validateSpendingData = (data: any[]) => {
  return data.every(
    (item) =>
      item &&
      typeof item.month === "string" &&
      (item.actual === null || typeof item.actual === "number") &&
      (item.forecast === null || typeof item.forecast === "number"),
  );
};

// Transform Google Sheets data to forecast format
const transformSheetData = (sheetData: any[]) => {
  // Group by month-year and sum amounts from procurement_head table
  const monthlyData = sheetData.reduce((acc: Record<string, number>, row) => {
    // Strictly use procurement_head.Date and procurement_head.Total Amount
    const dateStr = row.Date;
    if (!dateStr) return acc;

    const date = new Date(dateStr);
    const year = date.getFullYear().toString();
    const month = date.toLocaleString("en-US", { month: "short" });
    const monthYearKey = `${year}-${month}`;

    // Strictly use procurement_head.Total Amount
    const amount = parseFloat(row["Total Amount"] || 0);

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

    const date1 = new Date(`${month1} 1, ${year1}`);
    const date2 = new Date(`${month2} 1, ${year2}`);

    return date1.getTime() - date2.getTime();
  });

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const months = [
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
  const firstMonthIndex = months.indexOf(firstMonth);
  const lastMonthIndex = months.indexOf(lastMonth);

  const result: any[] = [];
  let currentDate = new Date(parseInt(firstYear), firstMonthIndex, 1);
  const endDate = new Date(parseInt(lastYear), lastMonthIndex, 1);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear().toString();
    const month = months[currentDate.getMonth()];
    const monthYearKey = `${year}-${month}`;

    result.push({
      month,
      year,
      date: new Date(currentDate),
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
  console.log("Debug - All data length:", allData.length);
  console.log("Debug - All data:", allData);

  // Clone array before sorting to avoid mutation
  const sortedData = [...allData].sort(
    (a, b) =>
      new Date(`${a.month} ${a.year}`).getTime() -
      new Date(`${b.month} ${b.year}`).getTime(),
  );

  console.log("Debug - Sorted data:", sortedData);

  // Get last 12 and 18 months from all data (counting backwards from latest data)
  const last12Months = sortedData.slice(-12);
  const last18Months = sortedData.slice(-18);

  console.log("Debug - Last 12 months:", last12Months);
  console.log("Debug - Last 18 months:", last18Months);

  return {
    "12months": last12Months,
    "2years": last18Months,
  };
};

// Generate forecast data using 3-month Moving Average model
const generateMovingAverageForecast = (historicalData: any[]) => {
  // Extract actual values without filtering zeros to maintain time series continuity
  const values = historicalData.map((d) => Number(d.actual) || 0);

  console.log("Moving Average Forecast - Actual values:", values);

  if (values.length < 3) {
    // Fallback to simple growth if insufficient data
    const lastValue = values.length > 0 ? Math.max(...values) : 200000;
    console.log(
      "Moving Average Forecast - Using fallback, lastValue:",
      lastValue,
    );

    return [
      { month: "Jan", year: "2026", actual: null, forecast: lastValue * 1.05 },
      { month: "Feb", year: "2026", actual: null, forecast: lastValue * 1.07 },
      { month: "Mar", year: "2026", actual: null, forecast: lastValue * 1.09 },
      { month: "Apr", year: "2026", actual: null, forecast: lastValue * 1.11 },
      { month: "May", year: "2026", actual: null, forecast: lastValue * 1.13 },
      { month: "Jun", year: "2026", actual: null, forecast: lastValue * 1.15 },
    ];
  }

  // Generate forecast for next 12 months using 3-month moving average
  const forecastData = [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;

  // Find the index of the last month to continue from
  const months = [
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
  const lastMonthIndex = months.indexOf(lastMonth);

  console.log("Moving Average Forecast - Starting parameters:", {
    lastYear,
    lastMonth,
    lastMonthIndex,
    initialValues: [...values],
  });

  // Use rolling historical window instead of recursive self-feeding
  let rollingValues = [...values]; // Start with all historical values

  for (let i = 1; i <= 12; i++) {
    // Get last 3 values from rolling window
    const lastThreeValues = rollingValues.slice(-3);

    // Apply weighted moving average: 0.5 * last + 0.3 * second + 0.2 * third
    let weightedAverage = 0;
    if (lastThreeValues.length === 3) {
      weightedAverage =
        0.5 * lastThreeValues[2] + // last month
        0.3 * lastThreeValues[1] + // second month
        0.2 * lastThreeValues[0]; // third month
    } else if (lastThreeValues.length === 2) {
      weightedAverage =
        0.7 * lastThreeValues[1] + // last month
        0.3 * lastThreeValues[0]; // second month
    } else {
      weightedAverage = lastThreeValues[0]; // only one value available
    }

    // Clamp negative values to zero
    const forecastValue = Math.max(Math.round(weightedAverage), 0);

    // Calculate month and year dynamically
    let monthIndex = (lastMonthIndex + i) % 12;
    let yearOffset = Math.floor((lastMonthIndex + i) / 12);
    let forecastYear = (lastYear + yearOffset).toString();

    console.log(`Moving Average Forecast - Month ${i}:`, {
      lastThreeValues,
      weightedAverage,
      forecastValue,
      month: months[monthIndex],
      year: forecastYear,
    });

    forecastData.push({
      month: months[monthIndex],
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1),
      actual: null,
      forecast: forecastValue,
    });

    // Update rolling values: add forecast but maintain only last 3 historical values for next calculation
    rollingValues = [...rollingValues.slice(-3), forecastValue];
  }

  return forecastData;
};

// Transform procurement line data to demand format using PO count
const transformDemandData = (lineData: any[]): MonthlyDemand[] => {
  // Group by month-year and count POs instead of summing quantities
  const monthlyDemandData = lineData.reduce(
    (acc: Record<string, number>, row) => {
      const dateStr = row.Date;

      if (!dateStr) return acc;

      const date = new Date(dateStr);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString("en-US", { month: "short" });
      const monthYearKey = `${year}-${month}`;

      // Count POs instead of summing quantities for unit-consistent demand metric
      acc[monthYearKey] = (acc[monthYearKey] || 0) + 1;

      return acc;
    },
    {},
  );

  // Convert to array format and create continuous timeline
  const monthEntries = Object.entries(monthlyDemandData);
  if (monthEntries.length === 0) return [];

  // Sort chronologically using proper Date sorting instead of localeCompare
  monthEntries.sort((a, b) => {
    const [year1, month1] = a[0].split("-");
    const [year2, month2] = b[0].split("-");

    const date1 = new Date(`${month1} 1, ${year1}`);
    const date2 = new Date(`${month2} 1, ${year2}`);

    return date1.getTime() - date2.getTime();
  });

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const firstMonthIndex = MONTHS.indexOf(firstMonth);
  const lastMonthIndex = MONTHS.indexOf(lastMonth);

  const result: MonthlyDemand[] = [];
  let currentDate = new Date(parseInt(firstYear), firstMonthIndex, 1);
  const endDate = new Date(parseInt(lastYear), lastMonthIndex, 1);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear().toString();
    const month = MONTHS[currentDate.getMonth()];
    const monthYearKey = `${year}-${month}`;

    result.push({
      month,
      year,
      date: new Date(currentDate),
      demand: monthlyDemandData[monthYearKey] || 0,
      forecast: null,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};

// Generate demand forecast using 3-month Weighted Moving Average model
const generateDemandForecast = (historicalData: MonthlyDemand[]) => {
  // Extract demand values without filtering zeros to maintain time series continuity
  const values = historicalData.map((d) => Number(d.demand) || 0);

  console.log("Demand Forecast - Actual values:", values);

  if (values.length < 3) {
    // Fallback to simple growth if insufficient data
    const lastValue = values.length > 0 ? Math.max(...values) : 100;
    console.log("Demand Forecast - Using fallback, lastValue:", lastValue);

    return [
      {
        month: "Jan",
        year: "2026",
        date: new Date(2026, 0, 1),
        demand: null,
        forecast: Math.round(lastValue * 1.05),
      },
      {
        month: "Feb",
        year: "2026",
        date: new Date(2026, 1, 1),
        demand: null,
        forecast: Math.round(lastValue * 1.07),
      },
      {
        month: "Mar",
        year: "2026",
        date: new Date(2026, 2, 1),
        demand: null,
        forecast: Math.round(lastValue * 1.09),
      },
      {
        month: "Apr",
        year: "2026",
        date: new Date(2026, 3, 1),
        demand: null,
        forecast: Math.round(lastValue * 1.11),
      },
      {
        month: "May",
        year: "2026",
        date: new Date(2026, 4, 1),
        demand: null,
        forecast: Math.round(lastValue * 1.13),
      },
      {
        month: "Jun",
        year: "2026",
        date: new Date(2026, 5, 1),
        demand: null,
        forecast: Math.round(lastValue * 1.15),
      },
    ];
  }

  // Generate forecast for next 12 months using 3-month weighted moving average
  const forecastData: MonthlyDemand[] = [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;

  // Find the index of the last month to continue from
  const lastMonthIndex = MONTHS.indexOf(lastMonth);

  console.log("Demand Forecast - Starting parameters:", {
    lastYear,
    lastMonth,
    lastMonthIndex,
    initialValues: [...values],
  });

  // Use rolling historical window instead of recursive self-feeding
  let rollingValues = [...values]; // Start with all historical values

  for (let i = 1; i <= 12; i++) {
    // Get last 3 values from rolling window
    const lastThreeValues = rollingValues.slice(-3);

    // Apply weighted moving average: 0.5 * last + 0.3 * second + 0.2 * third
    let weightedAverage = 0;
    if (lastThreeValues.length === 3) {
      weightedAverage =
        0.5 * lastThreeValues[2] + // last month
        0.3 * lastThreeValues[1] + // second month
        0.2 * lastThreeValues[0]; // third month
    } else if (lastThreeValues.length === 2) {
      weightedAverage =
        0.7 * lastThreeValues[1] + // last month
        0.3 * lastThreeValues[0]; // second month
    } else {
      weightedAverage = lastThreeValues[0]; // only one value available
    }

    // Clamp negative values to zero
    const forecastValue = Math.max(Math.round(weightedAverage), 0);

    // Calculate month and year dynamically
    let monthIndex = (lastMonthIndex + i) % 12;
    let yearOffset = Math.floor((lastMonthIndex + i) / 12);
    let forecastYear = (lastYear + yearOffset).toString();

    console.log(`Demand Forecast - Month ${i}:`, {
      lastThreeValues,
      weightedAverage,
      forecastValue,
      month: MONTHS[monthIndex],
      year: forecastYear,
    });

    forecastData.push({
      month: MONTHS[monthIndex],
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1),
      demand: null,
      forecast: forecastValue,
    });

    // Update rolling values: add forecast but maintain only last 3 historical values for next calculation
    rollingValues = [...rollingValues.slice(-3), forecastValue];
  }

  return forecastData;
};
const transformCategoryData = (lineData: any[]) => {
  // Group by month-year and category
  const monthlyCategoryData = lineData.reduce(
    (acc: Record<string, Record<string, number>>, row) => {
      const dateStr = row.Date;
      const category = row.Category;
      const amount = parseFloat(row["Total Amount"] || 0);

      if (!dateStr || !category || isNaN(amount) || amount <= 0) return acc;

      const date = new Date(dateStr);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString("en-US", { month: "short" });
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
  monthEntries.sort((a, b) => a[0].localeCompare(b[0]));

  // Create continuous monthly timeline
  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

  const months = [
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
  const firstMonthIndex = months.indexOf(firstMonth);
  const lastMonthIndex = months.indexOf(lastMonth);

  const result: any[] = [];
  let currentDate = new Date(parseInt(firstYear), firstMonthIndex, 1);
  const endDate = new Date(parseInt(lastYear), lastMonthIndex, 1);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear().toString();
    const month = months[currentDate.getMonth()];
    const monthYearKey = `${year}-${month}`;
    const categoryData = monthlyCategoryData[monthYearKey] || {};

    result.push({
      month,
      year,
      date: new Date(currentDate),
      ...categoryData,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};

// Generate category forecast using rolling moving average
const generateCategoryForecast = (
  historicalData: any[],
  categories: string[],
) => {
  const forecastData = [];
  const lastYear = Number(historicalData[historicalData.length - 1].year);
  const lastMonth = historicalData[historicalData.length - 1].month;
  const months = [
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
  const lastMonthIndex = months.indexOf(lastMonth);

  // Initialize rolling values for each category
  const categoryValues: { [key: string]: number[] } = {};
  categories.forEach((category) => {
    // Get last 6 months of actual values for this category
    const values = historicalData
      .slice(-6)
      .map((item) => item[category] || 0)
      .filter((val) => val > 0);
    categoryValues[category] = values.length > 0 ? values : [0];
  });

  for (let i = 1; i <= 12; i++) {
    const monthIndex = (lastMonthIndex + i) % 12;
    const yearOffset = Math.floor((lastMonthIndex + i) / 12);
    const forecastYear = (lastYear + yearOffset).toString();

    const forecastItem: any = {
      month: months[monthIndex],
      year: forecastYear,
      date: new Date(parseInt(forecastYear), monthIndex, 1),
    };

    // Generate forecast for each category using rolling moving average
    categories.forEach((category) => {
      const values = categoryValues[category];
      if (values.length > 0) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const forecast = Math.round(avg);

        forecastItem[category] = forecast;

        // Update rolling values: add forecast and remove oldest
        categoryValues[category] = [...values.slice(1), forecast];
      } else {
        forecastItem[category] = 0;
      }
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

export function ForecastPlanning() {
  const [selectedPeriod, setSelectedPeriod] = useState<"12months" | "2years">(
    "12months",
  );
  const [sheetData, setSheetData] = useState<MonthlySpend[]>([]);
  const [categoryData, setCategoryData] = useState<MonthlyCategory[]>([]);
  const [demandData, setDemandData] = useState<MonthlyDemand[]>([]);
  const [procurementLineData, setProcurementLineData] = useState<
    ProcurementLineData[]
  >([]);
  const [loading, setLoading] = useState(true);

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

        // Transform line data for demand forecasting
        const transformedDemandData = transformDemandData(lineData.rows);
        setDemandData(transformedDemandData);

        // Transform line data for procurement line forecasting
        const transformedProcurementLineData = transformProcurementLineData(
          lineData.rows,
        );
        setProcurementLineData(transformedProcurementLineData);
      } catch (error) {
        console.error("Error fetching sheet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generate historical data options from real data
  const historicalDataOptions = useMemo(() => {
    return generateHistoricalOptions(sheetData);
  }, [sheetData]);

  // Memoized forecast data to prevent duplicate calculations
  const forecastData = useMemo(() => {
    const historical = historicalDataOptions[selectedPeriod];
    return generateMovingAverageForecast(historical);
  }, [selectedPeriod, historicalDataOptions]);

  // Memoized category data and forecast
  const categories = useMemo(() => {
    const allCategories = new Set<string>();
    categoryData.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "month" && key !== "year") {
          allCategories.add(key);
        }
      });
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
    return generateCategoryForecast(categoryData.slice(-12), categories); // Use last 12 months
  }, [categoryData, categories]);

  const categorySpendingData = useMemo(() => {
    const historical = categoryData.slice(-12); // Use last 12 months
    return [...historical, ...categoryForecastData];
  }, [categoryData, categoryForecastData]);

  // Memoized demand forecast data
  const demandForecastData = useMemo(() => {
    if (demandData.length === 0) return [];
    return generateDemandForecast(demandData.slice(-12)); // Use last 12 months
  }, [demandData]);

  const demandSpendingData = useMemo(() => {
    const historical = demandData.slice(-12); // Use last 12 months
    return [...historical, ...demandForecastData];
  }, [demandData, demandForecastData]);

  // Memoized procurement line forecast data
  const monthlyExpenseForecastData = useMemo(() => {
    if (procurementLineData.length === 0) return [];
    return generateMonthlyExpenseForecast(procurementLineData.slice(-12));
  }, [procurementLineData]);

  const categoriesList = useMemo(() => {
    const allCategories = new Set<string>();
    procurementLineData.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (
          key !== "month" &&
          key !== "year" &&
          key !== "date" &&
          key !== "totalQuantity" &&
          key !== "totalAmount"
        ) {
          allCategories.add(key);
        }
      });
    });
    return Array.from(allCategories).sort();
  }, [procurementLineData]);

  const categoryDemandForecastData = useMemo(() => {
    if (procurementLineData.length === 0 || categoriesList.length === 0)
      return [];
    return generateCategoryDemandForecast(
      procurementLineData.slice(-12),
      categoriesList,
    );
  }, [procurementLineData, categoriesList]);

  const spendingData = useMemo(() => {
    const historical = historicalDataOptions[selectedPeriod];
    return [...historical, ...forecastData];
  }, [selectedPeriod, historicalDataOptions, forecastData]);

  // Data validation
  const isDataValid = useMemo(() => {
    return validateSpendingData(spendingData);
  }, [spendingData]);

  // Memoized calculations for better performance
  const statistics = useMemo(() => {
    const historicalData = historicalDataOptions[selectedPeriod];
    console.log("Debug - Selected period:", selectedPeriod);
    console.log("Debug - Historical data for period:", historicalData);

    const actualValues = historicalData
      .filter((d) => d.actual !== null && d.actual > 0)
      .map((d) => d.actual as number);

    console.log("Debug - Actual values:", actualValues);

    // Guard against invalid data
    if (actualValues.length === 0) {
      return {
        averageSpend: 0,
        totalForecast: 0,
        maxForecast: 0,
        forecastGrowth: 0,
      };
    }

    const averageSpend =
      actualValues.reduce((sum: number, val: number) => sum + val, 0) /
      actualValues.length;
    const totalForecast = forecastData.reduce(
      (sum: number, d: any) => sum + d.forecast,
      0,
    );
    const maxForecast = Math.max(...forecastData.map((d: any) => d.forecast));

    // Calculate growth percentage safely
    const forecastGrowth =
      averageSpend > 0
        ? ((totalForecast / forecastData.length - averageSpend) /
            averageSpend) *
          100
        : 0;

    console.log("Statistics Debug:", {
      selectedPeriod,
      averageSpend,
      totalForecast,
      maxForecast,
      forecastGrowth,
      actualValuesLength: actualValues.length,
    });

    return {
      averageSpend,
      totalForecast,
      maxForecast,
      forecastGrowth,
    };
  }, [selectedPeriod, historicalDataOptions, forecastData]);

  // Memoized callback functions
  const getPeriodLabel = useCallback((period: string) => {
    switch (period) {
      case "12months":
        return "Last 12 Months";
      case "2years":
        return "Last 18 Months";
      default:
        return period;
    }
  }, []);

  const getHistoricalMonths = useCallback((period: string) => {
    switch (period) {
      case "12months":
        return 12;
      case "2years":
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
          {/* Procurement Spending Forecast */}
          <ChartContainer
            title="Procurement Spending Forecast"
            subtitle="Historical procurement spending with projected future costs"
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
                    Actual
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
                    Forecast
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
                {["12months", "2years"].map((period) => (
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
                        dataKey="monthLabel"
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 20, right: 20 }}
                        stroke="#6b7280"
                        fontSize={12}
                        xAxisId="primary"
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
                          // Only show year label for the middle month of each year
                          if (!chartData || chartData.length === 0) return "";

                          // Group months by year
                          const yearGroups: { [key: string]: number[] } = {};
                          chartData.forEach((item: any, idx: number) => {
                            const year = item.yearLabel;
                            if (!yearGroups[year]) {
                              yearGroups[year] = [];
                            }
                            yearGroups[year].push(idx);
                          });

                          // Check if this index should show year label (between months 6 and 7)
                          for (const year in yearGroups) {
                            const indices = yearGroups[year];
                            // For 12 months, position between month 6 and 7 (index 6)
                            const targetIndex =
                              indices[6] ||
                              indices[Math.floor(indices.length / 2)];
                            if (index === targetIndex) {
                              return value;
                            }
                          }

                          return "";
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        tickFormatter={(value) =>
                          value === 0
                            ? "0k"
                            : `${(value / 1000).toLocaleString()}k`
                        }
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
                        formatter={(value: number, name: string) => [
                          `${value.toLocaleString()}`,
                          name,
                        ]}
                        labelFormatter={(label, payload) => {
                          // Use MONTH_MAP from outside component to avoid recreation
                          const fullMonth = MONTH_MAP[label] || label;
                          const year = payload[0]?.payload?.yearLabel || "";
                          return `${fullMonth} ${year}`;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{
                          fill: "#3b82f6",
                          r: 2,
                        }}
                        activeDot={{
                          r: 4,
                          fill: "#3b82f6",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        animationDuration={1500}
                        xAxisId="primary"
                        name="Actual"
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={{
                          fill: "#a855f7",
                          r: 2,
                        }}
                        activeDot={{
                          r: 4,
                          fill: "#a855f7",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        animationDuration={1500}
                        xAxisId="primary"
                        name="Forecast"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </ChartContainer>

          {/* Procurement Demand Forecast */}
          <ChartContainer
            title="Procurement Demand Forecast"
            subtitle="Monthly procurement demand with predicted future demand"
            delay={0.4}
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
                    Actual Demand
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
                    Forecast Demand
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
                {["12months", "2years"].map((period) => (
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
                if (demandSpendingData.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="text-gray-400 mb-2">📊</div>
                        <div className="text-sm text-gray-500">
                          No demand data available
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart
                      data={demandSpendingData}
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
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 20, right: 20 }}
                        stroke="#6b7280"
                        fontSize={12}
                        tickMargin={5}
                        xAxisId="primary"
                      />
                      <XAxis
                        dataKey="year"
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
                          // Only show year label for the middle month of each year
                          if (
                            !demandSpendingData ||
                            demandSpendingData.length === 0
                          )
                            return "";

                          // Group months by year
                          const yearGroups: { [key: string]: number[] } = {};
                          demandSpendingData.forEach(
                            (item: any, idx: number) => {
                              const year = item.year;
                              if (!yearGroups[year]) {
                                yearGroups[year] = [];
                              }
                              yearGroups[year].push(idx);
                            },
                          );

                          // Check if this index should show year label (between months 6 and 7)
                          for (const year in yearGroups) {
                            const indices = yearGroups[year];
                            // For 12 months, position between month 6 and 7 (index 6)
                            const targetIndex =
                              indices[6] ||
                              indices[Math.floor(indices.length / 2)];
                            if (index === targetIndex) {
                              return value;
                            }
                          }

                          return "";
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        tickFormatter={(value) => value.toLocaleString()}
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
                        formatter={(value: number, name: string) => [
                          `${value.toLocaleString()}`,
                          name,
                        ]}
                        labelFormatter={(label, payload) => {
                          // Use MONTH_MAP from outside component to avoid recreation
                          const fullMonth = MONTH_MAP[label] || label;
                          const year = payload[0]?.payload?.year || "";
                          return `${fullMonth} ${year}`;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="demand"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{
                          fill: "#3b82f6",
                          r: 2,
                        }}
                        activeDot={{
                          r: 4,
                          fill: "#3b82f6",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        animationDuration={1500}
                        xAxisId="primary"
                        name="Actual Demand"
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={{
                          fill: "#a855f7",
                          r: 2,
                        }}
                        activeDot={{
                          r: 4,
                          fill: "#a855f7",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        animationDuration={1500}
                        xAxisId="primary"
                        name="Forecast Demand"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </ChartContainer>
        </>
      )}
    </div>
  );
}
