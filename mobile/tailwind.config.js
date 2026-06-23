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
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#042f2e",
        },
        surface: "#eef2f3",
        ink: "#0f172a",
        muted: "#64748b",
        line: "#dbe4ea",
      },
      boxShadow: {
        soft: "0 10px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
