/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e4f7f4",
          100: "#c8eee8",
          200: "#94ddd2",
          300: "#5fc7ba",
          400: "#2fafa2",
          500: "#0f8f83",
          600: "#08796f",
          700: "#07645c",
          800: "#07514b",
          900: "#063f3a",
        },
        promo: {
          50: "#fff0eb",
          500: "#ff6b4a",
          600: "#f04f2b",
        },
        ai: {
          50: "#f1ebff",
          500: "#6d35f5",
          600: "#5a2bd0",
        },
        surface: "#eef5f4",
        surfaceSoft: "#f7fbfa",
        ink: "#101828",
        muted: "#667085",
        line: "#dbe7e4",
      },
      boxShadow: {
        soft: "0 10px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
