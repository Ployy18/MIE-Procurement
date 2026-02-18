import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ProcurementOverview } from "./components/ProcurementOverview";
import { CostInsights } from "./components/CostInsights";
import { ForecastPlanning } from "./components/ForecastPlanning";
import { DataSource } from "./components/DataSource";
import { DataUpload } from "./components/DataUpload";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentView, setCurrentView] = useState("overview");
  const [filters, setFilters] = useState({ year: "all", project: "all" });

  const getTitle = () => {
    switch (currentView) {
      case "overview":
        return "Procurement Overview";
      case "insight":
        return "Supplier & Cost Intelligence";
      case "forecast":
        return "Forecast & Planning";
      case "data-upload":
        return "Data Import & Cleaning";
      default:
        return "Data Source";
    }
  };

  const handleFilterChange = (newFilters: {
    year: string;
    project: string;
  }) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-500/30">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />

      <div className="pl-20 flex flex-col min-h-screen">
        <Header
          title={getTitle()}
          onFilterChange={handleFilterChange}
          showFilters={currentView !== "forecast"}
        />

        <main className="flex-1 p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {currentView === "overview" && (
                <ProcurementOverview filters={filters} />
              )}
              {currentView === "insight" && <CostInsights />}
              {currentView === "forecast" && <ForecastPlanning />}
              {currentView === "data-source" && <DataSource />}
              {currentView === "data-upload" && <DataUpload />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
