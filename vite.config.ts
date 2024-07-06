import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig(({ command }) => ({
  plugins: [preact()],
  base: command === "build" ? "/<REPO>/" : "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
}));
