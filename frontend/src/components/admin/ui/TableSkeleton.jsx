import React from "react";

const TableSkeleton = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow border border-gray-200 dark:bg-neutral-800 dark:border-neutral-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-neutral-700">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-t border-gray-100 dark:border-neutral-700"
            >
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <div
                    className="h-4 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse"
                    style={{
                      width: colIdx === 0 ? "80%" : colIdx === cols - 1 ? "60%" : "100%",
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableSkeleton;
