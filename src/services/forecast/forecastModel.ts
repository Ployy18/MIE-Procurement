
import { MONTHS, winsorizeSeries, calculateSeasonalFactors } from "./seasonality";
import { calculateTrendSlope } from "./statistics";
import { parseNumber } from "../../utils/dataParser";

export interface MonthlySpend {
  month: string;
  year: string;
  date: number;
  actual: number | null;
  forecast: number | null;
}

export interface ForecastOptions {
  horizon?: number;
  seasonalFactors?: Record<string, number>;
  lastMonth?: string;
  lastYear?: number;
  enableSeasonality?: boolean;
}

export interface ForecastDataPoint {
  month: string;
  year: string;
  date: number;
  actual: number | null;
  forecast: number | null;
  forecast_low?: number;
  forecast_high?: number;
}

export const forecastWeightedMovingAverage = (
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

  const cleanData = data.filter((v) => Number.isFinite(v));

  if (cleanData.length < 6) {
    const lastValue =
      cleanData.length > 0
        ? Math.max(...cleanData.filter((v) => !isNaN(v) && v > 0))
        : 100000;
    const growthRate = 0.05;
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
      const fallback = rollingWindow[rollingWindow.length - 1] || 0;
      forecasts.push(Math.max(0, fallback));
      rollingWindow.push(fallback);
      continue;
    }

    const effectiveWindow = windowValues.slice(-6);
    const baseForecast = weights.reduce(
      (sum, weight, j) =>
        sum + effectiveWindow[effectiveWindow.length - 1 - j] * weight,
      0,
    );

    const trendSlope = calculateTrendSlope(windowValues);
    const trendWeight = Math.min(0.4, 2 / windowValues.length);
    const trendAdjustedForecast = baseForecast + trendSlope * trendWeight;

    let seasonalFactor = 1.0;
    if (enableSeasonality) {
      const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));
      const forecastMonthIndex = (lastMonthIndex + i) % 12;
      const forecastMonth = MONTHS[forecastMonthIndex];

      const rawSeasonalFactor = seasonalFactors[forecastMonth] || 1.0;
      seasonalFactor = Math.max(0.6, Math.min(1.4, rawSeasonalFactor));
    }

    const seasonalForecast = trendAdjustedForecast * seasonalFactor;

    const historicalAvg =
      cleanData.reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0) /
      cleanData.length;

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

    const safeForecastValue = Number.isFinite(forecastValue)
      ? forecastValue
      : 0;
    forecasts.push(safeForecastValue);

    rollingWindow.push(safeForecastValue);
  }

  return forecasts;
};

export const generateMovingAverageForecast = (
  historicalData: MonthlySpend[],
): ForecastDataPoint[] => {
  if (!historicalData.length) return [];

  const values = historicalData.map((d) => parseNumber(d.actual));

  if (values.length < 6) {
    const lastValue = values.length > 0 ? Math.max(...values) : 200000;
    const firstValue =
      values.length > 1 ? Math.min(...values.filter((v) => v > 0)) : lastValue;
    const n = values.length > 1 ? values.length - 1 : 1;

    const cagr =
      firstValue > 0 ? Math.pow(lastValue / firstValue, 1 / n) - 1 : 0.05;
    const growthRate = Math.max(0.01, Math.min(0.5, cagr));

    const lastYearValue = Number(historicalData[historicalData.length - 1].year);
    const lastMonth = historicalData[historicalData.length - 1].month;
    const lastMonthIndex = Math.max(0, MONTHS.indexOf(lastMonth));

    const fallbackForecast = [];
    for (let i = 1; i <= 6; i++) {
      const monthIndex = (lastMonthIndex + i) % 12;
      const yearOffset = Math.floor((lastMonthIndex + i) / 12);
      const forecastYear = (lastYearValue + yearOffset).toString();
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

  let series = [...values];
  if (values.length >= 12) {
    series = winsorizeSeries(values);
  }

  const seriesData = historicalData.map((d) => ({
    month: d.month,
    value: parseNumber(d.actual),
  }));

  if (values.length >= 12) {
    const winsorizedValues = winsorizeSeries(seriesData.map((d) => d.value));
    for (let i = 0; i < seriesData.length; i++) {
      seriesData[i].value = winsorizedValues[i];
    }
  }

  const seasonalFactors = calculateSeasonalFactors(seriesData);

  const errors: number[] = [];
  for (let i = 6; i < seriesData.length; i++) {
    const actualValue = seriesData[i].value;
    const windowValues = seriesData.slice(0, i).map((d) => d.value);

    const backtestForecasts = forecastWeightedMovingAverage(windowValues, {
      horizon: 1,
      enableSeasonality: false,
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

  const enableSeasonality = historicalData.length >= 24;
  const forecasts = forecastWeightedMovingAverage(series, {
    horizon: 6,
    seasonalFactors,
    lastMonth: historicalData[historicalData.length - 1].month,
    lastYear: Number(historicalData[historicalData.length - 1].year),
    enableSeasonality,
  });

  const forecastData: ForecastDataPoint[] = [];
  const lastYearValue = Number(historicalData[historicalData.length - 1].year);
  const lastMonthValue = historicalData[historicalData.length - 1].month;
  const lastMonthIndexValue = Math.max(0, MONTHS.indexOf(lastMonthValue));

  forecasts.forEach((forecastValue, i) => {
    const monthIndex = (lastMonthIndexValue + i + 1) % 12;
    const yearOffset = Math.floor((lastMonthIndexValue + i + 1) / 12);
    const forecastYear = (lastYearValue + yearOffset).toString();
    const forecastMonth = MONTHS[monthIndex];

    const safeForecastValue = Number.isFinite(forecastValue) ? forecastValue : 0;

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

  return forecastData;
};
