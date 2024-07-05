import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
