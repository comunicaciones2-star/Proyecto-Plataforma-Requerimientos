import { defineConfig } from 'vite'
import { glob } from 'glob'
import path from 'path'

export default defineConfig({
  plugins: [],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/pages/index.html'),
        solicitudes: path.resolve(__dirname, 'src/pages/solicitudes.html'),
        admin: path.resolve(__dirname, 'src/pages/admin.html'),
        reportes: path.resolve(__dirname, 'src/pages/reportes.html'),
        login: path.resolve(__dirname, 'src/pages/login.html'),
      },
      output: {
        entryFileNames: 'assets/js/[name].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
  },
})
