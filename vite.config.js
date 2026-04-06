import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src",
  publicDir: "../static",
  base: "./",
  server: {
    host: true,
    open: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [react()],
  // Keep app source under src/, but load .env files from the project root.
  envDir: "../",
});
