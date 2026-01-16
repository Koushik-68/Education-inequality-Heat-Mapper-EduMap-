import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
  server: {
    proxy: {
      // Proxy backend APIs and data to Express server
      "/api": "http://localhost:5000",
      "/data": "http://localhost:5000",
    },
  },
});
