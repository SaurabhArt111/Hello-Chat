import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MessagesPerDayChart = ({ data = [], loading = false }) => {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 h-[280px]">
        <div className="h-4 w-40 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-4" />
        <div className="h-48 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
      </div>
    );
  }

  const chartData = data.length ? data : [
    { label: "Mon", count: 0, date: "" },
    { label: "Tue", count: 0, date: "" },
    { label: "Wed", count: 0, date: "" },
    { label: "Thu", count: 0, date: "" },
    { label: "Fri", count: 0, date: "" },
    { label: "Sat", count: 0, date: "" },
    { label: "Sun", count: 0, date: "" },
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mb-4">
        Messages Per Day (Last 7 Days)
      </h3>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-neutral-600" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-gray-500 dark:text-neutral-400"
            />
            <YAxis
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-gray-500 dark:text-neutral-400"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "8px 12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value) => [value, "Messages"]}
              labelFormatter={(label) => `Day: ${label}`}
            />
            <Bar
              dataKey="count"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              className="dark:opacity-90"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MessagesPerDayChart;
