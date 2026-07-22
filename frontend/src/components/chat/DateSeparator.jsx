
import React from "react";
import { motion } from "framer-motion";

export const DateSeparator = ({ label }) => {
  if (!label) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex justify-center my-4"
    >
      <span className="px-3 py-1 text-xs bg-neutral-800 text-neutral-400 rounded-full">
        {label}
      </span>
    </motion.div>
  );
};

export const NewMessagesSeparator = () => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="flex justify-center my-3"
  >
    <span className="px-3 py-1 text-xs bg-blue-500 text-white rounded-full shadow-md">
      New Messages
    </span>
  </motion.div>
);

export default DateSeparator;



