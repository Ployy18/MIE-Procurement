// src/utils/chartAxisUtils.ts

export const shouldShowYearLabel = (
  data: any[],
  index: number,
  yearKey: string,
): string => {
  if (!data?.length) return "";

  const yearGroups: Record<string, number[]> = {};

  // group indices by year
  data.forEach((item, idx) => {
    const year = item?.[yearKey];
    if (!year) return;

    if (!yearGroups[year]) {
      yearGroups[year] = [];
    }

    yearGroups[year].push(idx);
  });

  for (const year in yearGroups) {
    const indices = yearGroups[year];

    const first = indices[0];
    const last = indices[indices.length - 1];

    let labelIndex: number;

    if (indices.length === 1) {
      // only one month
      labelIndex = first;
    } else if (indices.length === 2) {
      // 2 months → best visual position
      labelIndex = first;
    } else {
      // 3+ months → center
      labelIndex = Math.floor((first + last) / 2);
    }

    if (index === labelIndex) {
      return year;
    }
  }

  return "";
};

export const getYearAxisProps = () => ({
  interval: 0,
  tickLine: false,
  axisLine: false,
  height: 30,
  tick: { dy: -2 },
});
