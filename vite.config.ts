import path from "path"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Typings are now natively active through the bundler engine
const host = process.env.TAURI_DEV_HOST

// Read version from package.json
import packageJson from "./package.json"

// https://vite.dev
export default defineConfig(async () => ({
  plugins: [react()],

  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version)
  },

  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        takeoff: path.resolve(__dirname, "src/windows/takeoff/takeoff.html"),
        settings: path.resolve(__dirname, "src/windows/settings/settings.html"),
        landing: path.resolve(__dirname, "src/windows/landing/landing.html")
      }
    }
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
}))
