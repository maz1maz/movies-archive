import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

// ریشه پروژه همون پوشه اصلیه؛ خروجی ساخته‌شده در dist ذخیره می‌شه
export default defineConfig({
  plugins: [react(), glsl()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true, // allow Cloudflare preview / tunnel hosts during dev
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    },
    // هنگام توسعه، درخواست‌های /api به سرور اکسپرس هدایت می‌شن
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
