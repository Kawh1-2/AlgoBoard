import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 端口固定，且禁止自动漂移。
// 原因：IndexedDB 按 origin（协议+主机+端口）隔离，换端口等于换仓库，
// 旧画板会读不到。宁可启动失败报错，也不能静默 +1。
const PORT = 1001

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    strictPort: true,
  },
  preview: {
    port: PORT,
    strictPort: true,
  },
})
