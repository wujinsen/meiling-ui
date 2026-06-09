import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // 仅代理 API 请求；GET /login 留给 Vue 登录页，避免与后端 POST /login 冲突
      '/login': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        bypass(req) {
          if (req.method !== 'POST') return '/index.html'
        },
      },
      '/logout': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/captchaImage': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/menu': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/user': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/dept': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/post': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/role': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/dict': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/log': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/operation': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/cockpit': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/bi': { target: 'http://127.0.0.1:8888', changeOrigin: true },
      '/persona': { target: 'http://127.0.0.1:8888', changeOrigin: true },
    },
  },
})
