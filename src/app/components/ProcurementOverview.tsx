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

// Services
import { getTab1Data, getTab2Data } from "../../services/googleSheetsService";

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [previousYearData, setPreviousYearData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>(filters.year);
  const [selectedProject, setSelectedProject] = useState<string>(
    filters.project,
  );

  useEffect(() => {
    const fetchPOData = async () => {
      try {
        // Fetch data from both tabs
        const [tab1Data, tab2Data] = await Promise.all([
          getTab1Data(),
          getTab2Data(),
        ]);

        // Apply filters
        let filteredTab1Data = tab1Data.rows;
        let filteredTab2Data = tab2Data.rows;
        let filteredLineData = tab2Data.rows; // df_LINE is tab2Data

        // Filter by year
        if (filters.year !== "all") {
          filteredTab1Data = filteredTab1Data.filter((row) => {
            const dateStr = row["DATE"];
            if (dateStr) {
              const year = new Date(dateStr).getFullYear().toString();
              return year === filters.year;
            }
            return false;
          });

          filteredTab2Data = filteredTab2Data.filter((row) => {
            const dateStr = row["DATE"];
            if (dateStr) {
              const year = new Date(dateStr).getFullYear().toString();
              return year === filters.year;
            }
            return false;
          });

          filteredLineData = filteredLineData.filter((row) => {
            const dateStr = row["DATE"];
            if (dateStr) {
              const year = new Date(dateStr).getFullYear().toString();
              return year === filters.year;
            }
            return false;
          });
        }

        // Filter by project
        if (filters.project !== "all") {
          filteredTab1Data = filteredTab1Data.filter(
            (row) => row["Project Code"] === filters.project,
          );

          filteredTab2Data = filteredTab2Data.filter(
            (row) => row["Project Code"] === filters.project,
          );

          filteredLineData = filteredLineData.filter(
            (row) => row["Project Code"] === filters.project,
          );
        }

        // Extract unique PO.NO. values from df_HEADER
        const uniquePOs = new Set(filteredTab1Data.map((row) => row["PO.NO."]));
        setUniquePOCount(uniquePOs.size);

        // Calculate total amount from df_HEADER
        const total = filteredTab1Data.reduce((sum, row) => {
          const amount = parseFloat(
            row["Total Amount"]?.toString().replace(/,/g, "") || "0",
          );
          return sum + amount;
        }, 0);
        setTotalAmount(total);

        // Calculate total service costs from df_LINE where Category = "Service"
        const serviceTotal = filteredTab2Data.reduce((sum, row) => {
          if (row["Category"] === "Service") {
            const amount = parseFloat(
              row["Total Amount"]?.toString().replace(/,/g, "") || "0",
            );
            return sum + amount;
          }
          return sum;
        }, 0);
        setTotalServiceCosts(serviceTotal);

        // Calculate total material costs from df_LINE where Category = "Material"
        const materialTotal = filteredTab2Data.reduce((sum, row) => {
          if (row["Category"] === "Material") {
            const amount = parseFloat(
              row["Total Amount"]?.toString().replace(/,/g, "") || "0",
            );
            return sum + amount;
          }
          return sum;
        }, 0);
        setTotalMaterialCosts(materialTotal);

        // Calculate total other costs from df_LINE where Category = "Other"
        const otherTotal = filteredTab2Data.reduce((sum, row) => {
          if (row["Category"] === "Other") {
            const amount = parseFloat(
              row["Total Amount"]?.toString().replace(/,/g, "") || "0",
            );
            return sum + amount;
          }
          return sum;
        }, 0);
        setTotalOtherCosts(otherTotal);

        // Process monthly expense data from filtered df_HEADER
        const monthlyExpenseMap = filteredTab1Data.reduce(
          (acc, row) => {
            const dateStr = row["DATE"];
            if (dateStr) {
              const date = new Date(dateStr);
              const year = date.getFullYear();
              const month = date.getMonth() + 1; // 1-12
              const monthYear = `${year}-${month < 10 ? "0" : ""}${month}`;

              const amount = parseFloat(
                row["Total Amount"]?.toString().replace(/,/g, "") || "0",
              );

              if (!acc[monthYear]) {
                acc[monthYear] = 0;
              }
              acc[monthYear] = (acc[monthYear] as number) + amount;
            }
            return acc;
          },
          {} as Record<string, number>,
        );

        // Convert to array and sort by date
        const sortedMonthlyData = Object.keys(monthlyExpenseMap)
          .sort()
          .map((monthYear) => {
            const [year, month] = monthYear.split("-");
            const monthNames = [
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
            const monthShortNames = [
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
            const monthName = monthNames[parseInt(month) - 1];
            const monthShortName = monthShortNames[parseInt(month) - 1];

            return {
              name: monthShortName, // For X-axis display
              fullName: monthName, // For Tooltip display
              year: year,
              value: monthlyExpenseMap[monthYear],
              showYear: false, // Will be updated later
            } as any;
          });

        // Find middle position for each year
        const yearGroups = {} as Record<string, number[]>;
        sortedMonthlyData.forEach((item, index) => {
          if (!yearGroups[item.year]) {
            yearGroups[item.year] = [];
          }
          yearGroups[item.year].push(index);
        });

        // Mark middle position for each year
        sortedMonthlyData.forEach((item, index) => {
          const yearIndices = yearGroups[item.year];
          const middleIndex = yearIndices[Math.floor(yearIndices.length / 2)];
          item.showYear = index === middleIndex;
        });

        setMonthlyExpenseData(sortedMonthlyData);

        // Calculate supplier statistics from filtered df_HEADER
        const supplierStats = filteredTab1Data.reduce(
          (acc, row) => {
            const supplierName = String(row["Supplier Name"]);
            const amount = parseFloat(
              String(row["Total Amount"]?.toString().replace(/,/g, "") || "0"),
            );

            if (supplierName && supplierName.trim() !== "" && amount > 0) {
              if (!acc[supplierName]) {
                acc[supplierName] = {
                  name: supplierName,
                  totalAmount: 0,
                  poCount: 0,
                };
              }
              acc[supplierName].totalAmount += amount;
              acc[supplierName].poCount += 1;
            }
            return acc;
          },
          {} as Record<
            string,
            { name: string; totalAmount: number; poCount: number }
          >,
        );

        // Calculate previous year data for growth comparison
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;

        const previousYearStats = filteredTab1Data.reduce(
          (acc, row) => {
            const supplierName = String(row["Supplier Name"]);
            const amount = parseFloat(
              String(row["Total Amount"]?.toString().replace(/,/g, "") || "0"),
            );
            const dateStr = String(row["DATE"] || "");

            if (
              supplierName &&
              supplierName.trim() !== "" &&
              amount > 0 &&
              dateStr
            ) {
              const rowYear = new Date(dateStr).getFullYear();
              if (rowYear === previousYear) {
                if (!acc[supplierName]) {
                  acc[supplierName] = 0;
                }
                acc[supplierName] += amount;
              }
            }
            return acc;
          },
          {} as Record<string, number>,
        );

        // Convert to array and calculate growth
        const sortedSuppliers = Object.values(supplierStats)
          .map((supplier) => {
            const previousAmount = previousYearStats[supplier.name] || 0;
            const growthRate =
              previousAmount > 0
                ? ((Number(supplier.totalAmount) - Number(previousAmount)) /
                    Number(previousAmount)) *
                  100
                : 0;

            return {
              ...supplier,
              growthRate: parseFloat(growthRate.toFixed(1)),
            };
          })
          .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

        setSupplierData(sortedSuppliers);
        setCurrentPage(1); // Reset to first page when data changes

        // Calculate category spending from df_LINE (filteredLineData)
        const categorySpend = filteredLineData.reduce(
          (acc, row) => {
            const category = String(row["Category"] || "Unknown");
            const amount = parseFloat(String(row["Amount"] || "0"));

            if (!acc[category]) acc[category] = 0;
            acc[category] = Number(acc[category]) + amount;

            return acc;
          },
          {} as Record<string, number>,
        );

        // Convert to array and sort by total amount (descending)
        const sortedCategories = Object.entries(categorySpend)
          .map(([category, total]) => ({
            category,
            total: Number(total),
          }))
          .sort((a, b) => Number(b.total) - Number(a.total));

        setCategoryData(sortedCategories);
      } catch (error) {
        console.error("Error fetching PO data:", error);
        setUniquePOCount(0);
        setTotalAmount(0);
        setTotalServiceCosts(0);
        setTotalMaterialCosts(0);
        setTotalOtherCosts(0);
        setMonthlyExpenseData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPOData();
  }, [filters]);

  return (
    <div className="space-y-6">
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
          value={loading ? "Loading..." : `${totalAmount.toLocaleString()}`}
          trend=""
          trendUp={false}
          icon={FaMoneyBill}
          iconSize={28}
          delay={0.2}
        />
        <KPICard
          title="Total Service Cost"
          value={
            loading ? "Loading..." : `${totalServiceCosts.toLocaleString()}`
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
            loading ? "Loading..." : `${totalMaterialCosts.toLocaleString()}`
          }
          trend=""
          trendUp={true}
          icon={BiSolidCctv}
          iconSize={28}
          delay={0.4}
        />
        <KPICard
          title="Total Other Cost"
          value={loading ? "Loading..." : `${totalOtherCosts.toLocaleString()}`}
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
          title="Expense Trend Analysis"
          subtitle="Monthly Spending Overview"
          className="lg:col-span-2"
          delay={0.5}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyExpenseData}>
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
                xAxisId="primary"
              />
              <XAxis
                dataKey="year"
                stroke="#6b7280"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                xAxisId="secondary"
                orientation="bottom"
                height={20}
                tick={{ dy: 10 }}
                tickFormatter={(value, index) => {
                  const data = monthlyExpenseData[index];
                  return data?.showYear ? value : "";
                }}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toLocaleString()}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [
                  `${value.toLocaleString()}`,
                  "Total Amount",
                ]}
                labelFormatter={(label: string, payload: any) => {
                  if (payload && payload[0]) {
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
          title="Spending by Category"
          subtitle="Total spending by category"
          delay={0.6}
        >
          <ResponsiveContainer width="100%" height={300}>
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
                tickFormatter={(value) => `${(value / 1000).toLocaleString()}k`}
              />
              <Tooltip
                cursor={{ fill: "#e5e7eb", opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [
                  `฿${value.toLocaleString()}`,
                  "Total Amount",
                ]}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index % 2 === 0 ? "#3b82f6" : "#06b6d4"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Supplier Analysis */}
      <ChartContainer
        title="Supplier Spend Overview"
        subtitle="Top suppliers by total spending"
        delay={0.7}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="text-xs bg-gray-50 text-gray-900">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Rank</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">PO count</th>
                <th className="px-4 py-3 rounded-r-lg">Spending Growth %</th>
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
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          (currentPage - 1) * itemsPerPage + index === 0
                            ? "bg-yellow-100 text-yellow-800"
                            : (currentPage - 1) * itemsPerPage + index === 1
                              ? "bg-gray-100 text-gray-800"
                              : (currentPage - 1) * itemsPerPage + index === 2
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {supplier.name}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-bold">
                      ฿{supplier.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {supplier.poCount} POs
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {supplier.growthRate > 0 ? (
                          <>
                            <span className="text-green-600 font-medium text-sm">
                              +{supplier.growthRate}%
                            </span>
                            <span className="text-xs text-gray-500">YoY</span>
                          </>
                        ) : supplier.growthRate < 0 ? (
                          <>
                            <span className="text-red-600 font-medium text-sm">
                              {supplier.growthRate}%
                            </span>
                            <span className="text-xs text-gray-500">YoY</span>
                          </>
                        ) : (
                          <span className="text-gray-500 font-medium text-sm">
                            0%
                          </span>
                        )}
                      </div>
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
                {Math.min(currentPage * itemsPerPage, supplierData.length)} of{" "}
                {supplierData.length} suppliers
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
    </div>
  );
}
