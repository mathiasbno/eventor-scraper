import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default {
  root: "src/",
  publicDir: "../static/",
  base: "./",
  server: {
    host: true,
    open: true,
  },
  build: {
    outDir: "../public",
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [
    nodePolyfills(),
    react({
      babel: {
        plugins: [["module:@preact/signals-react-transform"]],
      },
    }),
  ],
};
