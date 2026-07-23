import React, { useEffect } from "react";
import { FiCheck, FiX, FiAlertTriangle, FiInfo } from "react-icons/fi";

const Toast = ({ message, type = "info", onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  }[type];

  const Icon = {
    success: FiCheck,
    error: FiX,
    warning: FiAlertTriangle,
    info: FiInfo,
  }[type];

  return (
    <div
      className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md animate-in slide-in-from-top-5 fade-in duration-300`}
    >
      <Icon size={20} className="shrink-0" />
      <p className="flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-white hover:text-gray-200 transition-colors"
      >
        <FiX size={20} />
      </button>
    </div>
  );
};

export default Toast;
