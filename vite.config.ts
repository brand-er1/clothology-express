
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/clothology-express/" : "/",
  server: {
    host: "localhost", // Explicitly set to localhost instead of ::
    port: 8080,
    strictPort: true, // Will not try another port if 8080 is in use
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
