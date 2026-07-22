import React from "react";
import { Inbox } from "lucide-react";

const EmptyState = ({ icon: Icon = Inbox, message = "No data found", submessage }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-neutral-700 p-4 mb-4">
        <Icon className="h-10 w-10 text-gray-400 dark:text-neutral-500" />
      </div>
      <p className="text-gray-600 dark:text-neutral-300 font-medium">{message}</p>
      {submessage && (
        <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">{submessage}</p>
      )}
    </div>
  );
};

export default EmptyState;
