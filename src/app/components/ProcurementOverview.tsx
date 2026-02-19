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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedSupplierPOs, setSelectedSupplierPOs] = useState<any[]>([]);
  const [showPOModal, setShowPOModal] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(false);
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
        setLoading(true);
        // Fetch data (both currently map to the same sheet in our refactored service)
        const [tab1Data, tab2Data] = await Promise.all([
          getTab1Data(),
          getTab2Data(),
        ]);

        const allRows = [...tab1Data.rows, ...tab2Data.rows];
        // Remove duplicates if any (based on poNumber and itemDescription)
        const seen = new Set();
        const uniqueRows = allRows.filter((row: any) => {
          const key = `${row.poNumber}-${row.itemDescription}-${row.date}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Apply filters
        let filteredData = uniqueRows;

        // Filter by year
        if (filters.year !== "all") {
          filteredData = filteredData.filter((row: any) => {
            const dateStr = row.date;
            if (dateStr) {
              const year = new Date(dateStr).getFullYear().toString();
              return year === filters.year;
            }
            return false;
          });
        }

        // Filter by project
        if (filters.project !== "all") {
          filteredData = filteredData.filter(
            (row: any) => row.projectCode === filters.project,
          );
        }

        // 1. KPI Calculations
        const uniquePOs = new Set(filteredData.map((row: any) => row.poNumber));
        setUniquePOCount(uniquePOs.size);

        const total = filteredData.reduce(
          (sum: number, row: any) => sum + (parseFloat(row.totalPrice) || 0),
          0,
        );
        setTotalAmount(total);

        const serviceTotal = filteredData.reduce((sum: number, row: any) => {
          if (row.category === "Services" || row.category === "Service") {
            return sum + (parseFloat(row.totalPrice) || 0);
          }
          return sum;
        }, 0);
        setTotalServiceCosts(serviceTotal);

        const materialTotal = filteredData.reduce((sum: number, row: any) => {
          if (
            row.category === "Construction" ||
            row.category === "Material" ||
            row.category === "IT Equipment"
          ) {
            return sum + (parseFloat(row.totalPrice) || 0);
          }
          return sum;
        }, 0);
        setTotalMaterialCosts(materialTotal);

        const otherTotal = total - serviceTotal - materialTotal;
        setTotalOtherCosts(otherTotal > 0 ? otherTotal : 0);

        // 2. Process monthly expense data
        const monthlyExpenseMap = filteredData.reduce(
          (acc: Record<string, number>, row: any) => {
            const dateStr = row.date;
            if (dateStr) {
              const date = new Date(dateStr);
              const year = date.getFullYear();
              const month = date.getMonth() + 1;
              const monthYear = `${year}-${month < 10 ? "0" : ""}${month}`;
              const amount = parseFloat(row.totalPrice) || 0;

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
              fullName: fullMonths[mIdx],
              year: year,
              value: monthlyExpenseMap[monthYear],
              showYear: false,
            };
          });

        // Mark year labels
        const yearSet = new Set();
        sortedMonthlyData.forEach((item) => {
          if (!yearSet.has(item.year)) {
            item.showYear = true;
            yearSet.add(item.year);
          }
        });

        setMonthlyExpenseData(sortedMonthlyData);

        // 3. Supplier Statistics
        const supplierStats = filteredData.reduce(
          (acc: Record<string, any>, row: any) => {
            const name = row.supplierName || "Unknown";
            const amount = parseFloat(row.totalPrice) || 0;

            if (!acc[name]) {
              acc[name] = {
                name,
                totalAmount: 0,
                poCount: 0,
                poNumbers: new Set(),
              };
            }
            acc[name].totalAmount += amount;
            acc[name].poNumbers.add(row.poNumber);
            acc[name].poCount = acc[name].poNumbers.size;
            return acc;
          },
          {},
        );

        const currentYear = new Date().getFullYear();
        const prevYear = currentYear - 1;

        // Calculate growth (simplified for refactor)
        const suppliersWithStats = Object.values(supplierStats)
          .map((s: any) => {
            return {
              name: s.name,
              totalAmount: s.totalAmount,
              poCount: s.poCount,
              spendShare: parseFloat(
                ((s.totalAmount / total) * 100).toFixed(1),
              ),
              growthRate: 0, // Simplified
            };
          })
          .sort((a, b) => b.totalAmount - a.totalAmount);

        setSupplierData(suppliersWithStats);

        // 4. Category Statistics
        const categorySpend = filteredData.reduce(
          (acc: Record<string, number>, row: any) => {
            const cat = row.category || "Other";
            const amount = parseFloat(row.totalPrice) || 0;
            acc[cat] = (acc[cat] || 0) + amount;
            return acc;
          },
          {},
        );

        const sortedCategories = Object.entries(categorySpend)
          .map(([category, total]) => ({ category, total }))
          .sort((a: any, b: any) => b.total - a.total);

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
      const [tab1Data, tab2Data] = await Promise.all([
        getTab1Data(),
        getTab2Data(),
      ]);

      const allRows = [...tab1Data.rows, ...tab2Data.rows];
      const supplierRows = allRows.filter(
        (row: any) => row.supplierName === supplierName,
      );

      // Group by PO Number
      const poGroups = supplierRows.reduce(
        (acc: Record<string, any>, row: any) => {
          if (!acc[row.poNumber]) {
            acc[row.poNumber] = {
              poNumber: row.poNumber,
              date: row.date,
              projectCode: row.projectCode,
              totalAmount: 0,
              lineItems: [],
            };
          }
          acc[row.poNumber].totalAmount += parseFloat(row.totalPrice) || 0;
          acc[row.poNumber].lineItems.push({
            category: row.category,
            amount: parseFloat(row.totalPrice) || 0,
            description: row.itemDescription,
          });
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
          subtitle="Monthly spending overview"
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
          title="Cost Allocation by Category"
          subtitle="Breakdown of procurement expenses by category"
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
                  `${value.toLocaleString()}`,
                  "Total Amount",
                ]}
              />
              <Bar dataKey="total" radius={[10, 10, 0, 0]}>
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
        title="Supplier Spending Overview"
        subtitle="Overview of supplier spending and detailed PO insights"
        delay={0.7}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 table-fixed">
            <thead className="text-xs bg-gray-50 text-gray-900">
              <tr>
                <th className="px-6 py-3 rounded-l-lg w-20">Rank</th>
                <th className="px-6 py-3 w-[300px]">Supplier Name</th>
                <th className="px-6 py-3 w-[180px]">Total Amount</th>
                <th className="px-6 py-3 rounded-r-lg w-28">PO count</th>
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
                    <td className="px-6 py-3 font-medium text-gray-900">
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
                    <td className="px-6 py-3 text-gray-900 font-medium">
                      {supplier.name}
                    </td>
                    <td className="px-6 py-3 text-gray-900 font-bold">
                      {supplier.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handlePOCountClick(supplier.name)}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors cursor-pointer"
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

      {/* PO Details Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
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
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading PO details...</div>
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
                              ? new Date(po.date).toISOString().split("T")[0]
                              : "No date"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">
                            Total Amount (Incl. VAT, Less Discount)
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {po.totalAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Items:
                        </h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider">
                                  Category
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider">
                                  Description
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 tracking-wider">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {po.lineItems.map(
                                (item: any, itemIndex: number) => (
                                  <tr key={itemIndex}>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <span
                                        className={`px-2 py-1 text-xs rounded-full ${
                                          item.category === "Service"
                                            ? "bg-blue-100 text-blue-800"
                                            : item.category === "Material"
                                              ? "bg-green-100 text-green-800"
                                              : "bg-gray-100 text-gray-800"
                                        }`}
                                      >
                                        {item.category}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-900">
                                      {item.description || "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                                      {item.amount.toLocaleString()}
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
    </div>
  );
}
