/// <reference types="vitest/config" />
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

/** 知识库：默认直连 :8090（StripPrefix 在 rewrite 里做）；设 VITE_KB_PROXY_GATEWAY=true 走网关 :21000 */
const knowledgeDirectTarget = 'http://127.0.0.1:8090'
const knowledgeGatewayTarget = 'http://127.0.0.1:21000'
const knowledgeTarget = process.env.VITE_KB_PROXY_GATEWAY === 'true' ? knowledgeGatewayTarget : knowledgeDirectTarget
const aiopsTarget = process.env.VITE_AIOPS_PROXY_TARGET ?? 'http://127.0.0.1:8099'

function apiProxy() {
  return {
    target: backendTarget,
    changeOrigin: true,
    bypass: spaBypass,
  } as const
}

function knowledgeProxy() {
  const useGateway = knowledgeTarget === knowledgeGatewayTarget
  return {
    target: knowledgeTarget,
    changeOrigin: true,
    ...(useGateway ? {} : { rewrite: (path: string) => path.replace(/^\/KnowledgeServer/, '') }),
    bypass: spaBypass,
  } as const
}

function aiopsProxy() {
  return {
    target: aiopsTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/AiOpsServer/, ''),
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
  },
  server: {
    /** 同时支持 localhost 与 127.0.0.1；避免仅绑定 127.0.0.1 时部分环境无法访问 */
    host: true,
    /** Windows Hyper-V/WSL 常保留 5162–5261，5173 会 EACCES；5141 在保留段外 */
    port: 5141,
    /** 端口被占用时直接报错，避免静默切到其它端口导致书签/代理仍指向旧端口 */
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
      '/config': apiProxy(),
      '/notice': apiProxy(),
      '/log': apiProxy(),
      '/operation': apiProxy(),
      '/cockpit': apiProxy(),
      '/bi': apiProxy(),
      '/persona': apiProxy(),
      '/KnowledgeServer': knowledgeProxy(),
      '/AiOpsServer': aiopsProxy(),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/codemirror/')) {
            return 'codemirror'
          }
        },
      },
    },
  },
}))
