export function parseNumber(value: any): number {
  if (value === null || value === undefined) return 0;

  const clean = String(value).replace(/,/g, "").trim();
  const parsed = parseFloat(clean);

  return isNaN(parsed) ? 0 : parsed;
}

export function parseDateSafe(dateStr: any): Date | null {
  if (!dateStr) return null;

  try {
    if (typeof dateStr === "string" && dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/");
      let y = Number(year);
      // Thai Buddhist calendar year check (2566 -> 2023)
      if (y > 2400) y -= 543;
      return new Date(y, Number(month) - 1, Number(day));
    }

    if (typeof dateStr === "string" && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      let y = Number(parts[0]);
      // Thai Buddhist calendar year check
      if (y > 2400) y -= 543;
      return new Date(y, Number(parts[1]) - 1, Number(parts[2]));
    }

    return new Date(dateStr);
  } catch {
    return null;
  }
}
