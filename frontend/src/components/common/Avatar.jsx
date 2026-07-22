import React from "react";

const Avatar = ({ name, src, size = "md", online }) => {
  const sizeClass =
    size === "lg"
      ? "w-16 h-16"
      : size === "md"
      ? "w-10 h-10"
      : "w-8 h-8";

  return (
    <div className="relative">
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          className={`${sizeClass} rounded-full object-cover ring-2 ring-gray-200 dark:ring-neutral-700 shadow-md`}
        />
      ) : (
        <div
          className={`${sizeClass} bg-emerald-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md ring-2 ring-gray-200 dark:ring-neutral-700`}
        >
          {name?.charAt(0).toUpperCase()}
        </div>
      )}

      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-800 shadow-sm animate-pulse" />
      )}
    </div>
  );
};

export default Avatar;
