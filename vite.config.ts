import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }), tailwindcss()],
  base: command === "build" ? "/teleprompter/" : "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
}));
