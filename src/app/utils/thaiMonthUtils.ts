// Thai month abbreviations for chart display
export const THAI_MONTHS = [
  "ม.ค.", // January
  "ก.พ.", // February
  "มี.ค.", // March
  "เม.ย.", // April
  "พ.ค.", // May
  "มิ.ย.", // June
  "ก.ค.", // July
  "ส.ค.", // August
  "ก.ย.", // September
  "ต.ค.", // October
  "พ.ย.", // November
  "ธ.ค.", // December
];

// Full Thai month names for tooltips
export const THAI_MONTHS_FULL = [
  "มกราคม", // January
  "กุมภาพันธ์", // February
  "มีนาคม", // March
  "เมษายน", // April
  "พฤษภาคม", // May
  "มิถุนายน", // June
  "กรกฎาคม", // July
  "สิงหาคม", // August
  "กันยายน", // September
  "ตุลาคม", // October
  "พฤศจิกายน", // November
  "ธันวาคม", // December
];

// English to Thai month abbreviation mapping
export const ENGLISH_TO_THAI_MONTH: { [key: string]: string } = {
  Jan: "ม.ค.",
  Feb: "ก.พ.",
  Mar: "มี.ค.",
  Apr: "เม.ย.",
  May: "พ.ค.",
  Jun: "มิ.ย.",
  Jul: "ก.ค.",
  Aug: "ส.ค.",
  Sep: "ก.ย.",
  Oct: "ต.ค.",
  Nov: "พ.ย.",
  Dec: "ธ.ค.",
};

// Full English to full Thai month mapping
export const ENGLISH_FULL_TO_THAI_FULL: { [key: string]: string } = {
  January: "มกราคม",
  February: "กุมภาพันธ์",
  March: "มีนาคม",
  April: "เมษายน",
  May: "พฤษภาคม",
  June: "มิถุนายน",
  July: "กรกฎาคม",
  August: "สิงหาคม",
  September: "กันยายน",
  October: "ตุลาคม",
  November: "พฤศจิกายน",
  December: "ธันวาคม",
};

// Function to convert English month abbreviation to Thai
export const convertToThaiMonth = (englishMonth: string): string => {
  return ENGLISH_TO_THAI_MONTH[englishMonth] || englishMonth;
};

// Function to convert English month (abbreviated or full) to full Thai month name
export const convertToThaiMonthFull = (englishMonth: string): string => {
  // First check if it's a full English month name
  if (ENGLISH_FULL_TO_THAI_FULL[englishMonth]) {
    return ENGLISH_FULL_TO_THAI_FULL[englishMonth];
  }

  // Then check if it's an abbreviated English month name
  const monthIndex = Object.keys(ENGLISH_TO_THAI_MONTH).indexOf(englishMonth);
  if (monthIndex >= 0) {
    return THAI_MONTHS_FULL[monthIndex];
  }

  // If it's already a Thai abbreviation, convert to full Thai
  const thaiAbbrevIndex = THAI_MONTHS.indexOf(englishMonth);
  if (thaiAbbrevIndex >= 0) {
    return THAI_MONTHS_FULL[thaiAbbrevIndex];
  }

  // Return original if no match found
  return englishMonth;
};

// Function to get Thai month by index (0-11)
export const getThaiMonthByIndex = (monthIndex: number): string => {
  if (monthIndex >= 0 && monthIndex < 12) {
    return THAI_MONTHS[monthIndex];
  }
  return "";
};

// Function to get full Thai month by index (0-11)
export const getThaiMonthFullByIndex = (monthIndex: number): string => {
  if (monthIndex >= 0 && monthIndex < 12) {
    return THAI_MONTHS_FULL[monthIndex];
  }
  return "";
};
