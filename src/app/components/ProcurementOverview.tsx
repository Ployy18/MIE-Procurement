import React, { useState, useEffect } from "react";
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
  Cell,
} from "recharts";

// Lucide Icons
import {
  FileText,
  Activity,
  CreditCard,
  DollarSign,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// React Icons
import { MdMiscellaneousServices } from "react-icons/md";
import { FaMoneyBill, FaWallet } from "react-icons/fa";

// Box Icons
import { BiSolidCctv } from "react-icons/bi";

// Ion Icons
import { IoMdDocument } from "react-icons/io";

// Components
import { KPICard } from "./KPICard";
import { ChartContainer } from "./ChartContainer";
import { LoadingState } from "./ui/LoadingState";

// Services
import {
  getTab1Data,
  getTab2Data,
  getSheetDataByName,
} from "../../services/googleSheetsService";

export function ProcurementOverview({
  filters,
}: {
  filters: { year: string; project: string };
}) {
  const [uniquePOCount, setUniquePOCount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalServiceCosts, setTotalServiceCosts] = useState<number>(0);
  const [totalMaterialCosts, setTotalMaterialCosts] = useState<number>(0);
  const [totalOtherCosts, setTotalOtherCosts] = useState<number>(0);
  const [monthlyExpenseData, setMonthlyExpenseData] = useState<any[]>([]);
  const [supplierData, setSupplierData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedSupplierPOs, setSelectedSupplierPOs] = useState<any[]>([]);
  const [showPOModal, setShowPOModal] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [previousYearData, setPreviousYearData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [chartView, setChartView] = useState<"month" | "year">("month");
  const [yearlyExpenseData, setYearlyExpenseData] = useState<any[]>([]);

  // No longer using local filter state, using props directly

  useEffect(() => {
    const fetchPOData = async () => {
      try {
        setLoading(true);
        // Fetch data from specific sheets
        const [headDataResponse, lineDataResponse] = await Promise.all([
          getSheetDataByName("procurement_head"),
          getSheetDataByName("procurement_line"),
        ]);

        const headRows = headDataResponse.rows || [];
        const lineRows = lineDataResponse.rows || [];

        // 1. Project Filter (for Yearly Overview)
        let projectFilteredHead = headRows;
        if (filters.project !== "all") {
          projectFilteredHead = projectFilteredHead.filter(
            (row: any) => row.Project === filters.project,
          );
        }

        // 2. Further filter by Year (for everything else)
        let filteredHead = projectFilteredHead;
        if (filters.year !== "all") {
          filteredHead = filteredHead.filter((row: any) => {
            const dateStr = row.Date;
            if (dateStr) {
              let year;
              if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                year = parseInt(parts[2]);
              } else if (dateStr.includes("-")) {
                const parts = dateStr.split("-");
                year = parseInt(parts[0]);
              } else {
                return false;
              }
              return year.toString() === filters.year;
            }
            return false;
          });
        }

        // Apply filters to lineRows (for Category Costs and Charts)
        let filteredLine = lineRows;
        if (filters.year !== "all") {
          filteredLine = filteredLine.filter((row: any) => {
            const dateStr = row.Date;
            if (dateStr) {
              let year;
              if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                year = parseInt(parts[2]);
              } else if (dateStr.includes("-")) {
                const parts = dateStr.split("-");
                year = parseInt(parts[0]);
              } else {
                return false;
              }
              return year.toString() === filters.year;
            }
            return false;
          });
        }
        if (filters.project !== "all") {
          filteredLine = filteredLine.filter(
            (row: any) => row.Project === filters.project,
          );
        }

        // 1. KPI Calculations (as requested by user)
        // Purchase Order Count from procurement_head
        const uniquePOs = new Set(
          filteredHead.map((row: any) => row["PO Number"]).filter(Boolean),
        );
        setUniquePOCount(uniquePOs.size);

        // Total Amount from procurement_head
        const total = filteredHead.reduce(
          (sum: number, row: any) =>
            sum + (parseFloat(row["Total Amount"]) || 0),
          0,
        );
        setTotalAmount(total);

        // Total Service Cost from procurement_line (Category = Service)
        const serviceTotal = filteredLine.reduce((sum: number, row: any) => {
          if (row.Category === "Service") {
            return sum + (parseFloat(row["Total Amount"]) || 0);
          }
          return sum;
        }, 0);
        setTotalServiceCosts(serviceTotal);

        // Total Material Cost from procurement_line (Category = Material)
        const materialTotal = filteredLine.reduce((sum: number, row: any) => {
          if (row.Category === "Material") {
            return sum + (parseFloat(row["Total Amount"]) || 0);
          }
          return sum;
        }, 0);
        setTotalMaterialCosts(materialTotal);

        // Total Other Cost from procurement_line (Category = Other)
        const otherTotal = filteredLine.reduce((sum: number, row: any) => {
          if (row.Category === "Other") {
            return sum + (parseFloat(row["Total Amount"]) || 0);
          }
          return sum;
        }, 0);

        setTotalOtherCosts(otherTotal);

        // Use filteredHead for monthly expense data and supplier statistics
        const dashboardData = filteredHead;

        // 2. Process monthly expense data from procurement_head
        const monthlyExpenseMap = dashboardData.reduce(
          (acc: Record<string, number>, row: any) => {
            const dateStr = row.Date;
            if (dateStr) {
              // Extract year and month directly from string to avoid Date() conversion
              let year, month;

              // Handle different date formats: DD/MM/YYYY, YYYY-MM-DD, etc.
              if (dateStr.includes("/")) {
                // Format: DD/MM/YYYY or DD/MM/YY
                const parts = dateStr.split("/");
                year = parseInt(parts[2]);
                month = parseInt(parts[1]);
              } else if (dateStr.includes("-")) {
                // Format: YYYY-MM-DD
                const parts = dateStr.split("-");
                year = parseInt(parts[0]);
                month = parseInt(parts[1]);
              } else {
                // Skip invalid format
                return acc;
              }

              // Year is already in BE format, use as-is
              const monthYear = `${year}-${month < 10 ? "0" : ""}${month}`;
              const amount = parseFloat(row["Total Amount"]) || 0;

              acc[monthYear] = (acc[monthYear] || 0) + amount;
            }
            return acc;
          },
          {},
        );

        const sortedMonthlyData = Object.keys(monthlyExpenseMap)
          .sort()
          .map((monthYear) => {
            const [year, month] = monthYear.split("-");
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
            const fullMonths = [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ];

            const mIdx = parseInt(month) - 1;
            return {
              name: months[mIdx],
              monthLabel: months[mIdx].slice(0, 3),
              fullName: fullMonths[mIdx],
              year: year,
              value: monthlyExpenseMap[monthYear],
              showYear: false,
              yearLabel: "", // New field for centered labels
            };
          });

        // Mark year labels (Centered under year's months)
        const yearGroups: Record<string, number[]> = {};
        sortedMonthlyData.forEach((item, index) => {
          if (!yearGroups[item.year]) yearGroups[item.year] = [];
          yearGroups[item.year].push(index);
        });

        // Set yearLabel for the middle index of each year group
        Object.entries(yearGroups).forEach(([year, indices]) => {
          const midIdx = indices[Math.floor(indices.length / 2)];
          sortedMonthlyData[midIdx].yearLabel = year;
        });

        setMonthlyExpenseData(sortedMonthlyData);

        // 3. Process yearly expense data from projectFilteredHead (Ignores Year filter)
        const yearlyExpenseMap = projectFilteredHead.reduce(
          (acc: Record<string, number>, row: any) => {
            const dateStr = row.Date;
            if (dateStr) {
              let year;
              if (dateStr.includes("/")) {
                const parts = dateStr.split("/");
                year = parts[2];
              } else if (dateStr.includes("-")) {
                const parts = dateStr.split("-");
                year = parts[0];
              } else {
                return acc;
              }
              const amount = parseFloat(row["Total Amount"]) || 0;
              acc[year] = (acc[year] || 0) + amount;
            }
            return acc;
          },
          {},
        );

        const sortedYearlyData = Object.keys(yearlyExpenseMap)
          .sort()
          .map((year) => ({
            name: year,
            value: yearlyExpenseMap[year],
          }));

        setYearlyExpenseData(sortedYearlyData);

        // 4. Supplier Statistics
        const supplierStats = dashboardData.reduce(
          (acc: Record<string, any>, row: any) => {
            const name = row.Supplier || "Unknown";
            const amount = parseFloat(row["Total Amount"]) || 0;

            if (!acc[name]) {
              acc[name] = {
                name,
                totalAmount: 0,
                poCount: 0,
                poNumbers: new Set(),
              };
            }
            acc[name].totalAmount += amount;
            acc[name].poNumbers.add(row["PO Number"]);
            acc[name].poCount = acc[name].poNumbers.size;
            return acc;
          },
          {},
        );

        const suppliersWithStats = Object.values(supplierStats)
          .map((s: any) => {
            const grandTotal = dashboardData.reduce(
              (sum: number, row: any) =>
                sum + (parseFloat(row["Total Amount"]) || 0),
              0,
            );
            return {
              name: s.name,
              totalAmount: s.totalAmount,
              poCount: s.poCount,
              spendShare: parseFloat(
                ((s.totalAmount / (grandTotal || 1)) * 100).toFixed(1),
              ),
              growthRate: 0,
            };
          })
          .sort((a, b) => b.totalAmount - a.totalAmount);

        setSupplierData(suppliersWithStats);

        const categorySpend = filteredLine.reduce(
          (acc: Record<string, number>, row: any) => {
            const cat = row.Category || "Other";
            const amount = parseFloat(row["Total Amount"]) || 0;
            acc[cat] = (acc[cat] || 0) + amount;
            return acc;
          },
          {},
        );

        // Sort categories in specific order: Service, Material, Other
        const categoryOrder = ["Service", "Material", "Other"];
        const sortedCategories = Object.entries(categorySpend)
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => {
            const aIndex = categoryOrder.indexOf(a.category);
            const bIndex = categoryOrder.indexOf(b.category);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.category.localeCompare(b.category);
          });

        setCategoryData(sortedCategories);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error processing procurement data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPOData();
  }, [filters]);

  // Function to fetch PO details for a specific supplier
  const fetchSupplierPOs = async (supplierName: string) => {
    setLoadingPOs(true);
    try {
      const [headDataResponse, lineDataResponse] = await Promise.all([
        getSheetDataByName("procurement_head"),
        getSheetDataByName("procurement_line"),
      ]);
      const headRows = headDataResponse.rows || [];
      const lineRows = lineDataResponse.rows || [];

      // Filter head data by supplier name and existing dashboard filters
      let supplierHeadRows = headRows.filter(
        (row: any) => row.Supplier === supplierName,
      );

      // Apply year/project filters if active for head data
      if (filters.year !== "all") {
        supplierHeadRows = supplierHeadRows.filter((row: any) => {
          const dateStr = row.Date;
          if (dateStr) {
            let year;
            if (dateStr.includes("/")) {
              const parts = dateStr.split("/");
              year = parseInt(parts[2]);
            } else if (dateStr.includes("-")) {
              const parts = dateStr.split("-");
              year = parseInt(parts[0]);
            } else {
              return false;
            }
            return year.toString() === filters.year;
          }
          return false;
        });
      }
      if (filters.project !== "all") {
        supplierHeadRows = supplierHeadRows.filter(
          (row: any) => row.Project === filters.project,
        );
      }

      // Filter line data similarly for line items
      let supplierLineRows = lineRows.filter(
        (row: any) => row.Supplier === supplierName,
      );

      // Apply year/project filters if active for line data
      if (filters.year !== "all") {
        supplierLineRows = supplierLineRows.filter((row: any) => {
          const dateStr = row.Date;
          if (dateStr) {
            let year;
            if (dateStr.includes("/")) {
              const parts = dateStr.split("/");
              year = parseInt(parts[2]);
            } else if (dateStr.includes("-")) {
              const parts = dateStr.split("-");
              year = parseInt(parts[0]);
            } else {
              return false;
            }
            return year.toString() === filters.year;
          }
          return false;
        });
      }
      if (filters.project !== "all") {
        supplierLineRows = supplierLineRows.filter(
          (row: any) => row.Project === filters.project,
        );
      }

      // Group line items by PO Number
      const lineItemGroups = supplierLineRows.reduce(
        (acc: Record<string, any>, row: any) => {
          const poNo = row["PO Number"];
          if (!acc[poNo]) {
            acc[poNo] = [];
          }
          acc[poNo].push({
            category: row.Category,
            unitPrice: parseFloat(row["Unit Price"]) || 0,
            amount: parseFloat(row["Total Amount"]) || 0,
            description: row.Description,
          });
          return acc;
        },
        {},
      );

      // Create PO groups using head data for total amount and line data for items
      const poGroups = supplierHeadRows.reduce(
        (acc: Record<string, any>, row: any) => {
          const poNo = row["PO Number"];
          acc[poNo] = {
            poNumber: poNo,
            date: row.Date,
            projectCode: row.Project,
            totalAmount: parseFloat(row["Total Amount"]) || 0, // Use Total Amount from procurement_head
            lineItems: lineItemGroups[poNo] || [], // Get line items from grouped line data
          };
          return acc;
        },
        {},
      );

      const sortedPOs = Object.values(poGroups).sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setSelectedSupplierPOs(sortedPOs);
      setShowPOModal(true);
    } catch (error) {
      console.error("Error fetching supplier POs:", error);
    } finally {
      setLoadingPOs(false);
    }
  };

  // Function to handle PO count click
  const handlePOCountClick = (supplierName: string) => {
    fetchSupplierPOs(supplierName);
  };

  // Function to close modal
  const closeModal = () => {
    setShowPOModal(false);
    setSelectedSupplierPOs([]);
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* KPI Section */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              title="Purchase Order Count"
              value={loading ? "Loading..." : uniquePOCount.toString()}
              trend=""
              trendUp={true}
              icon={IoMdDocument}
              iconSize={28}
              delay={0.1}
            />
            <KPICard
              title="Total Amount"
              value={
                loading
                  ? "Loading..."
                  : totalAmount.toLocaleString("en-US", {
                      minimumFractionDigits: totalAmount % 1 === 0 ? 0 : 2,
                      maximumFractionDigits: 2,
                    })
              }
              trend=""
              trendUp={false}
              icon={FaMoneyBill}
              iconSize={28}
              delay={0.2}
            />
            <KPICard
              title="Total Service Cost"
              value={
                loading
                  ? "Loading..."
                  : totalServiceCosts.toLocaleString("en-US", {
                      minimumFractionDigits:
                        totalServiceCosts % 1 === 0 ? 0 : 2,
                      maximumFractionDigits: 2,
                    })
              }
              trend=""
              trendUp={true}
              icon={MdMiscellaneousServices}
              iconSize={28}
              delay={0.3}
            />
            <KPICard
              title="Total Material Cost"
              value={
                loading
                  ? "Loading..."
                  : totalMaterialCosts.toLocaleString("en-US", {
                      minimumFractionDigits:
                        totalMaterialCosts % 1 === 0 ? 0 : 2,
                      maximumFractionDigits: 2,
                    })
              }
              trend=""
              trendUp={true}
              icon={BiSolidCctv}
              iconSize={28}
              delay={0.4}
            />
            <KPICard
              title="Total Other Cost"
              value={
                loading
                  ? "Loading..."
                  : totalOtherCosts.toLocaleString("en-US", {
                      minimumFractionDigits: totalOtherCosts % 1 === 0 ? 0 : 2,
                      maximumFractionDigits: 2,
                    })
              }
              trend=""
              trendUp={true}
              icon={FaWallet}
              iconSize={20}
              delay={0.5}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartContainer
              title={
                chartView === "month"
                  ? "Procurement Spending Trend"
                  : "Procurement Spending Trend"
              }
              subtitle={
                chartView === "month"
                  ? "Displays total expenses for each month"
                  : "Displays total expenses for each year"
              }
              className="lg:col-span-2 px-8 pt-6 pb-8"
              delay={0.5}
              headerAction={
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button
                    onClick={() => setChartView("month")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                      chartView === "month"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setChartView("year")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                      chartView === "year"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                    }`}
                  >
                    Year
                  </button>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={
                    chartView === "month"
                      ? monthlyExpenseData
                      : yearlyExpenseData
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    // use monthLabel for month view and name (year) for year view
                    dataKey={chartView === "month" ? "monthLabel" : "name"}
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    xAxisId="primary"
                    padding={{ left: 20, right: 20 }}
                    tickMargin={5}
                  />
                  {chartView === "month" && (
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
                        if (
                          !monthlyExpenseData ||
                          monthlyExpenseData.length === 0
                        )
                          return "";
                        const yearGroups: { [key: string]: number[] } = {};
                        monthlyExpenseData.forEach((item: any, idx: number) => {
                          const year = item.year;
                          if (!yearGroups[year]) yearGroups[year] = [];
                          yearGroups[year].push(idx);
                        });
                        for (const year in yearGroups) {
                          const indices = yearGroups[year];
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
                  )}
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `${(value / 1000).toLocaleString("en-US", {
                        minimumFractionDigits: (value / 1000) % 1 === 0 ? 0 : 2,
                        maximumFractionDigits: 2,
                      })}k`
                    }
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 1000 }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      fontFamily: "inherit",
                      boxShadow:
                        "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    }}
                    labelStyle={{
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: "8px",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                    itemStyle={{
                      color: "#111827",
                      fontSize: "14px",
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
                    labelFormatter={(label: string, payload: any) => {
                      if (chartView === "month" && payload && payload[0]) {
                        const data = payload[0].payload;
                        return `${data.fullName} ${data.year}`;
                      }
                      return label;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 2 }}
                    activeDot={{ r: 4 }}
                    xAxisId="primary"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title="Procurement Cost Distribution"
              subtitle="Shows cost distribution by category"
              delay={0.6}
              className="px-8 pt-6 pb-8"
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categoryData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="category"
                    type="category"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <YAxis
                    type="number"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `${(value / 1000).toLocaleString("en-US", {
                        minimumFractionDigits: (value / 1000) % 1 === 0 ? 0 : 2,
                        maximumFractionDigits: 2,
                      })}k`
                    }
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 1000 }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      fontFamily: "inherit",
                      boxShadow:
                        "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    }}
                    labelStyle={{
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: "8px",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                    itemStyle={{
                      color: "#111827",
                      fontSize: "14px",
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
                  />
                  <Bar dataKey={(entry) => entry.total} radius={[10, 10, 0, 0]}>
                    {categoryData.map((entry, index) => {
                      let color = "#90a4ae"; // Default to Other
                      if (entry.category === "Service") {
                        color = "#72d572";
                      } else if (entry.category === "Material") {
                        color = "#29b6f6";
                      }
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          {/* Supplier Analysis */}
          <ChartContainer
            title="Supplier Spending Overview"
            subtitle="Overview of supplier spending and detailed PO insights"
            delay={0.7}
            className="px-8 pt-6 pb-8"
          >
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left text-sm text-gray-600 table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 w-16 text-center">
                      No
                    </th>
                    <th className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 w-[300px] text-center">
                      Supplier
                    </th>
                    <th className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 w-[180px] whitespace-nowrap text-center">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 font-medium text-gray-900 w-28 text-center">
                      PO count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {supplierData
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((supplier, index) => (
                      <tr
                        key={supplier.name}
                        className="hover:bg-gray-50 transition-colors divide-x divide-gray-200"
                      >
                        <td className="px-4 py-1.5 text-gray-600 border-r border-gray-200 text-center">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td
                          className="px-4 py-1.5 text-gray-600 border-r border-gray-200 truncate"
                          title={supplier.name}
                        >
                          {supplier.name}
                        </td>
                        <td className="px-4 py-1.5 text-gray-600 border-r border-gray-200 text-right">
                          {supplier.totalAmount.toLocaleString("en-US", {
                            minimumFractionDigits:
                              supplier.totalAmount % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <button
                            onClick={() => handlePOCountClick(supplier.name)}
                            className="px-2 py-1 text-gray-600 rounded-full text-xs font-medium hover:bg-[#cfd8dc] transition-colors cursor-pointer"
                          >
                            {supplier.poCount} POs
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Pagination */}
              {supplierData.length > itemsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, supplierData.length)}{" "}
                    of {supplierData.length} suppliers
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className={`px-2 py-1 text-sm rounded-md transition-colors flex items-center justify-center ${
                        currentPage === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                      title="First Page"
                    >
                      <ChevronFirst size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className={`px-2 py-1 text-sm rounded-md transition-colors flex items-center justify-center ${
                        currentPage === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                      title="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* Page numbers */}
                    {Array.from(
                      {
                        length: Math.min(
                          5,
                          Math.ceil(supplierData.length / itemsPerPage),
                        ),
                      },
                      (_, i) => {
                        const totalPages = Math.ceil(
                          supplierData.length / itemsPerPage,
                        );
                        let pageNum;

                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              currentPage === pageNum
                                ? "bg-blue-500 text-white"
                                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                            }`}
                            title={`Page ${pageNum}`}
                          >
                            {pageNum}
                          </button>
                        );
                      },
                    )}

                    <button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(
                            prev + 1,
                            Math.ceil(supplierData.length / itemsPerPage),
                          ),
                        )
                      }
                      disabled={
                        currentPage ===
                        Math.ceil(supplierData.length / itemsPerPage)
                      }
                      className={`px-2 py-1 text-sm rounded-md transition-colors flex items-center justify-center ${
                        currentPage ===
                        Math.ceil(supplierData.length / itemsPerPage)
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                      title="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage(
                          Math.ceil(supplierData.length / itemsPerPage),
                        )
                      }
                      disabled={
                        currentPage ===
                        Math.ceil(supplierData.length / itemsPerPage)
                      }
                      className={`px-2 py-1 text-sm rounded-md transition-colors flex items-center justify-center ${
                        currentPage ===
                        Math.ceil(supplierData.length / itemsPerPage)
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                      title="Last Page"
                    >
                      <ChevronLast size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ChartContainer>

          {/* PO Details Modal */}
          {showPOModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-visible">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      PO Details
                    </h3>
                    <button
                      onClick={closeModal}
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
                  {loadingPOs ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <div className="text-gray-500 font-medium">
                        Loading PO details...
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedSupplierPOs.map((po, poIndex) => (
                        <div
                          key={poIndex}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {po.poNumber}{" "}
                                {po.projectCode && `- ${po.projectCode}`}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {po.date
                                  ? new Date(po.date)
                                      .toISOString()
                                      .split("T")[0]
                                  : "No date"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 mb-1">
                                Total Amount (Incl. VAT)
                              </p>
                              <p className="text-lg font-bold text-gray-900">
                                {po.totalAmount.toLocaleString("en-US", {
                                  minimumFractionDigits:
                                    po.totalAmount % 1 === 0 ? 0 : 2,
                                  maximumFractionDigits: 2,
                                })}
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
                                      style={{ width: "70%" }}
                                    >
                                      Description
                                    </th>
                                    <th
                                      className="px-3 py-2 h-12 text-right text-xs font-medium text-gray-500 whitespace-nowrap"
                                      style={{ width: "15%" }}
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
                                          className="px-3 py-2"
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
                                          style={{ width: "70%" }}
                                        >
                                          {item.description || "-"}
                                        </td>
                                        <td
                                          className="px-3 py-2 text-right font-normal text-gray-900"
                                          style={{ width: "15%" }}
                                        >
                                          {item.amount.toLocaleString("en-US", {
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
        </>
      )}
    </div>
  );
}
