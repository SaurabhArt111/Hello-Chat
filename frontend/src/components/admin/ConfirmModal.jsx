import React from "react";

const ConfirmModal = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  destructive = true,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

