// NOTE: not currently referenced by Vite/Tailwind config (Tailwind v4 config
// lives in CSS via @import "tailwindcss" + @theme). Kept for reference only.
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,css}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
