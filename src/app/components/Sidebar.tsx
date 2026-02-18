import React from "react";
import {
  LayoutDashboard,
  PieChart,
  TrendingUp,
  Database,
  Package,
  Upload,
} from "lucide-react";
import { cn } from "./KPICard";

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

export function Sidebar({ currentView, onChangeView }: SidebarProps) {
  const menuItems = [
    { id: "overview", label: "Procurement Overview", icon: LayoutDashboard },
    { id: "insight", label: "Cost Insights", icon: PieChart },
    { id: "forecast", label: "Forecast & Planning", icon: TrendingUp },
  ];

  const bottomMenuItems = [
    { id: "data-upload", label: "Upload Data", icon: Upload },
    { id: "data-source", label: "Data Source", icon: Database },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-20 hover:w-64 bg-white border-r border-gray-200 flex flex-col z-50 transition-all duration-300 group overflow-hidden">
      {/* Logo Section */}
      <div className="p-6 flex items-center space-x-3 whitespace-nowrap border-b border-gray-100">
        <div className="h-8 w-8 min-w-[2rem] rounded-lg bg-blue-600 flex items-center justify-center text-white">
          <Package size={20} />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          CCTV Procure
        </span>
      </div>

      {/* Main Menu */}
      <div className="flex-1 px-4 py-4 space-y-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          Main Menu
        </div>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={cn(
              "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              currentView === item.id
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
            )}
          >
            <item.icon
              size={20}
              className={cn(
                "min-w-[20px] transition-colors",
                currentView === item.id
                  ? "text-blue-600"
                  : "text-gray-500 group-hover/btn:text-gray-700",
              )}
            />
            <span className="font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              {item.label}
            </span>
            {currentView === item.id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            )}
          </button>
        ))}
      </div>

      {/* Bottom Menu */}
      <div className="px-4 py-4 space-y-2 border-t border-gray-100">
        {bottomMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          >
            <item.icon
              size={20}
              className="min-w-[20px] text-gray-500 group-hover/btn:text-gray-700"
            />
            <span className="font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
