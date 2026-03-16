import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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

// Chart Utils
import { shouldShowYearLabel } from "../../utils/chartAxisUtils";

// Lucide Icons
import {
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
import {
  convertToThaiMonth,
  convertToThaiMonthFull,
} from "../utils/thaiMonthUtils";

// Services
import { getSheetDataByName } from "../../services/googleSheetsService";

export function ProcurementOverview({
  filters,
}: {
  filters: { year: string; project: string; months?: string[] };
}) {
  // Utility functions
  const extractMonthFromDate = (
    dateStr: string | undefined | null,
  ): number | null => {
    if (!dateStr) return null;

    let month: number;
    if (dateStr.includes("/")) {
      // Format: DD/MM/YYYY or DD/MM/YY
      const parts = dateStr.split("/");
      month = parseInt(parts[1]);
    } else if (dateStr.includes("-")) {
      // Format: YYYY-MM-DD
      const parts = dateStr.split("-");
      month = parseInt(parts[1]);
    } else {
      return null;
    }

    return isNaN(month) ? null : month;
  };

  const extractYearFromDate = (
    dateStr: string | undefined | null,
  ): number | null => {
    if (!dateStr) return null;

    let year: number;
    if (dateStr.includes("/")) {
      // Format: DD/MM/YYYY or DD/MM/YY
      const parts = dateStr.split("/");
      year = parseInt(parts[2]);
    } else if (dateStr.includes("-")) {
      // Format: YYYY-MM-DD
      const parts = dateStr.split("-");
      year = parseInt(parts[0]);
    } else {
      return null;
    }

    return isNaN(year) ? null : year;
  };

  const extractMonthYearFromDate = (
    dateStr: string | undefined | null,
  ): string | null => {
    if (!dateStr) return null;

    let year: number, month: number;
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
      return null;
    }

    if (isNaN(year) || isNaN(month)) return null;

    return `${year}-${month < 10 ? "0" : ""}${month}`;
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return 0;

    if (dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/");
      const y = Number(year) > 2400 ? Number(year) - 543 : Number(year);

      return new Date(y, Number(month) - 1, Number(day)).getTime();
    }

    return new Date(dateStr).getTime();
  };

  // Main data fetching function
  const fetchPOData = async () => {
    try {
      setLoading(true);
      // Fetch data from specific sheets with forceRefresh for navigation
      const [headDataResponse, lineDataResponse] = await Promise.all([
        getSheetDataByName("procurement_head", { forceRefresh: true }),
        getSheetDataByName("procurement_line", { forceRefresh: true }),
      ]);

      const headRows = headDataResponse.rows || [];
      const lineRows = lineDataResponse.rows || [];

      // Central filtering function for head data
      const filterHeadData = (rows: any[]) => {
        return rows.filter((row) => {
          // Year filter
          if (filters.year !== "all") {
            const year = extractYearFromDate(row.Date);
            if (year === null || year.toString() !== filters.year) {
              return false;
            }
          }

          // Project filter
          if (filters.project !== "all") {
            if (row.Project !== filters.project) {
              return false;
            }
          }

          // Month filter
          if (filters.months && filters.months.length > 0) {
            const month = extractMonthFromDate(row.Date);
            if (month === null || !filters.months.includes(month.toString())) {
              return false;
            }
          }

          return true;
        });
      };

      // Central filtering function for line data
      const filterLineData = (rows: any[]) => {
        return rows.filter((row) => {
          // Year filter
          if (filters.year !== "all") {
            const year = extractYearFromDate(row.Date);
            if (year === null || year.toString() !== filters.year) {
              return false;
            }
          }

          // Project filter
          if (filters.project !== "all") {
            if (row.Project !== filters.project) {
              return false;
            }
          }

          // Month filter
          if (filters.months && filters.months.length > 0) {
            const month = extractMonthFromDate(row.Date);
            if (month === null || !filters.months.includes(month.toString())) {
              return false;
            }
          }

          return true;
        });
      };

      // Apply filters to get filtered data
      const filteredHead = filterHeadData(headRows);
      const filteredLine = filterLineData(lineRows);

      // For yearly overview, we need data without month filter
      const projectFilteredHead = headRows.filter((row) => {
        if (filters.project !== "all") {
          return row.Project === filters.project;
        }
        return true;
      });

      // 3. Single reduce pass for all category costs and category spend
      const categoryStats = filteredLine.reduce(
        (
          acc: {
            serviceTotal: number;
            materialTotal: number;
            otherTotal: number;
            categorySpend: Record<string, number>;
          },
          row: any,
        ) => {
          const category = row.Category || "Other";
          const amount = parseFloat(row["Total Amount"]) || 0;

          // Update category totals
          if (category === "Service") {
            acc.serviceTotal += amount;
          } else if (category === "Material") {
            acc.materialTotal += amount;
          } else {
            acc.otherTotal += amount;
          }

          // Update category spend map
          acc.categorySpend[category] =
            (acc.categorySpend[category] || 0) + amount;

          return acc;
        },
        {
          serviceTotal: 0,
          materialTotal: 0,
          otherTotal: 0,
          categorySpend: {},
        },
      );

      // 4. KPI Calculations
      const uniquePOs = new Set(
        filteredHead.map((row: any) => row["PO Number"]).filter(Boolean),
      );
      setUniquePOCount(uniquePOs.size);

      const totalAmountHead = filteredHead.reduce(
        (sum: number, row: any) =>
          sum + (parseFloat(String(row["Net Amount"]).replace(/,/g, "")) || 0),
        0,
      );
      setTotalAmount(totalAmountHead);

      setTotalServiceCosts(categoryStats.serviceTotal);
      setTotalMaterialCosts(categoryStats.materialTotal);
      setTotalOtherCosts(categoryStats.otherTotal);

      // 5. Process monthly expense data from procurement_head
      const monthlyExpenseMap = filteredHead.reduce(
        (acc: Record<string, number>, row: any) => {
          const monthYear = extractMonthYearFromDate(row.Date);
          if (monthYear) {
            const amount =
              parseFloat(String(row["Net Amount"]).replace(/,/g, "")) || 0;
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
            monthLabel: convertToThaiMonth(months[mIdx].slice(0, 3)),
            fullName: fullMonths[mIdx],
            thaiFullName: convertToThaiMonthFull(months[mIdx].slice(0, 3)),
            year: year,
            value: monthlyExpenseMap[monthYear],
            showYear: false,
          };
        });

      setMonthlyExpenseData(sortedMonthlyData);

      // 5. Process yearly expense data from procurement_head
      const yearlyExpenseMap = projectFilteredHead.reduce(
        (acc: Record<string, number>, row: any) => {
          const year = extractYearFromDate(row.Date);

          if (year) {
            const amount =
              parseFloat(String(row["Net Amount"]).replace(/,/g, "")) || 0;
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

      // 6. Supplier Data from procurement_head
      const supplierMap = filteredHead.reduce((acc: any, row: any) => {
        const supplier = row.Supplier;
        const amount =
          parseFloat(String(row["Net Amount"]).replace(/,/g, "")) || 0;
        const poNumber = row["PO Number"];

        if (!acc[supplier]) {
          acc[supplier] = {
            supplier: supplier,
            totalAmount: 0,
            poNumbers: new Set(),
          };
        }

        acc[supplier].totalAmount += amount;

        if (poNumber) {
          acc[supplier].poNumbers.add(poNumber);
        }

        return acc;
      }, {});

      const sortedSuppliers = Object.values(supplierMap)
        .map((supplier: any) => ({
          name: supplier.supplier,
          totalAmount: supplier.totalAmount,
          poCount: supplier.poNumbers.size,
        }))
        .sort((a: any, b: any) => b.totalAmount - a.totalAmount);

      setSupplierData(sortedSuppliers);

      // 7. Category Data
      const orderedCategories = [
        {
          category: "Service",
          total: categoryStats.serviceTotal || 0,
        },
        {
          category: "Material",
          total: categoryStats.materialTotal || 0,
        },
        {
          category: "Other",
          total: categoryStats.otherTotal || 0,
        },
      ];

      setCategoryData(orderedCategories);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error processing procurement data:", error);
    } finally {
      setLoading(false);
    }
  };
  const location = useLocation();
  const [uniquePOCount, setUniquePOCount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalServiceCosts, setTotalServiceCosts] = useState<number>(0);
  const [totalMaterialCosts, setTotalMaterialCosts] = useState<number>(0);
  const [totalOtherCosts, setTotalOtherCosts] = useState<number>(0);
  const [monthlyExpenseData, setMonthlyExpenseData] = useState<any[]>([]);
  const [supplierData, setSupplierData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedSupplierPOs, setSelectedSupplierPOs] = useState<any[]>([]);
  const [showPOModal, setShowPOModal] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [selectedSupplierName, setSelectedSupplierName] = useState("");
  const [previousYearData, setPreviousYearData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [chartView, setChartView] = useState<"month" | "year">("month");
  const [yearlyExpenseData, setYearlyExpenseData] = useState<any[]>([]);

  useEffect(() => {
    fetchPOData();
  }, [filters.year, filters.project, filters.months, location.pathname]);

  // Listen for data updates from DataSource
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log("🔄 [ProcurementOverview] Data updated, refreshing...");
      fetchPOData();
    };

    window.addEventListener("dataUpdated", handleDataUpdate);

    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdate);
    };
  }, []);

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

      // Apply year/project/month filters if active for head data
      if (filters.year !== "all") {
        supplierHeadRows = supplierHeadRows.filter((row: any) => {
          const year = extractYearFromDate(row.Date);
          return year !== null && year.toString() === filters.year;
        });
      }
      if (filters.project !== "all") {
        supplierHeadRows = supplierHeadRows.filter(
          (row: any) => row.Project === filters.project,
        );
      }
      if (filters.months && filters.months.length > 0) {
        supplierHeadRows = supplierHeadRows.filter((row: any) => {
          const month = extractMonthFromDate(row.Date);
          return month !== null && filters.months!.includes(month.toString());
        });
      }

      // Filter line data similarly for line items
      let supplierLineRows = lineRows.filter(
        (row: any) => row.Supplier === supplierName,
      );

      // Apply year/project/month filters if active for line data
      if (filters.year !== "all") {
        supplierLineRows = supplierLineRows.filter((row: any) => {
          const year = extractYearFromDate(row.Date);
          return year !== null && year.toString() === filters.year;
        });
      }
      if (filters.project !== "all") {
        supplierLineRows = supplierLineRows.filter(
          (row: any) => row.Project === filters.project,
        );
      }
      if (filters.months && filters.months.length > 0) {
        supplierLineRows = supplierLineRows.filter((row: any) => {
          const month = extractMonthFromDate(row.Date);
          return month !== null && filters.months!.includes(month.toString());
        });
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
            totalAmount:
              parseFloat(String(row["Net Amount"]).replace(/,/g, "")) || 0, // Use Net Amount from procurement_head
            lineItems: lineItemGroups[poNo] || [], // Get line items from grouped line data
          };
          return acc;
        },
        {},
      );

      const sortedPOs = Object.values(poGroups).sort(
        (a: any, b: any) => parseDate(b.date) - parseDate(a.date),
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
    setSelectedSupplierName(supplierName);
    fetchSupplierPOs(supplierName);
  };

  // Function to close modal
  const closeModal = () => {
    setShowPOModal(false);
    setSelectedSupplierPOs([]);
    setSelectedSupplierName("");
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
              title="Net Amount"
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
                      tickFormatter={(value, index) =>
                        shouldShowYearLabel(
                          chartView === "month"
                            ? monthlyExpenseData
                            : yearlyExpenseData,
                          index,
                          "year",
                        )
                      }
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
                      "Net Amount",
                    ]}
                    labelFormatter={(label: string, payload: any) => {
                      if (chartView === "month" && payload && payload[0]) {
                        const data = payload[0].payload;
                        return `${data.thaiFullName} ${data.year}`;
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
                      "Net Amount",
                    ]}
                  />
                  <Bar dataKey="total" radius={[10, 10, 0, 0]}>
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
            <div className="border border-gray-200 rounded-lg bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full text-left text-sm text-gray-600 table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 w-16 text-center">
                        No
                      </th>
                      <th className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 w-[300px] text-center">
                        Supplier
                      </th>
                      <th className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 w-[180px] whitespace-nowrap text-center">
                        Net Amount
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
              </div>

              {/* Pagination */}
              {supplierData.length > itemsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, supplierData.length)}{" "}
                    of {supplierData.length}{" "}
                    {supplierData.length === 1 ? "supplier" : "suppliers"}
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
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-visible">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      PO Details by {selectedSupplierName}
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
                                {po.date ? po.date : "No date"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 mb-1">
                                Net Amount
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
