import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KPICardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ComponentType<any> | React.ForwardRefExoticComponent<any>;
  delay?: number;
  iconSize?: number;
}

export function KPICard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  delay = 0,
  iconSize = 20,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="group relative overflow-visible rounded-2xl bg-white p-6 shadow-md border border-gray-200 hover:border-blue-400/50 transition-colors"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
            {value}
          </h3>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 text-blue-600 group-hover:text-blue-700 group-hover:bg-blue-100 transition-all">
          <Icon size={iconSize} />
        </div>
      </div>

      {trend && (
        <div className="relative z-10 mt-4 flex items-center text-xs font-medium">
          <span
            className={cn(
              "px-2 py-1 rounded-full mr-2",
              trendUp
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700",
            )}
          >
            {trend}
          </span>
          <span className="text-gray-500">vs last month</span>
        </div>
      )}
    </motion.div>
  );
}
