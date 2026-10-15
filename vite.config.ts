import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/pgh-forms/",
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/pdfjs-dist/")) return "pdf-preview";
          if (id.includes("/pdf-lib/") || id.includes("@pdf-lib/fontkit"))
            return "pdf-generation";
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          )
            return "react";
        },
      },
    },
  },
  server: { host: "127.0.0.1" },
});
