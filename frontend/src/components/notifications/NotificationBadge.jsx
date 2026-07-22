import React from "react";

const NotificationBadge = ({ count }) => {
  if (!count || count <= 0) return null;

  const display = count > 99 ? "99+" : String(count);

  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center shadow-md">
      {display}
    </span>
  );
};

export default NotificationBadge;

