import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/entities.v1.EntityService/Execute': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
        '/api': {
            target: 'http://localhost:8080',
            changeOrigin: true,
        },

    },
  },
})