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
    port: 5173,
    // هنگام توسعه، درخواست‌های /api به سرور اکسپرس هدایت می‌شن
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
