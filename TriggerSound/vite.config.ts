import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, URL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 開発環境でHTTPS設定を取得
const getHttpsConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    const keyPath = path.join(__dirname, '.cert', 'key.pem')
    const certPath = path.join(__dirname, '.cert', 'cert.pem')
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        minVersion: 'TLSv1.2' as const,
      }
    }
  }
  return undefined
}

// https://vitejs.dev/config/
export default defineConfig({
  root: process.cwd(),  // 実行コンテキストを明示的に指定
  plugins: [react()],
  base: '/',  // ベースパスを明示的に指定
  publicDir: 'public',  // 静的ファイルのディレクトリを指定
  server: {
    host: '0.0.0.0',  // すべてのネットワークインターフェースでリッスン
    port: 5173,       // ポートを固定
    strictPort: true, // 指定したポートが使用中の場合はエラーを出す
    https: getHttpsConfig(),
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
    watch: {
      ignored: ['!**/node_modules/**']  // node_modulesの監視を除外
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')  // ソースディレクトリのエイリアス
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
