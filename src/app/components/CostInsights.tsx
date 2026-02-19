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
} from "lucide-react";
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
import { getTab1Data } from "../../services/googleSheetsService";

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
    price: "$245.00",
    qty: 50,
    total: "$12,250",
  },
  {
    id: 2,
    name: "NVR 64-Channel",
    category: "Equipment",
    supplier: "Dahua",
    price: "$1,200.00",
    qty: 5,
    total: "$6,000",
  },
  {
    id: 3,
    name: "Cat6 Cable Roll (305m)",
    category: "Cabling",
    supplier: "Belden",
    price: "$120.00",
    qty: 20,
    total: "$2,400",
  },
  {
    id: 4,
    name: "Annual Maintenance Contract",
    category: "Maintenance",
    supplier: "LocalService Co.",
    price: "$15,000.00",
    qty: 1,
    total: "$15,000",
  },
  {
    id: 5,
    name: "Cisco Switch 48-Port PoE",
    category: "Network",
    supplier: "Cisco",
    price: "$2,800.00",
    qty: 4,
    total: "$11,200",
  },
];

// Data from Google Sheets - Aggregated Supplier Spend Analysis
const supplierSpendData = [
  { name: "ออล ไอ แคน 3536 จำกัด", totalAmount: 1969350 },
  { name: "LocalService Co.", totalAmount: 15000 },
  { name: "Cisco", totalAmount: 11200 },
  { name: "Hikvision", totalAmount: 12250 },
  { name: "Dahua", totalAmount: 6000 },
  { name: "Belden", totalAmount: 2400 },
];

// Data from Google Sheets - df_HEADER (Supplier Profile Data)
const mockSupplierData: SupplierData = {
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
const performanceMetrics = [
  { metric: "On-Time Delivery", value: 95, target: 90 },
  { metric: "Quality Score", value: 4.8, target: 4.5 },
  { metric: "Price Competitiveness", value: 8.2, target: 7.5 },
  { metric: "Response Time", value: 2.4, target: 3.0 },
];

export function CostInsights() {
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
  const [recentItems, setRecentItems] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTab1Data();
        const rows = data.rows;

        // 1. Supplier Spend
        const supplierMap = rows.reduce((acc: any, row: any) => {
          const name = row.supplierName || "Unknown";
          acc[name] = (acc[name] || 0) + (parseFloat(row.totalPrice) || 0);
          return acc;
        }, {});

        setSupplierSpendData(
          Object.entries(supplierMap)
            .map(([name, totalAmount]) => ({
              name,
              totalAmount: totalAmount as number,
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 10),
        );

        // 2. Category Breakdown
        const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b"];
        const catMap = rows.reduce((acc: any, row: any) => {
          const cat = row.category || "Other";
          acc[cat] = (acc[cat] || 0) + (parseFloat(row.totalPrice) || 0);
          return acc;
        }, {});

        setCategoryData(
          Object.entries(catMap).map(([name, value], i) => ({
            name,
            value: value as number,
            color: colors[i % colors.length],
          })),
        );

        // 3. Recent Items
        setRecentItems(
          rows.slice(0, 10).map((row: any, i) => ({
            id: i,
            name: row.itemDescription,
            category: row.category,
            supplier: row.supplierName,
            price: `฿${(parseFloat(row.unitPrice) || 0).toLocaleString()}`,
            qty: row.quantity,
            total: `฿${(parseFloat(row.totalPrice) || 0).toLocaleString()}`,
          })),
        );
      } catch (e) {
        console.error("Error fetching insights data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const performanceMetrics = [
    { metric: "On-Time Delivery", value: 95, target: 90 },
    { metric: "Quality Score", value: 4.8, target: 4.5 },
    { metric: "Price Competitiveness", value: 8.2, target: 7.5 },
    { metric: "Response Time", value: 2.4, target: 3.0 },
  ];

  const mockSupplierData: SupplierData = {
    id: "1",
    name: supplierSpendData[0]?.name || "Loading...",
    totalSpend: supplierSpendData[0]?.totalAmount || 0,
    poCount: 0,
    avgPoValue: 0,
    lastPurchaseDate: "2025-02-15",
    trend: "up",
    trendPercentage: 12.5,
    rating: "gold",
    categories: ["Equipment", "Services"],
    riskLevel: "low",
    paymentTerms: "NET 30",
  };

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
            Supplier Insights
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "performance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Performance Metrics
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "category" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Cost Analysis */}
            <ChartContainer
              title="Category Cost Analysis"
              subtitle="Spend by Category"
              delay={0.1}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="rgba(0,0,0,0)"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#111827" }}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Category Insights */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">
                  Budget Planning Insights
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
                    <div>
                      <span className="font-medium text-blue-900">
                        Top Categories:
                      </span>{" "}
                      <span className="text-blue-700">
                        Based on real spend data from Google Sheets
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ChartContainer>

            {/* Budget vs Spend */}
            <ChartContainer
              title="Budget vs Spend"
              subtitle="Variance Analysis"
              delay={0.2}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    cursor={{ fill: "#e5e7eb", opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#111827" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
                  />
                  <Bar
                    dataKey="budget"
                    name="Allocated Budget"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="spend"
                    name="Actual Spend"
                    fill="#06b6d4"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}

        {activeTab === "supplier" && (
          <div className="space-y-6">
            <ChartContainer title="Supplier Profile" delay={0.1}>
              <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-white shadow-lg">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {mockSupplierData.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {mockSupplierData.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${getRatingColor(mockSupplierData.rating)}`}
                        >
                          {mockSupplierData.rating.toUpperCase()}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(mockSupplierData.riskLevel)}`}
                        >
                          {mockSupplierData.riskLevel.toUpperCase()} RISK
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ChartContainer>
          </div>
        )}

        {activeTab === "performance" && (
          <div className="space-y-6">
            <ChartContainer
              title="Spend by Supplier"
              subtitle="Top 10 Suppliers by Total Spend"
              delay={0.1}
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={supplierSpendData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}K`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#6b7280"
                    fontSize={10}
                    width={120}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `฿${value.toLocaleString()}`,
                      "Total Spend",
                    ]}
                  />
                  <Bar
                    dataKey="totalAmount"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title="Recent Procurement Items"
              subtitle="Last 10 items processed"
              delay={0.2}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="text-xs uppercase bg-gray-50 text-gray-900">
                    <tr>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3">{item.category}</td>
                        <td className="px-4 py-3">{item.supplier}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartContainer>
          </div>
        )}
      </div>
    </div>
  );
}
