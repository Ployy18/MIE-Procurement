
// Trend slope calculation using linear regression
export const calculateTrendSlope = (values: number[]): number => {
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

// Accuracy metrics
import { parseNumber } from "../../utils/dataParser";
import { forecastWeightedMovingAverage } from "./forecastModel";

export interface MonthlySpend {
  month: string;
  year: string;
  date: number;
  actual: number | null;
  forecast: number | null;
}

export const calculateMAPE = (historicalData: MonthlySpend[]): number => {
  if (historicalData.length < 8) return 0;

  const actualValues = historicalData.map((d) => parseNumber(d.actual));
  const errors: number[] = [];

  for (let i = 6; i < historicalData.length; i++) {
    const actualValue = actualValues[i];

    if (actualValue > 0) {
      const windowValues = actualValues.slice(0, i);

      if (windowValues.length >= 6) {
        const backtestForecasts = forecastWeightedMovingAverage(windowValues, {
          horizon: 1,
          enableSeasonality: false,
        });

        if (backtestForecasts.length > 0) {
          const backtestForecast = backtestForecasts[0];
          const percentageError = Math.abs(
            (actualValue - backtestForecast) / actualValue,
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

export const calculateRMSE = (historicalData: MonthlySpend[]): number => {
  if (historicalData.length < 8) return 0;

  const actualValues = historicalData.map((d) => parseNumber(d.actual));
  const errors: number[] = [];

  for (let i = 6; i < historicalData.length; i++) {
    const actualValue = actualValues[i];
    const windowValues = actualValues.slice(0, i);

    if (windowValues.length >= 6) {
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
  }

  return errors.length > 0
    ? Math.sqrt(
        errors.reduce((sum, error) => sum + error * error, 0) / errors.length,
      )
    : 0;
};
