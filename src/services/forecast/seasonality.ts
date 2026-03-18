
export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function winsorizeSeries(values: number[]): number[] {
  if (values.length < 12) return values;

  const sortedValues = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sortedValues.length * 0.25);
  const q3Index = Math.floor(sortedValues.length * 0.75);
  const q1 = sortedValues[q1Index];
  const q3 = sortedValues[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return values.map((v) => Math.min(Math.max(v, lowerBound), upperBound));
}

export function calculateSeasonalFactors(
  series: { month: string; value: number }[],
): Record<string, number> {
  if (series.length < 24) {
    const factors: Record<string, number> = {};
    MONTHS.forEach((m) => {
      factors[m] = 1.0;
    });
    return factors;
  }

  const movingAverages: number[] = [];
  for (let i = 5; i < series.length; i++) {
    const window = series.slice(i - 5, i + 1).map((d) => d.value);
    const ma = window.reduce((sum, val) => sum + val, 0) / 6;
    movingAverages.push(ma);
  }

  const monthlyRatios: Record<string, number[]> = {};
  series.forEach((d, index) => {
    if (index >= 5 && index < series.length) {
      const movingAverage = movingAverages[index - 5];
      if (movingAverage <= 0) return;

      const month = d.month;
      const actual = d.value;
      const ratio = actual / movingAverage;

      if (!monthlyRatios[month]) {
        monthlyRatios[month] = [];
      }
      monthlyRatios[month].push(ratio);
    }
  });

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

  const sumOfFactors = Object.values(seasonalFactors).reduce(
    (sum, factor) => sum + factor,
    0,
  );
  if (sumOfFactors > 0) {
    Object.keys(seasonalFactors).forEach((month) => {
      seasonalFactors[month] = (seasonalFactors[month] * 12) / sumOfFactors;
    });
  }

  Object.keys(seasonalFactors).forEach((month) => {
    seasonalFactors[month] = Math.max(
      0.6,
      Math.min(1.4, seasonalFactors[month]),
    );
  });

  return seasonalFactors;
}
