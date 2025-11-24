import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 关键修改：使用相对路径，这样应用可以部署在任何子路径下（如 GitHub Pages）而不会白屏
  base: './',
})