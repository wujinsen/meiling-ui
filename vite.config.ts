import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage } from 'node:http'

/** 浏览器地址栏导航走 Vue Router；XHR/fetch 仍转发后端 */
function spaBypass(req: IncomingMessage) {
  const accept = req.headers.accept ?? ''
  if (req.method === 'GET' && accept.includes('text/html')) {
    return '/index.html'
  }
}

const backendTarget = 'http://127.0.0.1:8888'
// const backendTarget = 'http://localhost:21000/UserCenter'

function apiProxy() {
  return {
    target: backendTarget,
    changeOrigin: true,
    bypass: spaBypass,
  } as const
}

export default defineConfig(({ command }) => ({
  // GitHub Pages 构建时通过 VITE_BASE 注入；本地 dev 始终用根路径
  base: command === 'build' && process.env.VITE_BASE ? process.env.VITE_BASE : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    /** 同时支持 localhost 与 127.0.0.1；避免仅绑定 127.0.0.1 时部分环境无法访问 */
    host: true,
    port: 5173,
    /** 端口被占用时直接报错，避免静默切到 5174/5175 导致仍访问 5173 失败 */
    strictPort: true,
    proxy: {
      '^/login$': apiProxy(),
      '^/logout$': apiProxy(),
      '/captchaImage': apiProxy(),
      '/menu': apiProxy(),
      '/user': apiProxy(),
      '/system': apiProxy(),
      '/sso': apiProxy(),
      '/dept': apiProxy(),
      '/post': apiProxy(),
      '/role': apiProxy(),
      '/action': apiProxy(),
      '/auth': apiProxy(),
      '/dict': apiProxy(),
      '/log': apiProxy(),
      '/operation': apiProxy(),
      '/cockpit': apiProxy(),
      '/bi': apiProxy(),
      '/persona': apiProxy(),
    },
  },
}))
