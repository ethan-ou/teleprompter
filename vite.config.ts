import { defineConfig } from "vite";
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [svelte(), tailwindcss()],
  base: command === "build" ? "/teleprompter/" : "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
}));
