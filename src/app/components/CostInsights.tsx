import React, { useState } from "react";

import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  Star,
  ChevronRight,
  Award,
  AlertCircle,
  BarChart3,
  Filter,
  ChevronDown,
  Download,
  Loader2,
  X,
} from "lucide-react";

import { motion } from "motion/react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

import { ChartContainer } from "./ChartContainer";

import { LoadingState } from "./ui/LoadingState";

import {
  getTab1Data,
  getProcurementLineData,
  getSheetDataByName,
} from "../../services/googleSheetsService";

// Constants
const COST_CATEGORIES = {
  SERVICE: "Service",
  MATERIAL: "Material",
  OTHER: "Other",
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "12px 16px",
  fontSize: "16px",
  fontFamily: "inherit",
  lineHeight: 1.5,
  boxShadow:
    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
};

const LEGEND_STYLE = {
  padding: "0px",
  margin: "0px",
  textAlign: "center",
  fontSize: "16px",
  fontWeight: 400,
  color: "#475569",
} as const;

const CATEGORY_COLORS = {
  [COST_CATEGORIES.SERVICE]: "#72d572",
  [COST_CATEGORIES.MATERIAL]: "#29b6f6",
  [COST_CATEGORIES.OTHER]: "#90a4ae",
} as const;

// Helper Functions
const parseDateSafe = (dateStr: string) => {
  if (!dateStr) return 0;

  if (dateStr.includes("/")) {
    const [day, month, year] = dateStr.split("/");
    const y = Number(year) > 2400 ? Number(year) - 543 : Number(year); // Handle Buddhist calendar
    return new Date(y, Number(month) - 1, Number(day)).getTime();
  }

  return new Date(dateStr).getTime();
};

const parseAmount = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Remove commas and parse
    return Number(value.replace(/,/g, "")) || 0;
  }
  return 0;
};

const formatCurrency = (value: number): string => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const calculatePercentage = (value: number, total: number): number => {
  return total > 0 ? (value / total) * 100 : 0;
};

const getCategoryColor = (category: string): string => {
  if (category.toLowerCase().includes(COST_CATEGORIES.SERVICE.toLowerCase())) {
    return CATEGORY_COLORS[COST_CATEGORIES.SERVICE];
  }
  if (category.toLowerCase().includes(COST_CATEGORIES.MATERIAL.toLowerCase())) {
    return CATEGORY_COLORS[COST_CATEGORIES.MATERIAL];
  }
  return CATEGORY_COLORS[COST_CATEGORIES.OTHER];
};

// Item categorization helper
const categorizeItemCode = (code: string) => {
  if (!code) return "Uncategorized";

  if (
    code.startsWith("CAMERA") ||
    code.startsWith("DVR") ||
    code.startsWith("NVR") ||
    code.startsWith("P-CAMERA") ||
    code.startsWith("P-NVR")
  ) {
    return "CCTV";
  }

  if (code.startsWith("HDD") || code.startsWith("SSD")) {
    return "Storage";
  }

  if (
    code.startsWith("SWITCH") ||
    code.startsWith("P-SWITCH") ||
    code.startsWith("LAN") ||
    code.startsWith("SFP")
  ) {
    return "Network";
  }

  if (
    code.startsWith("POWER") ||
    code.startsWith("POWERSUP") ||
    code.startsWith("THW") ||
    code.startsWith("VCT") ||
    code.startsWith("NYY")
  ) {
    return "Power & Electrical";
  }

  if (
    code.startsWith("ACCS") ||
    code.startsWith("BNC") ||
    code.startsWith("CLAMP")
  ) {
    return "Installation Material";
  }

  if (code.startsWith("TONER")) {
    return "Office Supply";
  }

  if (
    code.startsWith("P-PHONE") ||
    code.startsWith("P-IPAD") ||
    code.startsWith("SERVER")
  ) {
    return "IT Device";
  }

  if (code.startsWith("P-SOFTWARE")) {
    return "Software";
  }

  if (code.startsWith("SVSUB")) {
    return "Service Operation";
  }

  if (code.startsWith("SVOTHER")) {
    return "Other Expense";
  }

  if (code.startsWith("SV150100")) {
    return "Finance";
  }

  return "Uncategorized";
};

// Data Processing Helper Functions
const buildCostDistribution = (lineRows: any[]) => {
  const categoryMap = lineRows.reduce((acc: any, row: any) => {
    const category = row.Category || row.category || COST_CATEGORIES.OTHER;
    const amount = parseAmount(row["Total Amount"]);
    acc[category] = (acc[category] || 0) + amount;
    return acc;
  }, {});

  const categoryOrder = [
    COST_CATEGORIES.SERVICE,
    COST_CATEGORIES.MATERIAL,
    COST_CATEGORIES.OTHER,
  ];

  return categoryOrder
    .map((targetName) => {
      const foundEntry = Object.entries(categoryMap).find(
        ([name]) =>
          name.toLowerCase().includes(targetName.toLowerCase()) ||
          (targetName === COST_CATEGORIES.SERVICE &&
            (name.toLowerCase().includes("software") ||
              name.toLowerCase().includes("maintenance"))) ||
          (targetName === COST_CATEGORIES.MATERIAL &&
            (name.toLowerCase().includes("equipment") ||
              name.toLowerCase().includes("hardware"))),
      );

      if (!foundEntry) return null;

      const [name, value] = foundEntry;
      const color = getCategoryColor(targetName);

      return {
        name: targetName,
        value: value as number,
        description: `${targetName} - ${formatCurrency(value as number)}`,
        color: color,
      };
    })
    .filter(Boolean);
};

const buildMonthlyTrend = (lineRows: any[], filters: any) => {
  const categories = [
    ...new Set(
      lineRows.map(
        (row: any) => row.Category || row.category || COST_CATEGORIES.OTHER,
      ),
    ),
  ].filter(Boolean);

  const sortedCategories = categories.sort((a, b) => {
    const aIndex = [
      COST_CATEGORIES.SERVICE,
      COST_CATEGORIES.MATERIAL,
      COST_CATEGORIES.OTHER,
    ].indexOf(a);
    const bIndex = [
      COST_CATEGORIES.SERVICE,
      COST_CATEGORIES.MATERIAL,
      COST_CATEGORIES.OTHER,
    ].indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  const monthlyTrendMap = lineRows.reduce((acc: any, row: any) => {
    const dateStr = row.Date || row.date || row["DATE"];

    if (!dateStr) return acc;

    const date = new Date(dateStr);
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    let yearBE = year < 2400 ? year + 543 : year;

    const monthKey = filters.year === "all" ? `${month}-${yearBE}` : month;

    if (!acc[monthKey]) {
      const monthData: any = {
        month: month,
        yearBE: yearBE,
        fullLabel: monthKey,
        Total: 0,
        _sortKey: date.getTime(),
        _monthIndex: date.getMonth(),
        _year: year,
      };

      sortedCategories.forEach((category: string) => {
        monthData[category] = 0;
      });

      acc[monthKey] = monthData;
    }

    const category = row.Category || row.category || COST_CATEGORIES.OTHER;
    const amount = parseAmount(row["Total Amount"]);

    acc[monthKey].Total += amount;
    if (acc[monthKey][category] !== undefined) {
      acc[monthKey][category] += amount;
    }

    return acc;
  }, {});

  return Object.values(monthlyTrendMap).sort(
    (a: any, b: any) => a._sortKey - b._sortKey,
  );
};

const buildSupplierSpend = (rows: any[]) => {
  const supplierMap = rows.reduce((acc: any, row: any) => {
    const name = (row.Supplier || "Unknown").trim();
    acc[name] = (acc[name] || 0) + parseAmount(row["Total Amount"]);
    return acc;
  }, {});

  return Object.entries(supplierMap)
    .map(([name, totalAmount]) => ({
      name,
      totalAmount: totalAmount as number,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);
};

const buildProjectSpend = (rows: any[]) => {
  const projectMap = rows.reduce((acc: any, row: any) => {
    const projectCode =
      row.Project || row.projectCode || row["Project Code"] || "Unknown";
    acc[projectCode] =
      (acc[projectCode] || 0) + parseAmount(row["Total Amount"]);
    return acc;
  }, {});

  return Object.entries(projectMap)
    .map(([projectCode, totalAmount]) => ({
      projectCode,
      totalAmount: totalAmount as number,
      spendInMillions: (totalAmount as number) / 1000000,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

const buildProjectCategoryMix = (lineRows: any[], filters: any) => {
  const projectCategoryMap = lineRows.reduce((acc: any, row: any) => {
    const projectCode =
      row.Project || row.projectCode || row["Project Code"] || "Unknown";
    const category = row.Category || row.category || COST_CATEGORIES.OTHER;

    if (!acc[projectCode]) {
      acc[projectCode] = {};
    }

    acc[projectCode][category] =
      (acc[projectCode][category] || 0) + parseAmount(row["Total Amount"]);

    return acc;
  }, {});

  return Object.entries(projectCategoryMap)
    .map(([projectCode, categories]) => ({
      project: projectCode,
      ...(categories as Record<string, number>),
      total: Object.values(categories as Record<string, number>).reduce(
        (sum: number, val: number) => sum + (isNaN(val) ? 0 : val),
        0,
      ),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
};

const buildSupplierTrend = (rows: any[]) => {
  const supplierTrendMap = new Map<string, Map<string, number>>();

  rows.forEach((row: any) => {
    const supplier = (row.Supplier || row.supplierName || "Unknown").trim();
    const amount = parseAmount(
      row["Total Amount"] ||
        row["TOTAL AMOUNT"] ||
        row.totalAmount ||
        row.totalPrice ||
        0,
    );

    const dateStr = row.Date || row.date || row["DATE"];
    if (!dateStr) return;

    if (typeof dateStr === "string") {
      if (dateStr.includes("/")) {
        const [d, m, y] = dateStr.split("/").map(Number);
        const finalYear = y < 2400 ? y : y - 543;
        var date = new Date(finalYear, m - 1, d);
      } else if (dateStr.includes("-")) {
        var date = new Date(dateStr);
      }
    } else {
      var date = new Date(dateStr);
    }

    if (!date || isNaN(date.getTime())) return;

    const month = date.toLocaleString("en-US", { month: "short" });
    const year = date.getFullYear();
    const monthKey = `${month}-${year}`;

    if (!supplierTrendMap.has(supplier)) {
      supplierTrendMap.set(supplier, new Map());
    }

    const supplierData = supplierTrendMap.get(supplier)!;

    if (!supplierData.has(monthKey)) {
      supplierData.set(monthKey, 0);
    }

    supplierData.set(monthKey, supplierData.get(monthKey)! + amount);
  });

  const supplierTrendArray = Array.from(supplierTrendMap.entries())
    .map(([supplier, monthData]) => {
      const monthlyData = Array.from(monthData.entries())
        .map(([month, amount]) => {
          const [monthName, yearStr] = month.split("-");
          const year = parseInt(yearStr);
          const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
          const sortKey = new Date(year, monthIndex, 1).getTime();

          return {
            month,
            amount,
            sortKey,
          };
        })
        .sort((a, b) => a.sortKey - b.sortKey);

      return {
        supplier: supplier,
        data: monthlyData.map(({ month, amount }) => ({
          month,
          amount,
        })),
      };
    })
    .filter((supplier) => supplier.data.length > 0);

  if (supplierTrendArray.length > 0) {
    const allSupplierMap = new Map<string, number>();

    supplierTrendArray.forEach((supplier) => {
      supplier.data.forEach((monthData) => {
        const currentAmount = allSupplierMap.get(monthData.month) || 0;
        allSupplierMap.set(monthData.month, currentAmount + monthData.amount);
      });
    });

    const allSupplierData = Array.from(allSupplierMap.entries())
      .map(([month, amount]) => {
        const [monthName, yearStr] = month.split("-");
        const year = parseInt(yearStr);
        const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
        const sortKey = new Date(year, monthIndex, 1).getTime();

        return {
          month,
          amount,
          sortKey,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ month, amount }) => ({
        month,
        amount,
      }));

    supplierTrendArray.unshift({
      supplier: "All Suppliers",
      data: allSupplierData,
    });
  }

  return supplierTrendArray;
};

const buildPOVolumeData = (rows: any[], filters: any) => {
  const poVolumeMap = rows.reduce((acc: any, row: any) => {
    const dateStr = row.Date || row.date || row["DATE"];
    const poNumber = row["PO Number"] || row.poNumber;

    if (!dateStr || !poNumber) return acc;

    const date = new Date(dateStr);
    const month = date.toLocaleString("en-US", { month: "short" });
    const monthFull = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    let yearBE = year < 2400 ? year + 543 : year;

    const monthKey = `${month}-${yearBE}`;

    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: month,
        monthFull: monthFull,
        monthLabel: month,
        yearBE: yearBE,
        yearLabel: yearBE.toString(),
        fullLabel: monthKey,
        poCount: 0,
        _sortKey: date.getTime(),
        poDetails: [],
      };
    }

    acc[monthKey].poCount += 1;

    acc[monthKey].poDetails.push({
      poNumber: poNumber,
      date: dateStr,
      totalAmount: parseAmount(row["Total Amount"]),
      category: row.Category || row.category || COST_CATEGORIES.OTHER,
      description: row.Description || row.description || "No description",
      projectCode: row.Project || row.project || "",
    });

    return acc;
  }, {});

  return Object.values(poVolumeMap)
    .sort((a: any, b: any) => a._sortKey - b._sortKey)
    .map(({ _sortKey, ...item }: any) => item);
};

interface SupplierData {
  id: string;

  name: string;

  totalSpend: number;

  poCount: number;

  avgPoValue: number;

  lastPurchaseDate: string;

  trend: "up" | "down" | "stable";

  trendPercentage: number;

  rating: "gold" | "silver" | "bronze";

  categories: string[];

  riskLevel: "low" | "medium" | "high";

  paymentTerms: string;

  contractValue?: number;
}

// Data from Google Sheets - df_HEADER (Real Category Cost Analysis)

const categoryData = [
  { name: "Equipment (HW)", value: 550000, color: "#6366f1" },

  { name: "Software / Licenses", value: 120000, color: "#8b5cf6" },

  { name: "Maintenance", value: 80000, color: "#ec4899" },

  { name: "Services / Labor", value: 100000, color: "#06b6d4" },
];

// Data from Google Sheets - df_HEADER (Real Budget vs Spend Analysis)

const comparisonData = [
  { name: "Cameras", budget: 4000, spend: 3800 },

  { name: "Storage", budget: 3000, spend: 2800 },

  { name: "Network", budget: 2000, spend: 2200 },

  { name: "Cabling", budget: 1500, spend: 1200 },

  { name: "Install", budget: 1800, spend: 1900 },
];

// Data from Google Sheets - df_LINE (Purchase Order Line Items)

const items = [
  {
    id: 1,

    name: "Hikvision 4K Dome Camera",

    category: "Equipment",

    supplier: "Hikvision",

    price: "245.00",

    qty: 50,

    total: "12,250",
  },

  {
    id: 2,

    name: "NVR 64-Channel",

    category: "Equipment",

    supplier: "Dahua",

    price: "1,200.00",

    qty: 5,

    total: "6,000",
  },

  {
    id: 3,

    name: "Cat6 Cable Roll (305m)",

    category: "Cabling",

    supplier: "Belden",

    price: "120.00",

    qty: 20,

    total: "2,400",
  },

  {
    id: 4,

    name: "Annual Maintenance Contract",

    category: "Maintenance",

    supplier: "LocalService Co.",

    price: "15,000.00",

    qty: 1,

    total: "15,000",
  },

  {
    id: 5,

    name: "Cisco Switch 48-Port PoE",

    category: "Network",

    supplier: "Cisco",

    price: "2,800.00",

    qty: 4,

    total: "11,200",
  },
];

// Data from Google Sheets - Aggregated Supplier Spend Analysis

const supplierSpendDataInitial = [
  { name: "ออล ไอ แคน 3536 จำกัด", totalAmount: 1969350 },

  { name: "LocalService Co.", totalAmount: 15000 },

  { name: "Cisco", totalAmount: 11200 },

  { name: "Hikvision", totalAmount: 12250 },

  { name: "Dahua", totalAmount: 6000 },

  { name: "Belden", totalAmount: 2400 },
];

// Data from Google Sheets - df_HEADER (Supplier Profile Data)

const mockSupplierDataInitial: SupplierData = {
  id: "1",

  name: "ออล ไอ แคน 3536 จำกัด",

  totalSpend: 1969350,

  poCount: 8,

  avgPoValue: 246168.75,

  lastPurchaseDate: "2025-02-15",

  trend: "up",

  trendPercentage: 12.5,

  rating: "gold",

  categories: ["Equipment", "Services", "Maintenance"],

  riskLevel: "low",

  paymentTerms: "NET 30",

  contractValue: 2500000,
};

// Data from Google Sheets - df_HEADER (Monthly Trend Analysis)

const monthlyTrendData = [
  { month: "Oct", value: 180000 },

  { month: "Nov", value: 220000 },

  { month: "Dec", value: 195000 },

  { month: "Jan", value: 245000 },

  { month: "Feb", value: 196935 },
];

// Data from Google Sheets - df_HEADER (Category Breakdown)

const categoryBreakdown = [
  { name: "Equipment", value: 1200000, percentage: 61 },

  { name: "Services", value: 550000, percentage: 28 },

  { name: "Maintenance", value: 219350, percentage: 11 },
];

// Data from Google Sheets - df_HEADER (Performance Metrics)

const performanceMetricsInitial = [
  { metric: "On-Time Delivery", value: 95, target: 90 },

  { metric: "Quality Score", value: 4.8, target: 4.5 },

  { metric: "Price Competitiveness", value: 8.2, target: 7.5 },

  { metric: "Response Time", value: 2.4, target: 3.0 },
];
const ExpenseTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];

  return (
    <div style={TOOLTIP_STYLE}>
      {/* LABEL */}
      <div
        style={{
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
          fontSize: "18px",
          lineHeight: 1.5,
        }}
      >
        {label ?? item.name}
      </div>

      {/* VALUE */}
      <div
        style={{
          color: "#111827",
          fontWeight: 400,
          fontSize: "16px",
          lineHeight: 1.5,
        }}
      >
        Total Amount :{" "}
        {Number(item.value).toLocaleString(undefined, {
          minimumFractionDigits: Number(item.value) % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
};

// Custom Tooltip Component for Supplier Cards
const SupplierTooltip = ({
  supplier,
  position,
}: {
  supplier: any;
  position: { x: number; y: number };
}) => {
  if (!supplier) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y - 10,
        transform: "translateY(-100%)",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "12px 16px",
          fontSize: "16px",
          fontFamily: "inherit",
          lineHeight: 1.5,
          boxShadow:
            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Supplier Name - Bold */}
        <div
          style={{
            fontWeight: 700,
            color: "#111827",
            marginBottom: "8px",
            fontSize: "18px",
            lineHeight: 1.5,
          }}
        >
          {supplier.name}
        </div>

        {/* Service */}
        {supplier.service > 0 && (
          <div
            style={{
              color: "#111827",
              fontWeight: 400,
              fontSize: "16px",
              marginBottom: "0px",
              lineHeight: 1.5,
            }}
          >
            Service :{" "}
            {Number(((supplier.service / supplier.total) * 100).toFixed(1)) ===
            (supplier.service / supplier.total) * 100
              ? ((supplier.service / supplier.total) * 100).toFixed(0)
              : ((supplier.service / supplier.total) * 100).toFixed(1)}
            % -{" "}
            {supplier.service.toLocaleString(undefined, {
              minimumFractionDigits: supplier.service % 1 === 0 ? 0 : 2,
              maximumFractionDigits: 2,
            })}
          </div>
        )}

        {/* Material */}
        {supplier.material > 0 && (
          <div
            style={{
              color: "#111827",
              fontWeight: 400,
              fontSize: "16px",
              marginBottom: "0px",
              lineHeight: 1.5,
            }}
          >
            Material :{" "}
            {Number(((supplier.material / supplier.total) * 100).toFixed(1)) ===
            (supplier.material / supplier.total) * 100
              ? ((supplier.material / supplier.total) * 100).toFixed(0)
              : ((supplier.material / supplier.total) * 100).toFixed(1)}
            % -{" "}
            {supplier.material.toLocaleString(undefined, {
              minimumFractionDigits: supplier.material % 1 === 0 ? 0 : 2,
              maximumFractionDigits: 2,
            })}
          </div>
        )}

        {/* Other */}
        {supplier.other > 0 && (
          <div
            style={{
              color: "#111827",
              fontWeight: 400,
              fontSize: "16px",
              lineHeight: 1.5,
            }}
          >
            Other :{" "}
            {Number(((supplier.other / supplier.total) * 100).toFixed(1)) ===
            (supplier.other / supplier.total) * 100
              ? ((supplier.other / supplier.total) * 100).toFixed(0)
              : ((supplier.other / supplier.total) * 100).toFixed(1)}
            % -{" "}
            {supplier.other.toLocaleString(undefined, {
              minimumFractionDigits: supplier.other % 1 === 0 ? 0 : 2,
              maximumFractionDigits: 2,
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export function CostInsights({
  filters,
}: {
  filters: { year: string; project: string };
}) {
  const [activeTab, setActiveTab] = useState<
    "category" | "supplier" | "performance"
  >("category");

  const [expandedSections, setExpandedSections] = useState<string[]>([
    "supplier-overview",

    "spending",
  ]);

  const [loading, setLoading] = useState(true);

  const [supplierSpendData, setSupplierSpendData] = useState<any[]>([]);

  const [categoryData, setCategoryData] = useState<any[]>([]);

  const [lineData, setLineData] = useState<any>(null);

  const [recentItems, setRecentItems] = useState<any[]>([]);

  const [costDistributionData, setCostDistributionData] = useState<any[]>([]);

  const [monthlyTrendByCategoryData, setMonthlyTrendByCategoryData] = useState<
    any[]
  >([]);

  const [itemSubcategoryData, setItemSubcategoryData] = useState<any[]>([]);

  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");

  const [supplierTrendData, setSupplierTrendData] = useState<any[]>([]);

  // Project analysis data
  const [projectSpendData, setProjectSpendData] = useState<any[]>([]);
  const [projectMonthlyTrendData, setProjectMonthlyTrendData] = useState<any[]>(
    [],
  );
  const [projectCategoryMixData, setProjectCategoryMixData] = useState<any[]>(
    [],
  );
  const [poVolumeData, setPoVolumeData] = useState<any[]>([]);

  // PO Details Modal state
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedMonthPOs, setSelectedMonthPOs] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [modalSource, setModalSource] = useState<"project" | "volume">(
    "project",
  ); // Track modal source

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryPOs, setSelectedCategoryPOs] = useState<any[]>([]);
  const [loadingCategoryPOs, setLoadingCategoryPOs] = useState(false);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");

  // Tooltip state for supplier cards
  const [hoveredSupplier, setHoveredSupplier] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // palette used for item group bars, can be customized or extended
  const subcategoryColors = [
    "#f97316",
    "#374151",
    "#9ca3af",
    "#fbcfe8",
    "#d97706",
    "#4ade80",
    "#60a5fa",
    "#34d399",
    "#f472b6",
  ];

  // derive total for percentage labels
  const totalSubcategory = React.useMemo(
    () => itemSubcategoryData.reduce((sum, d) => sum + (d.value || 0), 0),
    [itemSubcategoryData],
  );

  // Memoized calculations for better performance
  const spendingTrendChartData = React.useMemo(
    () =>
      monthlyTrendByCategoryData.map((d: any) => ({
        ...d,
        monthLabel: d.month.slice(0, 3),
        yearLabel: d.yearBE,
      })),
    [monthlyTrendByCategoryData],
  );

  const allCategories = React.useMemo(
    () =>
      [
        ...new Set(
          monthlyTrendByCategoryData.flatMap((d: any) =>
            Object.keys(d).filter(
              (key) =>
                key !== "month" &&
                key !== "yearBE" &&
                key !== "fullLabel" &&
                key !== "Total" &&
                key !== "_sortKey" &&
                key !== "_monthIndex" &&
                key !== "_year" &&
                key !== "monthLabel" &&
                key !== "yearLabel",
            ),
          ),
        ),
      ].filter(Boolean),
    [monthlyTrendByCategoryData],
  );

  // Memoized heavy calculations for better performance
  const totalCostDistribution = React.useMemo(
    () => costDistributionData.reduce((sum: number, d) => sum + d.value, 0),
    [costDistributionData],
  );

  const formattedTotalCostDistribution = React.useMemo(
    () =>
      totalCostDistribution.toLocaleString(undefined, {
        minimumFractionDigits: totalCostDistribution % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }),
    [totalCostDistribution],
  );

  const costBreakdownItems = React.useMemo(
    () =>
      costDistributionData.map((item: any, index: number) => {
        const percentage = ((item.value / totalCostDistribution) * 100).toFixed(
          1,
        );

        return {
          ...item,
          percentage,
          formattedValue: formatCurrency(item.value),
        };
      }),
    [costDistributionData, totalCostDistribution],
  );

  // Memoized supplier data processing
  const supplierBreakdownData = React.useMemo(() => {
    if (!lineData || !lineData.rows || loading) {
      return { suppliersWithCategories: [], maxTotal: 0 };
    }

    // Get supplier data with category breakdown from procurement_line
    const supplierCategoryMap = new Map();

    if (lineData && lineData.rows && Array.isArray(lineData.rows)) {
      // Apply the same filters as used in data fetching
      let filteredRows = [...lineData.rows];

      // Apply year filter
      if (filters.year !== "all") {
        filteredRows = filteredRows.filter((row: any) => {
          const dateStr = row.Date || row.date || row["DATE"];

          if (dateStr) {
            // Use parseDateSafe to get timestamp, then extract year
            const timestamp = parseDateSafe(dateStr);
            if (timestamp > 0) {
              const year = new Date(timestamp).getFullYear();
              return year.toString() === filters.year;
            }
          }

          return false;
        });
      }

      // Apply project filter
      if (filters.project !== "all") {
        filteredRows = filteredRows.filter(
          (row: any) =>
            (row.Project || row.projectCode || row["Project Code"]) ===
            filters.project,
        );
      }

      filteredRows.forEach((row: any) => {
        const supplier = row.Supplier || row.supplierName || "Unknown";
        const category = (
          row.Category ||
          row.category ||
          "Other"
        ).toLowerCase();
        const amount = parseAmount(
          row["Total Amount"] || row.totalPrice || row.total || 0,
        );

        if (!supplierCategoryMap.has(supplier)) {
          supplierCategoryMap.set(supplier, {
            service: 0,
            material: 0,
            other: 0,
            total: 0,
          });
        }

        const supplierData = supplierCategoryMap.get(supplier);
        if (category === "service") {
          supplierData.service += amount;
        } else if (category === "material") {
          supplierData.material += amount;
        } else {
          supplierData.other += amount;
        }
        supplierData.total += amount;
      });
    }

    // Convert to array and sort by total
    const suppliersWithCategories = Array.from(supplierCategoryMap.entries())
      .map(([name, data]) => ({
        name,
        ...data,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const maxTotal = Math.max(...suppliersWithCategories.map((s) => s.total));

    return { suppliersWithCategories, maxTotal };
  }, [lineData, loading, filters]);

  const supplierChartData = React.useMemo(() => {
    const { suppliersWithCategories, maxTotal } = supplierBreakdownData;

    return suppliersWithCategories.map((supplier, index) => {
      const total = suppliersWithCategories.reduce(
        (sum, s) => sum + s.total,
        0,
      );
      const percentage = total ? (supplier.total / total) * 100 : 0;
      const barWidth = (supplier.total / maxTotal) * 100;

      return {
        ...supplier,
        total,
        percentage,
        barWidth,
        formattedTotal: formatCurrency(supplier.total),
      };
    });
  }, [supplierBreakdownData]);

  // Memoized project section calculations
  const projectTotalSpend = React.useMemo(
    () =>
      projectSpendData.reduce((sum, project) => sum + project.totalAmount, 0),
    [projectSpendData],
  );

  const formattedProjectTotalSpend = React.useMemo(
    () =>
      projectTotalSpend.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [projectTotalSpend],
  );

  const projectChartData = React.useMemo(
    () =>
      projectSpendData.map((project, index) => {
        const maxSpend = Math.max(
          ...projectSpendData.map((p) => p.totalAmount),
        );
        const barWidth =
          maxSpend > 0 ? (project.totalAmount / maxSpend) * 100 : 0;
        const totalSpend = projectTotalSpend;
        const percentage =
          totalSpend > 0 ? (project.totalAmount / totalSpend) * 100 : 0;

        return {
          ...project,
          barWidth,
          percentage: percentage.toFixed(1),
          formattedTotal: formatCurrency(project.totalAmount),
        };
      }),
    [projectSpendData, projectTotalSpend],
  );

  // Memoized supplier trend chart data
  const supplierTrendChartData = React.useMemo(() => {
    const selectedData =
      selectedSupplier === "all"
        ? supplierTrendData.find((s) => s.supplier === "All Suppliers")?.data ||
          []
        : supplierTrendData.find((s) => s.supplier === selectedSupplier)
            ?.data || [];

    if (selectedData.length === 0) return [];

    // Prepare chartData with distinct month/year labels to mirror Monthly Expense Overview
    return selectedData.map((d: any) => {
      const [mon, yr] = d.month.split("-");
      return {
        ...d,
        monthLabel: mon.slice(0, 3),
        yearLabel: yr,
      };
    });
  }, [supplierTrendData, selectedSupplier]);

  // Memoized project category mix bar configuration
  const projectCategoryBars = React.useMemo(() => {
    const allCategories = new Set<string>();
    projectCategoryMixData.forEach((project) => {
      Object.keys(project).forEach((key) => {
        if (key !== "project" && key !== "total") {
          allCategories.add(key);
        }
      });
    });

    const categoryColors: { [key: string]: string } = {
      Service: "#72d572",
      Material: "#29b6f6",
      Equipment: "#ff9800",
      Maintenance: "#9c27b0",
      Other: "#90a4ae",
    };

    const categoryOrder = ["Other", "Material", "Service"];

    return categoryOrder
      .filter((category) => allCategories.has(category))
      .map((category, index) => (
        <Bar
          key={category}
          dataKey={category}
          stackId="a"
          fill={categoryColors[category] || `hsl(${index * 60}, 70%, 50%)`}
          radius={[4, 4, 4, 4]}
        />
      ));
  }, [projectCategoryMixData]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch procurement_line data
        let lineDataResponse = null;
        try {
          lineDataResponse = await getProcurementLineData();
          setLineData(lineDataResponse);
        } catch (e) {
          console.error("Error fetching procurement line data:", e);
          setLineData({ rows: [] });
        }

        let lineRows = lineDataResponse ? lineDataResponse.rows : [];

        // Fetch procurement_head data
        let headDataResponse = null;
        try {
          headDataResponse = await getTab1Data();
        } catch (e) {
          console.error("Error fetching tab1 data:", e);
          headDataResponse = { rows: [] };
        }

        let headRows = headDataResponse.rows;

        // Apply filters to head data
        if (filters.year !== "all") {
          headRows = headRows.filter((row: any) => {
            const dateStr = row.Date || row.date || row["DATE"];
            if (dateStr) {
              // Use parseDateSafe to get timestamp, then extract year
              const timestamp = parseDateSafe(dateStr);
              if (timestamp > 0) {
                const year = new Date(timestamp).getFullYear();
                return year.toString() === filters.year;
              }
            }
            return false;
          });
        }

        if (filters.project !== "all") {
          headRows = headRows.filter(
            (row: any) =>
              (row.Project || row.projectCode || row["Project Code"]) ===
              filters.project,
          );
        }

        // Process data using helper functions
        setCostDistributionData(buildCostDistribution(lineRows));
        const monthlyTrendData = buildMonthlyTrend(lineRows, filters);
        setMonthlyTrendByCategoryData(monthlyTrendData);

        // Calculate Item/Subcategory Breakdown
        const subcategoryMap = lineRows.reduce((acc: any, row: any) => {
          const itemCode = row["Item Code"] || row.itemCode || "";
          const category = categorizeItemCode(itemCode);
          const amount = parseAmount(row["Total Amount"]);
          acc[category] = (acc[category] || 0) + amount;
          return acc;
        }, {});

        const itemSubcategoryArray = Object.entries(subcategoryMap)
          .map(([name, value]) => ({
            name,
            value: value as number,
          }))
          .sort((a, b) => b.value - a.value);

        setItemSubcategoryData(itemSubcategoryArray);

        // Process head data
        setSupplierSpendData(buildSupplierSpend(headRows));
        setProjectSpendData(buildProjectSpend(headRows));
        setProjectCategoryMixData(buildProjectCategoryMix(lineRows, filters));
        setPoVolumeData(buildPOVolumeData(headRows, filters));

        // Category Breakdown
        const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b"];
        const catMap = headRows.reduce((acc: any, row: any) => {
          const cat = row.Category || row.category || COST_CATEGORIES.OTHER;
          acc[cat] = (acc[cat] || 0) + parseAmount(row["Total Amount"]);
          return acc;
        }, {});

        setCategoryData(
          Object.entries(catMap).map(([name, value], i) => ({
            name,
            value: value as number,
            color: colors[i % colors.length],
          })),
        );

        setSupplierTrendData(buildSupplierTrend(headRows));
      } catch (e: any) {
        console.error("Error in data processing:", e);
        console.error("Error details:", {
          message: e?.message || "Unknown error",
          stack: e?.stack || "No stack trace",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  // Function to fetch PO details for a specific category or supplier
  const fetchCategoryPOs = async (categoryName: string) => {
    setLoadingCategoryPOs(true);
    try {
      // Get both procurement_line and procurement_head data
      const [lineDataResponse, headDataResponse] = await Promise.all([
        getSheetDataByName("procurement_line"),
        getTab1Data(),
      ]);

      const lineRows = lineDataResponse.rows || [];
      const headRows = headDataResponse.rows || [];

      // Check if this is a supplier name (contains common supplier keywords) or category
      const isSupplier =
        categoryName.includes("จำกัด") ||
        categoryName.includes("Company") ||
        categoryName.includes("บริษัท") ||
        categoryName.includes("Co.") ||
        supplierSpendData.some((supplier) => supplier.name === categoryName);

      // Set modal title based on type
      const modalTitle = isSupplier
        ? "PO Details by Supplier"
        : "PO Details by Category";
      setSelectedSupplierName(modalTitle);

      // Filter line data by category name or supplier name and existing dashboard filters
      let categoryRows = lineRows.filter((row: any) => {
        if (isSupplier) {
          // Filter by supplier name
          const supplier = row.Supplier || row.supplier || "";
          return supplier === categoryName;
        } else {
          // Filter by category name (case-insensitive and partial match)
          const category = row.Category || row.category || "Other";
          return (
            category.toLowerCase().includes(categoryName.toLowerCase()) ||
            categoryName.toLowerCase().includes(category.toLowerCase())
          );
        }
      });

      // Apply year/project filters if active
      if (filters.year !== "all") {
        categoryRows = categoryRows.filter((row: any) => {
          const dateStr = row.Date || row.date || row["DATE"];
          if (dateStr) {
            // Use parseDateSafe to get timestamp, then extract year
            const timestamp = parseDateSafe(dateStr);
            if (timestamp > 0) {
              const year = new Date(timestamp).getFullYear();
              return year.toString() === filters.year;
            }
          }
          return false;
        });
      }
      if (filters.project !== "all") {
        categoryRows = categoryRows.filter(
          (row: any) =>
            (row.Project || row.projectCode || row["Project Code"]) ===
            filters.project,
        );
      }

      // Group by PO Number
      const poGroups = categoryRows.reduce(
        (acc: Record<string, any>, row: any) => {
          const poNo = row["PO Number"];
          if (!acc[poNo]) {
            acc[poNo] = {
              poNumber: poNo,
              date: row.Date || row.date || row["DATE"],
              projectCode:
                row.Project || row.projectCode || row["Project Code"],
              totalAmount: 0,
              lineItems: [],
            };
          }
          acc[poNo].lineItems.push({
            category: row.Category || row.category || "Other",
            unitPrice: parseAmount(row["Unit Price"]),
            amount: parseAmount(row["Total Amount"]),
            description: row.Description || row.description || "-",
            itemCode: row["Item Code"] || row.itemCode || "-",
            supplier: row.Supplier || row.supplier || "-",
          });
          return acc;
        },
        {},
      );

      // Get total amounts from procurement_head for each PO
      Object.keys(poGroups).forEach((poNo) => {
        const headRow = headRows.find(
          (row: any) => String(row["PO Number"] || row.poNumber) === poNo,
        );
        if (headRow) {
          poGroups[poNo].totalAmount =
            parseAmount(
              String(headRow["Total Amount"] || headRow.totalPrice || 0),
            ) || 0;
        }
      });

      const sortedPOs = Object.values(poGroups).sort((a: any, b: any) => {
        const dateA = parseDateSafe(a.date);
        const dateB = parseDateSafe(b.date);
        return dateB - dateA; // Sort descending
      });

      console.log("Fetched POs:", sortedPOs); // Debug log
      setSelectedCategoryPOs(sortedPOs);
      setSelectedSupplierName(categoryName); // Set the actual name for title
      setShowCategoryModal(true);
    } catch (error) {
      console.error("Error fetching category POs:", error);
    } finally {
      setLoadingCategoryPOs(false);
    }
  };

  // Function to handle category click
  const handleCategoryClick = (categoryName: string) => {
    fetchCategoryPOs(categoryName);
  };

  // Function to close category modal
  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setSelectedCategoryPOs([]);
    setSelectedSupplierName("");
  };

  // Function to handle PO Volume bar click
  const handlePOVolumeClick = (data: any) => {
    console.log("handlePOVolumeClick called with:", data);
    // Don't show modal for PO Volume Trend - just log the data
    if (data && data.poDetails) {
      console.log("PO Details found:", data.poDetails);
      // Modal disabled for PO Volume Trend
      // setSelectedMonthPOs(data.poDetails);
      // setModalSource("volume");
      // setShowPOModal(true);
    } else {
      console.log("No PO details found in data");
    }
  };

  // Function to close PO modal
  const closePOModal = () => {
    setShowPOModal(false);
    setSelectedMonthPOs([]);
  };

  // Function to handle project click
  const handleProjectClick = async (projectCode: string) => {
    try {
      setLoadingPOs(true);
      setSelectedMonthPOs([]);

      // Get both procurement_line and procurement_head data
      const [lineDataResponse, headDataResponse] = await Promise.all([
        getProcurementLineData(),
        getTab1Data(),
      ]);

      const lineRows = lineDataResponse.rows || [];
      const headRows = headDataResponse.rows || [];

      // Filter POs by project code from line data
      const projectPOs = lineRows.filter((row: any) => {
        const project = row.Project || row.project || row.projectCode || "";
        return project === projectCode;
      });

      // Group by PO number and create PO details
      const poMap = new Map();
      projectPOs.forEach((row: any) => {
        const poNumber = row["PO Number"] || row.poNumber || "";
        if (!poNumber) return;

        if (!poMap.has(poNumber)) {
          poMap.set(poNumber, {
            poNumber: poNumber,
            date: row.Date || row.date || "",
            totalAmount: 0, // Will be updated from head data
            category: row.Category || row.category || "Other",
            description: row.Description || row.description || "No description",
            projectCode: projectCode,
            lineItems: [],
          });
        }

        // Add line item
        const po = poMap.get(poNumber);
        po.lineItems.push({
          itemCode: row["Item Code"] || row.itemCode || "",
          description: row.Description || row.description || "No description",
          category: row.Category || row.category || "Other",
          amount: parseAmount(row["Total Amount"] || row.totalPrice || 0),
        });
      });

      // Get total amounts from procurement_head for each PO
      poMap.forEach((poData, poNumber) => {
        const headRow = headRows.find(
          (row: any) => String(row["PO Number"] || row.poNumber) === poNumber,
        );
        if (headRow) {
          poData.totalAmount =
            parseAmount(
              String(headRow["Total Amount"] || headRow.totalPrice || 0),
            ) || 0;
        }
      });

      const poDetails = Array.from(poMap.values());
      setSelectedMonthPOs(poDetails);
      setModalSource("project"); // Set source to project
      setShowPOModal(true);
    } catch (error) {
      console.error("Error fetching project POs:", error);
    } finally {
      setLoadingPOs(false);
    }
  };

  const mockSupplierData: SupplierData = React.useMemo(
    () => ({
      id: "1",
      name:
        supplierSpendData && supplierSpendData.length > 0
          ? supplierSpendData[0].name
          : "Loading...",
      totalSpend:
        supplierSpendData && supplierSpendData.length > 0
          ? supplierSpendData[0].totalAmount
          : 0,
      poCount: 0,
      avgPoValue: 0,
      lastPurchaseDate: "2025-02-15",
      trend: "up",
      trendPercentage: 12.5,
      rating: "gold",
      categories: ["Equipment", "Services", "Maintenance"],
      riskLevel: "low",
      paymentTerms: "NET 30",
    }),
    [supplierSpendData],
  );

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "gold":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";

      case "silver":
        return "bg-gray-100 text-gray-800 border-gray-200";

      case "bronze":
        return "bg-orange-100 text-orange-800 border-orange-200";

      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "bg-green-100 text-green-800";

      case "medium":
        return "bg-yellow-100 text-yellow-800";

      case "high":
        return "bg-red-100 text-red-800";

      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}

      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab("category")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "category"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Category Analysis
          </button>

          <button
            onClick={() => setActiveTab("supplier")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "supplier"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Supplier Intelligence
          </button>

          <button
            onClick={() => setActiveTab("performance")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "performance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Project Analysis
          </button>
        </div>
      </div>

      {/* Tab Content */}

      <div className="mt-6">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {activeTab === "category" && (
              <div className="space-y-6">
                {/* Cost Distribution by Category - Horizontal Layout */}

                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Donut Chart - Full Width */}
                  <div className="lg:w-full">
                    <ChartContainer
                      title="Cost Distribution by Category"
                      subtitle="Shows spending distribution across categories"
                      delay={0.1}
                      className="px-8 pt-6 pb-8"
                      headerAction={
                        <ul
                          className="recharts-default-legend"
                          style={{
                            padding: "0px",
                            margin: "0px",
                            textAlign: "center",
                            fontSize: "16px",
                            fontWeight: 400,
                            color: "#475569",
                          }}
                        >
                          <li
                            className="recharts-legend-item legend-item-0"
                            style={{
                              display: "inline-block",
                              marginRight: "10px",
                            }}
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
                                fill="#72d572"
                                cx="16"
                                cy="16"
                                className="recharts-symbols"
                                transform="translate(16, 16)"
                                d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                              ></path>
                            </svg>
                            <span
                              className="recharts-legend-item-text"
                              style={{ color: "rgb(114, 213, 115)" }}
                            >
                              Service
                            </span>
                          </li>
                          <li
                            className="recharts-legend-item legend-item-1"
                            style={{
                              display: "inline-block",
                              marginRight: "10px",
                            }}
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
                                fill="#29b6f6"
                                cx="16"
                                cy="16"
                                className="recharts-symbols"
                                transform="translate(16, 16)"
                                d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                              ></path>
                            </svg>
                            <span
                              className="recharts-legend-item-text"
                              style={{ color: "rgb(41, 182, 246)" }}
                            >
                              Material
                            </span>
                          </li>
                          <li
                            className="recharts-legend-item legend-item-2"
                            style={{
                              display: "inline-block",
                              marginRight: "10px",
                            }}
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
                                fill="#90a4ae"
                                cx="16"
                                cy="16"
                                className="recharts-symbols"
                                transform="translate(16, 16)"
                                d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                              ></path>
                            </svg>
                            <span
                              className="recharts-legend-item-text"
                              style={{ color: "rgb(144, 164, 174)" }}
                            >
                              Other
                            </span>
                          </li>
                        </ul>
                      }
                    >
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Donut Chart - Left Side */}
                        <div className="lg:w-2/3 relative p-4">
                          <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                              <Pie
                                data={costDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={95}
                                outerRadius={135}
                                paddingAngle={5}
                                dataKey="value"
                                cornerRadius={4}
                                startAngle={90}
                                endAngle={-270}
                                animationBegin={200}
                                animationDuration={1800}
                              >
                                {costDistributionData.map(
                                  (entry: any, index: number) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={entry.color}
                                      stroke="rgba(255,255,255,0.8)"
                                      strokeWidth={2}
                                    />
                                  ),
                                )}
                              </Pie>

                              <Tooltip
                                content={<ExpenseTooltip />}
                                offset={20}
                                wrapperStyle={{
                                  zIndex: 1000,
                                  fontFamily: "inherit",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>

                          {/* Center Text for Donut */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] text-center pointer-events-none">
                            <span className="block text-sm font-medium text-gray-600 mb-0.5">
                              Total Amount
                            </span>
                            <span className="block text-2xl font-bold text-gray-900 tracking-tight leading-none">
                              {formattedTotalCostDistribution}
                            </span>
                            <span className="block text-xs font-medium text-gray-500 mt-1">
                              THB
                            </span>
                            <p className="text-xs text-gray-400 mt-2">
                              Excl. VAT
                            </p>
                          </div>
                        </div>

                        {/* Cost Insights - Right Side */}
                        <div className="lg:w-1/3 flex flex-col justify-center">
                          <div className="p-8 bg-gray-50/50 rounded-lg border border-gray-100 h-fit space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-gray-900 text-lg">
                                Cost Breakdown
                              </h4>
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                Category View
                              </span>
                            </div>

                            <div className="space-y-5">
                              {costBreakdownItems.map(
                                (item: any, index: number) => (
                                  <div
                                    key={index}
                                    className="group flex items-center justify-between p-3 rounded-md transition-all duration-300 hover:bg-white hover:shadow-lg hover:scale-105 border border-transparent hover:border-gray-200 cursor-pointer"
                                    onClick={() =>
                                      handleCategoryClick(item.name)
                                    }
                                  >
                                    <div className="flex items-center gap-4">
                                      <div
                                        className="w-1.5 h-10 rounded-full transition-all duration-300"
                                        style={{
                                          backgroundColor: item.color,
                                        }}
                                      ></div>
                                      <div>
                                        <span className="block font-semibold text-gray-900 text-base leading-tight">
                                          {item.name}
                                        </span>
                                        <span className="text-sm font-medium text-gray-500">
                                          {item.percentage}% of Total
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="flex items-end justify-between w-full gap-1">
                                        <span className="text-lg font-medium text-gray-900 tracking-tight">
                                          {item.formattedValue}
                                        </span>
                                        <span className="text-[10px] font-medium text-gray-400 mb-1">
                                          THB
                                        </span>
                                      </div>
                                      <div className="w-32">
                                        <div className="h-1.5 w-full bg-gray-100 rounded-full mt-1 overflow-hidden">
                                          <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                              width: item.percentage + "%",
                                            }}
                                            transition={{
                                              duration: 1,
                                              delay: 0.5 + index * 0.1,
                                            }}
                                            className="h-full rounded-full"
                                            style={{
                                              backgroundColor: item.color,
                                            }}
                                          ></motion.div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ChartContainer>
                  </div>
                </div>

                {/* Monthly Spending Trend - Bottom */}

                <ChartContainer
                  title="Monthly Spending Trend"
                  subtitle="Monthly spending by category"
                  delay={0.2}
                  className="px-8 pt-6 pb-6"
                  headerAction={
                    <ul
                      className="recharts-default-legend"
                      style={{
                        padding: "0px",
                        margin: "0px",
                        textAlign: "center",
                        fontSize: "16px",
                        fontWeight: 400,
                        color: "#475569",
                      }}
                    >
                      <li
                        className="recharts-legend-item legend-item-0"
                        style={{
                          display: "inline-block",
                          marginRight: "10px",
                        }}
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
                            fill="#72d572"
                            cx="16"
                            cy="16"
                            className="recharts-symbols"
                            transform="translate(16, 16)"
                            d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                          ></path>
                        </svg>
                        <span
                          className="recharts-legend-item-text"
                          style={{ color: "rgb(114, 213, 115)" }}
                        >
                          Service
                        </span>
                      </li>
                      <li
                        className="recharts-legend-item legend-item-1"
                        style={{
                          display: "inline-block",
                          marginRight: "10px",
                        }}
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
                            fill="#29b6f6"
                            cx="16"
                            cy="16"
                            className="recharts-symbols"
                            transform="translate(16, 16)"
                            d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                          ></path>
                        </svg>
                        <span
                          className="recharts-legend-item-text"
                          style={{ color: "rgb(41, 182, 246)" }}
                        >
                          Material
                        </span>
                      </li>
                      <li
                        className="recharts-legend-item legend-item-2"
                        style={{
                          display: "inline-block",
                          marginRight: "10px",
                        }}
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
                            fill="#90a4ae"
                            cx="16"
                            cy="16"
                            className="recharts-symbols"
                            transform="translate(16, 16)"
                            d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                          ></path>
                        </svg>
                        <span
                          className="recharts-legend-item-text"
                          style={{ color: "rgb(144, 164, 174)" }}
                        >
                          Other
                        </span>
                      </li>
                    </ul>
                  }
                >
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={spendingTrendChartData}
                        margin={{ top: 20, right: 40, left: 30, bottom: 20 }}
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
                          stroke="#6b7280"
                          fontSize={12}
                          xAxisId="primary"
                          padding={{ left: 20, right: 20 }}
                          tickMargin={5} // add margin to position months below chart content
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
                          height={10} // smaller height to tighten gap
                          tick={{ dy: -2 }} // lift years closer to months
                          interval={0}
                          tickFormatter={(value, index) => {
                            // Only show year label for the middle month of each year
                            const data = spendingTrendChartData;
                            if (!data || data.length === 0) return "";

                            // Group months by year
                            const yearGroups: { [key: string]: number[] } = {};
                            data.forEach((item, idx) => {
                              const year = item.yearBE;
                              if (!yearGroups[year]) {
                                yearGroups[year] = [];
                              }
                              yearGroups[year].push(idx);
                            });

                            // Check if this index should show year label (for each year group pick center)
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
                            `${value.toLocaleString(undefined, {
                              minimumFractionDigits: value % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })}`,
                            name,
                          ]}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                              const data = payload[0].payload;
                              return `${data.month} ${data.yearBE}`;
                            }
                            return label;
                          }}
                        />

                        {/* Dynamic Line components for each category */}
                        {(() => {
                          const colors = [
                            "#72d572",
                            "#29b6f6",
                            "#90a4ae",
                            "#f59e0b",
                            "#ef4444",
                            "#8b5cf6",
                            "#06b6d4",
                            "#84cc16",
                            "#f97316",
                            "#a855f7",
                            "#14b8a6",
                            "#eab308",
                          ];

                          return allCategories.map(
                            (category: string, index: number) => (
                              <Line
                                key={category}
                                type="monotone"
                                dataKey={category}
                                stroke={colors[index % colors.length]}
                                strokeWidth={2}
                                dot={{
                                  fill: colors[index % colors.length],
                                  r: 2,
                                }}
                                activeDot={{
                                  r: 4,
                                  fill: colors[index % colors.length],
                                  stroke: "#fff",
                                  strokeWidth: 2,
                                }}
                                name={category}
                                animationDuration={1500}
                                xAxisId="primary"
                              />
                            ),
                          );
                        })()}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartContainer>
              </div>
            )}

            {activeTab === "supplier" && (
              <div className="space-y-6">
                <ChartContainer
                  title="Top Suppliers by Spending"
                  subtitle="Supplier spending with cost category breakdown"
                  delay={0.1}
                  className="px-8 pt-6 pb-6"
                  headerAction={
                    <div className="flex items-center gap-4">
                      <ul
                        className="recharts-default-legend"
                        style={{
                          padding: "0px",
                          margin: "0px",
                          textAlign: "center",
                          fontSize: "16px",
                          fontWeight: 400,
                          color: "#475569",
                        }}
                      >
                        <li
                          className="recharts-legend-item legend-item-0"
                          style={{
                            display: "inline-block",
                            marginRight: "10px",
                          }}
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
                              fill="#72d573"
                              cx="16"
                              cy="16"
                              className="recharts-symbols"
                              transform="translate(16, 16)"
                              d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                            ></path>
                          </svg>
                          <span
                            className="recharts-legend-item-text"
                            style={{ color: "rgb(114, 213, 115)" }}
                          >
                            Service
                          </span>
                        </li>
                        <li
                          className="recharts-legend-item legend-item-1"
                          style={{
                            display: "inline-block",
                            marginRight: "10px",
                          }}
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
                              fill="#29b6f6"
                              cx="16"
                              cy="16"
                              className="recharts-symbols"
                              transform="translate(16, 16)"
                              d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                            ></path>
                          </svg>
                          <span
                            className="recharts-legend-item-text"
                            style={{ color: "rgb(41, 182, 246)" }}
                          >
                            Material
                          </span>
                        </li>
                        <li
                          className="recharts-legend-item legend-item-2"
                          style={{
                            display: "inline-block",
                            marginRight: "10px",
                          }}
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
                              fill="#90a4ae"
                              cx="16"
                              cy="16"
                              className="recharts-symbols"
                              transform="translate(16, 16)"
                              d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                            ></path>
                          </svg>
                          <span
                            className="recharts-legend-item-text"
                            style={{ color: "rgb(144, 164, 174)" }}
                          >
                            Other
                          </span>
                        </li>
                      </ul>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    {(() => {
                      // Add loading check
                      if (!lineData || !lineData.rows || loading) {
                        return (
                          <div className="flex items-center justify-center h-32">
                            <div className="text-sm text-gray-500">
                              Loading supplier data...
                            </div>
                          </div>
                        );
                      }

                      return supplierChartData.map((supplier, index) => (
                        <div
                          key={supplier.name}
                          className="space-y-2 cursor-pointer rounded-lg transition-colors p-4 -m-4 group"
                          onClick={() => handleCategoryClick(supplier.name)}
                          onMouseEnter={(e) => {
                            setHoveredSupplier(supplier);
                            setTooltipPosition({
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }}
                          onMouseMove={(e) => {
                            setTooltipPosition({
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }}
                          onMouseLeave={() => {
                            setHoveredSupplier(null);
                          }}
                        >
                          <div className="flex justify-between items-end">
                            <label className="text-sm font-normal text-slate-700 dark:text-slate-300 group-hover:font-bold transition-all duration-200">
                              {supplier.name}
                            </label>
                            <span className="text-sm text-slate-900 dark:text-slate-100 group-hover:font-bold transition-all duration-200">
                              {supplier.formattedTotal}{" "}
                              <span className="!font-normal">
                                ({supplier.percentage.toFixed(1)}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                            {/* Service segment */}
                            {supplier.service > 0 && (
                              <div
                                className="h-full rounded-l-full transition-all duration-500"
                                style={{
                                  backgroundColor: "#72d572",
                                  width: `${(supplier.service / supplierBreakdownData.maxTotal) * 100}%`,
                                }}
                                title={`Service: ${((supplier.service / supplier.total) * 100).toFixed(1)}% - ${formatCurrency(supplier.service)}`}
                              />
                            )}
                            {/* Material segment */}
                            {supplier.material > 0 && (
                              <div
                                className="h-full transition-all duration-500"
                                style={{
                                  backgroundColor: "#29b6f6",
                                  width: `${(supplier.material / supplierBreakdownData.maxTotal) * 100}%`,
                                }}
                                title={`Material: ${((supplier.material / supplier.total) * 100).toFixed(1)}% - ${formatCurrency(supplier.material)}`}
                              />
                            )}
                            {/* Other segment */}
                            {supplier.other > 0 && (
                              <div
                                className="h-full rounded-r-full transition-all duration-500"
                                style={{
                                  backgroundColor: "#90a4ae",
                                  width: `${(supplier.other / supplierBreakdownData.maxTotal) * 100}%`,
                                }}
                                title={`Other: ${((supplier.other / supplier.total) * 100).toFixed(1)}% - ${formatCurrency(supplier.other)}`}
                              />
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    *All amounts are exclusive of VAT.
                  </p>
                </ChartContainer>

                <ChartContainer
                  title="Supplier Spending Trend"
                  subtitle="Monthly spending trend for the selected supplier"
                  delay={0.3}
                  className="px-8 pt-6 pb-6"
                  headerAction={
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="all">All Suppliers</option>
                        {supplierTrendData
                          .filter(
                            (supplier) => supplier.supplier !== "All Suppliers",
                          )
                          .map((supplier) => (
                            <option
                              key={supplier.supplier}
                              value={supplier.supplier}
                            >
                              {supplier.supplier.length > 30
                                ? supplier.supplier.substring(0, 30) + "..."
                                : supplier.supplier}
                            </option>
                          ))}
                      </select>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    {supplierTrendChartData.length === 0 ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                          <div className="text-gray-400 mb-2">📊</div>
                          <div className="text-sm text-gray-500">
                            No trend data available for selected supplier
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={450}>
                        <LineChart
                          data={supplierTrendChartData}
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
                              if (
                                !supplierTrendChartData ||
                                supplierTrendChartData.length === 0
                              )
                                return "";

                              // Group months by year
                              const yearGroups: { [key: string]: number[] } =
                                {};
                              supplierTrendChartData.forEach(
                                (item: any, idx: number) => {
                                  const year = item.yearLabel;
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
                            tickFormatter={(value) =>
                              value === 0
                                ? "0k"
                                : `${(value / 1000).toLocaleString("en-US", {
                                    minimumFractionDigits:
                                      (value / 1000) % 1 === 0 ? 0 : 2,
                                    maximumFractionDigits: 2,
                                  })}k`
                            }
                          />
                          <Tooltip
                            wrapperStyle={{ zIndex: 1000 }}
                            contentStyle={TOOLTIP_STYLE}
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
                            formatter={(value: number) => [
                              `${value.toLocaleString("en-US", {
                                minimumFractionDigits: value % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}`,
                              "Total Amount",
                            ]}
                            labelFormatter={(label, payload) => {
                              // Convert abbreviated month to full month name
                              const monthMap: { [key: string]: string } = {
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
                              const fullMonth = monthMap[label] || label;
                              const year = payload[0]?.payload?.yearLabel || "";
                              return `${fullMonth} ${year}`;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="amount"
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
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartContainer>
              </div>
            )}

            {activeTab === "performance" && (
              <div className="space-y-6">
                <ChartContainer
                  title="Project Spending"
                  subtitle="Total spending by project"
                  delay={0.1}
                  className="px-8 pt-6 pb-8"
                  headerAction={
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-600">
                        Total Amount
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formattedProjectTotalSpend}
                      </div>
                    </div>
                  }
                >
                  <div className="w-full">
                    {projectSpendData.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No project data available
                      </p>
                    ) : (
                      <>
                        {/* Horizontal Bar Chart */}
                        <div className="space-y-4">
                          {projectChartData.map((project, index) => (
                            <div
                              key={project.projectCode}
                              className="space-y-2 hover:font-bold cursor-pointer rounded-lg transition-colors p-4 -m-4 group"
                              onClick={() =>
                                handleProjectClick(project.projectCode)
                              }
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-normal text-gray-900 min-w-[80px] group-hover:font-bold transition-all duration-200">
                                  {project.projectCode}
                                </span>
                                <span className="text-sm font-normal text-gray-900 group-hover:font-bold transition-all duration-200">
                                  {project.formattedTotal}
                                </span>
                              </div>
                              <div className="relative">
                                <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: project.barWidth + "%" }}
                                    transition={{
                                      duration: 0.8,
                                      delay: index * 0.1,
                                    }}
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end pr-2"
                                  >
                                    {project.barWidth > 10 && (
                                      <span className="text-xs text-white font-medium">
                                        {project.percentage}%
                                      </span>
                                    )}
                                  </motion.div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </ChartContainer>

                <ChartContainer
                  title="Project Cost Breakdown"
                  subtitle="Cost breakdown by category for each project"
                  delay={0.3}
                  className="px-8 pt-6 pb-3"
                  headerAction={
                    <ul
                      className="recharts-default-legend"
                      style={{
                        padding: "0px",
                        margin: "0px",
                        textAlign: "center",
                        fontSize: "16px",
                        fontWeight: 400,
                        color: "#475569",
                      }}
                    >
                      <li
                        className="recharts-legend-item legend-item-0"
                        style={{
                          display: "inline-block",
                          marginRight: "10px",
                        }}
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
                            fill="#72d572"
                            cx="16"
                            cy="16"
                            className="recharts-symbols"
                            transform="translate(16, 16)"
                            d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                          ></path>
                        </svg>
                        <span
                          className="recharts-legend-item-text"
                          style={{ color: "rgb(114, 213, 115)" }}
                        >
                          Service
                        </span>
                      </li>
                      <li
                        className="recharts-legend-item legend-item-1"
                        style={{
                          display: "inline-block",
                          marginRight: "10px",
                        }}
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
                            fill="#29b6f6"
                            cx="16"
                            cy="16"
                            className="recharts-symbols"
                            transform="translate(16, 16)"
                            d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                          ></path>
                        </svg>
                        <span
                          className="recharts-legend-item-text"
                          style={{ color: "rgb(41, 182, 246)" }}
                        >
                          Material
                        </span>
                      </li>
                      <li
                        className="recharts-legend-item legend-item-2"
                        style={{
                          display: "inline-block",
                          marginRight: "10px",
                        }}
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
                            fill="#90a4ae"
                            cx="16"
                            cy="16"
                            className="recharts-symbols"
                            transform="translate(16, 16)"
                            d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"
                          ></path>
                        </svg>
                        <span
                          className="recharts-legend-item-text"
                          style={{ color: "rgb(144, 164, 174)" }}
                        >
                          Other
                        </span>
                      </li>
                    </ul>
                  }
                >
                  <div className="w-full">
                    {projectCategoryMixData.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No category mix data available
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={projectCategoryMixData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 20,
                          }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e5e7eb"
                          />
                          <XAxis
                            dataKey="project"
                            axisLine={false}
                            tickLine={false}
                            stroke="#6b7280"
                            fontSize={12}
                            height={20}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6b7280", fontSize: 12 }}
                            tickFormatter={(value) =>
                              value === 0
                                ? "0"
                                : `${(value / 1000000).toFixed(1)}M`
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
                              `${value.toLocaleString(undefined, {
                                minimumFractionDigits: value % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}`,
                              name,
                            ]}
                            labelFormatter={(label, payload) => {
                              // Sort payload to show Service, Material, Other order
                              if (payload && payload.length > 0) {
                                const categoryOrder = [
                                  "Service",
                                  "Material",
                                  "Other",
                                ];
                                const sortedPayload = [...payload].sort(
                                  (a: any, b: any) => {
                                    const aIndex = categoryOrder.indexOf(
                                      a.name,
                                    );
                                    const bIndex = categoryOrder.indexOf(
                                      b.name,
                                    );
                                    return aIndex - bIndex;
                                  },
                                );
                                // Replace the original payload with sorted one
                                payload.splice(
                                  0,
                                  payload.length,
                                  ...sortedPayload,
                                );
                              }
                              return label;
                            }}
                          />
                          {/* Get unique categories from data */}
                          {projectCategoryBars}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartContainer>

                <ChartContainer
                  title="PO Volume Trend"
                  subtitle="Monthly purchase order volume"
                  delay={0.4}
                  className="px-8 pt-6 pb-6"
                >
                  <div className="w-full">
                    {poVolumeData.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No PO volume data available
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={poVolumeData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 20,
                          }}
                          onClick={(e: any) => {
                            if (e && e.activePayload && e.activePayload[0]) {
                              const payload = e.activePayload[0].payload;
                              console.log("BarChart clicked:", payload);
                              handlePOVolumeClick(payload);
                            }
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
                            height={10}
                            tick={{ dy: -2 }}
                            interval={0}
                            tickFormatter={(value, index) => {
                              // Only show year label for the middle month of each year
                              if (!poVolumeData || poVolumeData.length === 0)
                                return "";

                              // Group months by year
                              const yearGroups: { [key: string]: number[] } =
                                {};
                              poVolumeData.forEach((item: any, idx: number) => {
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
                            tickFormatter={(value) => value.toString()}
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
                            formatter={(value: number) => [
                              `${value} PO${value !== 1 ? "s" : ""}`,
                              "Volume",
                            ]}
                            labelFormatter={(label, payload) => {
                              if (payload && payload[0]) {
                                const data = payload[0].payload;
                                return `${data.monthFull} ${data.yearBE}`;
                              }
                              return label;
                            }}
                          />
                          <Bar
                            dataKey="poCount"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            animationDuration={1000}
                            xAxisId="primary"
                            cursor="pointer"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category PO Details Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-visible">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {(() => {
                    const isSupplier =
                      selectedSupplierName.includes("จำกัด") ||
                      selectedSupplierName.includes("Company") ||
                      selectedSupplierName.includes("บริษัท") ||
                      selectedSupplierName.includes("Co.") ||
                      supplierSpendData.some(
                        (supplier) => supplier.name === selectedSupplierName,
                      );
                    return isSupplier
                      ? `PO Details by ${selectedSupplierName}`
                      : `PO Details by ${selectedSupplierName}`;
                  })()}
                </h3>
                <button
                  onClick={closeCategoryModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              {loadingCategoryPOs ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <div className="text-gray-500 font-medium">
                    Loading PO details...
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCategoryPOs.map((po, poIndex) => (
                    <div
                      key={poIndex}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {po.poNumber}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {po.date
                              ? new Date(po.date).toISOString().split("T")[0]
                              : "No date"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Items:
                        </h5>
                        <div className="overflow-x-auto">
                          <table
                            className="w-full text-sm"
                            style={{ tableLayout: "fixed", width: "100%" }}
                          >
                            <thead className="bg-gray-50">
                              <tr>
                                <th
                                  className="px-3 py-2 h-12 text-left text-xs font-medium text-gray-500 tracking-wider"
                                  style={{ width: "15%" }}
                                >
                                  Category
                                </th>
                                <th
                                  className="px-3 py-2 h-12 text-left text-xs font-medium text-gray-500 tracking-wider"
                                  style={{ width: "15%" }}
                                >
                                  Item Code
                                </th>
                                <th
                                  className="px-3 py-2 h-12 text-left text-xs font-medium text-gray-500 tracking-wider"
                                  style={{ width: "50%" }}
                                >
                                  Description
                                </th>
                                <th
                                  className="px-3 py-2 h-12 text-right text-xs font-medium text-gray-500 whitespace-nowrap"
                                  style={{ width: "20%" }}
                                >
                                  Total Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {po.lineItems.map(
                                (item: any, itemIndex: number) => (
                                  <tr key={itemIndex}>
                                    <td
                                      className="px-3 py-2 whitespace-nowrap"
                                      style={{ width: "15%" }}
                                    >
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${
                                          item.category === "Service"
                                            ? "bg-green-100 text-green-700"
                                            : item.category === "Material"
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {item.category}
                                      </span>
                                    </td>
                                    <td
                                      className="px-3 py-2 text-gray-900"
                                      style={{ width: "15%" }}
                                    >
                                      {item.itemCode || "-"}
                                    </td>
                                    <td
                                      className="px-3 py-2 text-gray-900"
                                      style={{ width: "50%" }}
                                    >
                                      {item.description || "-"}
                                    </td>
                                    <td
                                      className="px-3 py-2 text-right font-normal text-gray-900"
                                      style={{ width: "20%" }}
                                    >
                                      {item.amount.toLocaleString(undefined, {
                                        minimumFractionDigits:
                                          item.amount % 1 === 0 ? 0 : 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Tooltip for Supplier Cards */}
      {hoveredSupplier && (
        <SupplierTooltip
          supplier={hoveredSupplier}
          position={tooltipPosition}
        />
      )}

      {/* PO Details Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-visible">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  PO Details
                  {modalSource === "project" && selectedMonthPOs.length > 0
                    ? ` - ${selectedMonthPOs[0].projectCode}`
                    : ""}
                </h3>
                <button
                  onClick={closePOModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              {loadingPOs ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <div className="text-gray-500 font-medium">
                    Loading PO details...
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedMonthPOs.map((po, poIndex) => (
                    <div
                      key={poIndex}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {po.poNumber}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {po.date
                              ? new Date(po.date).toISOString().split("T")[0]
                              : "No date"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">
                            Total Amount (Incl. VAT)
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(po.totalAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Items:
                        </h5>
                        <div className="overflow-x-auto">
                          <table
                            className="w-full text-sm"
                            style={{ tableLayout: "fixed", width: "100%" }}
                          >
                            <thead className="bg-gray-50">
                              <tr>
                                <th
                                  className="px-3 py-2 h-12 text-left text-xs font-medium text-gray-500 tracking-wider"
                                  style={{ width: "15%" }}
                                >
                                  Category
                                </th>
                                <th
                                  className="px-3 py-2 h-12 text-left text-xs font-medium text-gray-500 tracking-wider"
                                  style={{ width: "15%" }}
                                >
                                  Item Code
                                </th>
                                <th
                                  className="px-3 py-2 h-12 text-left text-xs font-medium text-gray-500 tracking-wider"
                                  style={{ width: "50%" }}
                                >
                                  Description
                                </th>
                                <th
                                  className="px-3 py-2 h-12 text-right text-xs font-medium text-gray-500 whitespace-nowrap"
                                  style={{ width: "20%" }}
                                >
                                  Total Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {po.lineItems && po.lineItems.length > 0 ? (
                                po.lineItems.map(
                                  (item: any, itemIndex: number) => (
                                    <tr key={itemIndex}>
                                      <td
                                        className="px-3 py-2 whitespace-nowrap"
                                        style={{ width: "15%" }}
                                      >
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${
                                            item.category === "Service"
                                              ? "bg-green-100 text-green-700"
                                              : item.category === "Material"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-gray-100 text-gray-700"
                                          }`}
                                        >
                                          {item.category}
                                        </span>
                                      </td>
                                      <td
                                        className="px-3 py-2 text-gray-900"
                                        style={{ width: "15%" }}
                                      >
                                        {item.itemCode || "-"}
                                      </td>
                                      <td
                                        className="px-3 py-2 text-gray-900"
                                        style={{ width: "50%" }}
                                      >
                                        {item.description || "-"}
                                      </td>
                                      <td
                                        className="px-3 py-2 text-right font-normal text-gray-900"
                                        style={{ width: "20%" }}
                                      >
                                        {formatCurrency(item.amount)}
                                      </td>
                                    </tr>
                                  ),
                                )
                              ) : (
                                <tr>
                                  <td
                                    className="px-3 py-2 whitespace-nowrap"
                                    style={{ width: "15%" }}
                                  >
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${
                                        po.category === "Service"
                                          ? "bg-green-100 text-green-700"
                                          : po.category === "Material"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {po.category}
                                    </span>
                                  </td>
                                  <td
                                    className="px-3 py-2 text-gray-900"
                                    style={{ width: "15%" }}
                                  >
                                    -
                                  </td>
                                  <td
                                    className="px-3 py-2 text-gray-900"
                                    style={{ width: "50%" }}
                                  >
                                    {po.description}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-right font-normal text-gray-900"
                                    style={{ width: "20%" }}
                                  >
                                    {formatCurrency(po.totalAmount)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
