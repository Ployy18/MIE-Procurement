import React, { useState, useEffect } from "react";
import {
  Upload,
  RefreshCw,
  Database,
  EyeOff,
  Settings,
  Eye,
  Filter,
} from "lucide-react";
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
import { ChartContainer } from "./ChartContainer";
import {
  getTab1Data,
  getTab2Data,
  getMainSheetData,
  getSheetNames,
  getSheetDataByName,
  addNewSheet,
  addSheetURL,
} from "../../services/googleSheetsService";

interface DataSourceConfig {
  id: string;
  name: string;
  type: "google-sheets" | "api" | "database";
  status: "connected" | "disconnected" | "syncing";
  lastSync?: string;
  url?: string;
  apiKey?: string;
}

interface DataSourceItem {
  id: string;
  name: string;
  type: string;
  size: string;
  records: number;
  lastUpdated: string;
  status: "active" | "inactive";
}

export function DataSource() {
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<
    "connected" | "disconnected" | "syncing"
  >("connected");
  const [selectedTab, setSelectedTab] = useState<string>("P65019_ปี2565");
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);

  const [configs, setConfigs] = useState<DataSourceConfig[]>([
    {
      id: "1",
      name: "Google Sheets - df_HEADER",
      type: "google-sheets",
      status: syncStatus,
      lastSync: new Date().toLocaleString(),
      url: "https://docs.google.com/spreadsheets/d/...",
    },
    {
      id: "2",
      name: "Google Sheets - df_LINE",
      type: "google-sheets",
      status: "connected",
      lastSync: "2025-02-16 10:30:00",
      url: "https://docs.google.com/spreadsheets/d/...",
    },
  ]);

  const [dataItems, setDataItems] = useState<DataSourceItem[]>([
    {
      id: "1",
      name: "Purchase Orders",
      type: "Main Dataset",
      size: loading
        ? "Loading..."
        : `${(sheetData.length * 0.5).toFixed(2)} KB`,
      records: loading ? 0 : sheetData.length,
      lastUpdated: loading ? "Loading..." : new Date().toLocaleString(),
      status: syncStatus === "connected" ? "active" : "inactive",
    },
    {
      id: "2",
      name: "Line Items",
      type: "Supporting Dataset",
      size: "1.8 MB",
      records: 3420,
      lastUpdated: "2025-02-16 09:15:00",
      status: "active",
    },
    {
      id: "3",
      name: "Suppliers",
      type: "Reference Data",
      size: "0.3 MB",
      records: 45,
      lastUpdated: "2025-02-15 14:30:00",
      status: "active",
    },
  ]);

  // Initialize available sheets and check for new sheets periodically
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const sheets = await getSheetNames();
        setAvailableSheets(sheets);
        // Set default tab if none selected or if default doesn't exist in new list
        if (
          sheets.length > 0 &&
          (!selectedTab || !sheets.includes(selectedTab))
        ) {
          setSelectedTab(sheets[0]);
        }
      } catch (error) {
        console.error("Failed to initialize sheet names:", error);
      }
    };

    fetchNames();

    // Set up interval to check for new sheets every 60 seconds
    const interval = setInterval(async () => {
      try {
        const updatedSheets = await getSheetNames();
        setAvailableSheets((prev) => {
          if (updatedSheets.length !== prev.length) {
            return updatedSheets;
          }
          return prev;
        });
      } catch (e) {
        console.error("Failed to refresh sheet names in background:", e);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch data from Google Sheets on component mount and tab change
  useEffect(() => {
    const fetchData = async () => {
      try {
        setSyncStatus("syncing");

        // Fetch data specific to the selected sheet
        const data = await getSheetDataByName(selectedTab);

        setSheetData(data.rows);
        setCurrentData(data.rows);

        // Update data items with real data
        const realRecords = data.rows.length;
        const realSize = (
          JSON.stringify(data.rows).length /
          1024 /
          1024
        ).toFixed(2);
        const currentTime = new Date().toLocaleString();

        setDataItems((prev) =>
          prev.map((item) =>
            item.id === "1"
              ? {
                  ...item,
                  records: realRecords,
                  size: `${realSize} MB`,
                  lastUpdated: currentTime,
                }
              : item,
          ),
        );

        setSyncStatus("connected");
      } catch (error) {
        console.error(`Error fetching data for sheet ${selectedTab}:`, error);
        setSyncStatus("disconnected");
      } finally {
        setLoading(false);
      }
    };

    if (availableSheets.length > 0) {
      fetchData();
    }
  }, [selectedTab, availableSheets]);

  const handleRefresh = async () => {
    try {
      setSyncStatus("syncing");

      // Fetch data specific to the selected sheet
      const data = await getSheetDataByName(selectedTab);

      setSheetData(data.rows);
      setCurrentData(data.rows);

      const realRecords = data.rows.length;
      const realSize = (JSON.stringify(data.rows).length / 1024 / 1024).toFixed(
        2,
      );
      const currentTime = new Date().toLocaleString();

      setDataItems((prev) =>
        prev.map((item) =>
          item.id === "1"
            ? {
                ...item,
                records: realRecords,
                size: `${realSize} MB`,
                lastUpdated: currentTime,
              }
            : item,
        ),
      );

      setConfigs((prev) =>
        prev.map((config) =>
          config.type === "google-sheets"
            ? { ...config, lastSync: currentTime }
            : config,
        ),
      );

      setSyncStatus("connected");
    } catch (error) {
      console.error(`Error refreshing data for sheet ${selectedTab}:`, error);
      setSyncStatus("disconnected");
    }
  };

  const [selectedConfig, setSelectedConfig] = useState<string>("1");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSync = async (configId: string) => {
    await handleRefresh();
    setIsSyncing(false);
  };

  const handleAddNewSheet = async () => {
    const sheetName = prompt(
      "กรุณาใส่ชื่อชีทใหม่ (สำหรับเรียกดูข้อมูลที่อัปโหลดไว้แล้ว):",
    );
    if (sheetName && sheetName.trim()) {
      const cleanSheetName = sheetName.trim();

      // Note: With Node.js backend, you usually upload data to create/populate sheets.
      // This button now just helps you switch to a sheet you know exists.
      const updatedSheets = await getSheetNames();
      if (!updatedSheets.includes(cleanSheetName)) {
        setAvailableSheets([...updatedSheets, cleanSheetName]);
      }
      setSelectedTab(cleanSheetName);
    }
  };

  const handleTestConnection = async (configId: string) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.id === configId
          ? { ...config, status: "syncing" as const }
          : config,
      ),
    );

    // Simulate connection test
    setTimeout(() => {
      setConfigs((prev) =>
        prev.map((config) =>
          config.id === configId
            ? { ...config, status: "connected" as const }
            : config,
        ),
      );
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-600 bg-green-100";
      case "disconnected":
        return "text-red-600 bg-red-100";
      case "syncing":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Database size={16} />;
      case "disconnected":
        return <EyeOff size={16} />;
      case "syncing":
        return <RefreshCw size={16} className="animate-spin" />;
      default:
        return <Database size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ChartContainer
        title="Data Source Management"
        subtitle="Configure and monitor your data connections"
        delay={0.1}
      >
        {/* Tab Selection */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {availableSheets.map((sheetName) => (
            <button
              key={sheetName}
              onClick={() => setSelectedTab(sheetName)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === sheetName
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={handleAddNewSheet}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Upload size={16} />
            Add New Sheet
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh All
          </button>
        </div>

        {/* Data Source Configurations */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Data Source Configurations
          </h3>

          {configs.map((config) => (
            <div
              key={config.id}
              className={`border rounded-lg p-4 transition-all ${
                selectedConfig === config.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${getStatusColor(config.status)}`}
                  >
                    {getStatusIcon(config.status)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {config.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {config.type === "google-sheets"
                        ? "Google Sheets Integration"
                        : "API Connection"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedConfig(config.id)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedConfig === config.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Select
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  <p
                    className={`font-medium ${getStatusColor(config.status)} inline-flex items-center gap-2 px-2 py-1 rounded`}
                  >
                    {getStatusIcon(config.status)}
                    {config.status.charAt(0).toUpperCase() +
                      config.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Last Sync</p>
                  <p className="font-medium text-gray-900">{config.lastSync}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 mb-1">URL</p>
                  <p className="font-mono text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                    {config.url}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleTestConnection(config.id)}
                  disabled={config.status === "syncing"}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Settings size={14} />
                  Test Connection
                </button>
                <button
                  onClick={() => handleSync(config.id)}
                  disabled={isSyncing || config.status === "syncing"}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={isSyncing ? "animate-spin" : ""}
                  />
                  Sync Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Data Table */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Data Table - {selectedTab}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              <span>Loading data...</span>
            </div>
          ) : currentData.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {Object.keys(currentData[0]).map((header, index) => (
                      <th
                        key={index}
                        className="px-4 py-3 text-left font-medium text-gray-900 border-r border-gray-200 last:border-r-0"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {Object.values(row).map((value, colIndex) => (
                        <td
                          key={colIndex}
                          className="px-4 py-3 text-gray-600 border-r border-gray-200 last:border-r-0"
                        >
                          {value?.toString() || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* API Key Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            API Configuration
          </h3>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="font-medium text-gray-900">API Key</span>
              </div>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>

            {showApiKey && (
              <div className="mt-3">
                <input
                  type="text"
                  value="sk-1234567890abcdef1234567890abcdef"
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </ChartContainer>
    </div>
  );
}
