import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

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
    https: process.env.NODE_ENV === 'development' ? {
      key: fs.readFileSync(path.join(__dirname, '.cert', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '.cert', 'cert.pem')),
      minVersion: 'TLSv1.2',
    } : false,
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
  }
})
