import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4010,
    strictPort: true,
    host: true, // bind 0.0.0.0 so iPhone on same WiFi can reach it
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4011",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:4011",
        changeOrigin: true,
      },
    },
  },
});
