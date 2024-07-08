import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [preact(), tailwindcss()],
  base: command === "build" ? "/voice-activated-teleprompter/" : "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
}));
