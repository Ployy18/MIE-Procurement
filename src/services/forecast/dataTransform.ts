
import { MONTHS } from "./seasonality";
import { parseNumber, parseDateSafe } from "../../utils/dataParser";
import { convertToThaiMonth } from "../../app/utils/thaiMonthUtils";

export interface MonthlySpend {
  month: string;
  year: string;
  date: number;
  actual: number | null;
  forecast: number | null;
}

export interface ProjectBurnRateData {
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

export interface SheetDataRow {
  Date?: string;
  "Net Amount"?: string | number;
  [key: string]: any;
}

// Consistently create month dates
export function createMonthDate(year: string, month: string): Date {
  return new Date(parseInt(year), Math.max(0, MONTHS.indexOf(month)), 1);
}

export const transformProjectBurnRateData = (
  sheetData: SheetDataRow[],
  selectedProject: string,
): ProjectBurnRateData[] => {
  const monthGroups: Record<
    string,
    { month: string; year: string; date: Date; monthly_spend: number }
  > = {};

  sheetData.forEach((row) => {
    const amount = parseNumber(row["Net Amount"]);
    const date = parseDateSafe(row.Date);
    if (!date || isNaN(amount) || amount <= 0) return;

    const year = date.getFullYear().toString();
    const displayYear = (date.getFullYear() + 543).toString();
    const month = MONTHS[date.getMonth()];
    const monthYearKey = `${year}-${month}`;

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

  const sortedMonths = Object.values(monthGroups).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const result: ProjectBurnRateData[] = [];
  let cumulative = 0;

  const totalProjectSpend = sortedMonths.reduce(
    (sum, d) => sum + d.monthly_spend,
    0,
  );

  let budgetValue = 0;
  if (sheetData.length > 0) {
    const firstRow = sheetData[0];
    budgetValue =
      parseNumber(firstRow["Budget"]) ||
      parseNumber(firstRow["Project Budget"]) ||
      parseNumber(firstRow.Budget) ||
      0;
  }

  const fallbackBudget =
    Math.ceil((totalProjectSpend * 1.05) / 100000) * 100000;
  const mockBudget = budgetValue > 0 ? budgetValue : fallbackBudget;

  for (let i = 0; i < sortedMonths.length; i++) {
    const d = sortedMonths[i];
    cumulative += d.monthly_spend;
    result.push({
      month: d.month,
      year: d.year,
      monthLabel: convertToThaiMonth(d.month),
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

export const transformSheetData = (sheetData: SheetDataRow[]): MonthlySpend[] => {
  const monthlyData = sheetData.reduce((acc: Record<string, number>, row) => {
    const date = parseDateSafe(row.Date);
    if (!date) return acc;

    const year = date.getFullYear().toString();
    const month = MONTHS[date.getMonth()];
    const monthYearKey = `${year}-${month}`;

    const amount = parseNumber(row["Net Amount"]);
    if (amount <= 0) return acc;

    acc[monthYearKey] = (acc[monthYearKey] || 0) + amount;
    return acc;
  }, {});

  const monthEntries = Object.entries(monthlyData);
  if (monthEntries.length === 0) return [];

  monthEntries.sort((a, b) => {
    const [year1, month1] = a[0].split("-");
    const [year2, month2] = b[0].split("-");
    const date1 = createMonthDate(year1, month1);
    const date2 = createMonthDate(year2, month2);
    return date1.getTime() - date2.getTime();
  });

  const [firstYear, firstMonth] = monthEntries[0][0].split("-");
  const [lastYear, lastMonth] =
    monthEntries[monthEntries.length - 1][0].split("-");

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

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return result;
};
