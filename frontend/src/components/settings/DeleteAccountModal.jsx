import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAccount as deleteAccountApi } from "../../api/user";
import { useToastContext } from "../../context/ToastContext";

const DeleteAccountModal = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToastContext();

  if (!isOpen) return null;

  const handleDelete = async () => {
    setError("");

    if (confirmText !== "DELETE") {
      setError('Please type "DELETE" to confirm.');
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);
      await deleteAccountApi(password);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      toast.success("Account deleted");

      setLoading(false);
      onClose?.();
      navigate("/");
    } catch (err) {
      setLoading(false);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to delete account. Please try again.";
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
          Permanently delete account
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
          This action is <span className="font-semibold">permanent</span>. Your account will be deleted and you will be logged out.
          Your past messages will remain in other users&apos; chats but will appear as{" "}
          <span className="font-semibold">&quot;Deleted User&quot;</span>.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300">
              Confirm text
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300">
              Current password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-100">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;

