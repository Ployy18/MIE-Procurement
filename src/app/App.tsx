import React, { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ProcurementOverview } from "./components/ProcurementOverview";
import { CostInsights } from "./components/CostInsights";
import ForecastPlanning from "./components/ForecastPlanning";
import { DataSource } from "./components/DataSource";
import { DataUpload } from "./components/DataUpload";
import { LoginPage } from "./components/LoginPage";
import { UserManagementPage } from "./components/UserManagementPage";
import { motion, AnimatePresence } from "motion/react";
import authService, { User } from "../services/authService";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authService.isAuthenticated());
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [currentView, setCurrentView] = useState("overview");
  const [filters, setFilters] = useState({
    year: "all",
    project: "all",
    months: [] as string[],
  });

  useEffect(() => {
    // Session restoration and validation
    const validate = async () => {
      const isValid = await authService.validateSession();
      if (!isValid) {
        setIsAuthenticated(false);
        setUser(null);
      }
    };
    validate();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setUser(authService.getCurrentUser());
    setCurrentView("overview");
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const getTitle = () => {
    switch (currentView) {
      case "overview":
        return "Procurement Overview";
      case "insight":
        return "Cost Intelligence";
      case "forecast":
        return "Forecast & Planning";
      case "data-upload":
        return "Data Import & Cleaning";
      case "users":
        return "User Management";
      case "settings":
        return "System Settings";
      case "reports":
        return "Advanced Reports";
      default:
        return "Data Source";
    }
  };

  const handleFilterChange = (newFilters: {
    year: string;
    project: string;
    months?: string[];
  }) => {
    setFilters({
      year: newFilters.year,
      project: newFilters.project,
      months: newFilters.months || [],
    });
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-500/30">
        <Sidebar 
          currentView={currentView} 
          onChangeView={setCurrentView} 
          userRole={user?.role || 'user'}
        />

        <div className="pl-20 flex flex-col min-h-screen">
          <Header
            title={getTitle()}
            onFilterChange={handleFilterChange}
            showFilters={
              currentView !== "forecast" &&
              currentView !== "data-upload" &&
              currentView !== "data-source" &&
              currentView !== "users" &&
              currentView !== "settings" &&
              currentView !== "reports"
            }
            userEmail={user?.email || ""}
            onLogout={handleLogout}
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
                {currentView === "insight" && (
                  <CostInsights filters={filters} />
                )}
                {currentView === "forecast" && <ForecastPlanning />}
                {currentView === "data-source" && (
                  user?.role === 'admin' ? <DataSource /> : <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>
                )}
                {currentView === "data-upload" && (
                  user?.role === 'admin' ? <DataUpload onChangeView={setCurrentView} /> : <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>
                )}
                {currentView === "users" && (
                   user?.role === 'admin' ? (
                      <UserManagementPage />
                   ) : <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>
                )}
                {currentView === "settings" && (
                   user?.role === 'admin' ? (
                     <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                        <p className="text-gray-500 font-medium text-lg">System Settings Module Coming Soon</p>
                     </div>
                   ) : <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>
                )}
                {currentView === "reports" && (
                   <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                      <p className="text-gray-500 font-medium text-lg">Reports Module Coming Soon</p>
                   </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
