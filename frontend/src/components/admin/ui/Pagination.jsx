import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  showCount = true,
}) => {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      {showCount && (
        <span className="text-gray-600 dark:text-neutral-400">
          Showing {start}–{end} of {total}
        </span>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="px-2 text-gray-600 dark:text-neutral-400">
          Page {page} of {totalPages || 1}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
