import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("react-leaflet") ||
            id.includes("leaflet") ||
            id.includes("@react-leaflet")
          ) {
            return "map";
          }
          return undefined;
        },
      },
      onwarn(warning, warn) {
        if (warning.code === "CHUNK_SIZE_LIMIT") return;
        warn(warning);
      },
    },
  },
});
