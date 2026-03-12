import React from "react";
import { motion } from "motion/react";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  headerAction?: React.ReactNode;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  className = "",
  delay = 0,
  headerAction,
}: ChartContainerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className={`relative flex flex-col rounded-2xl bg-white shadow-md border border-gray-200 p-8 ${className}`}
    >
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 tracking-tight">
            {title}
          </h3>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      <div className="w-full">{children}</div>
    </motion.div>
  );
}
