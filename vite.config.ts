import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import packageJson from './package.json';

const fs = require("fs");
// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_NAME__: JSON.stringify(packageJson.name),
  },
  base: `/${packageJson.name}/`,
  server: {
    host: '0.0.0.0', // 配置IP访问
    port: 5555,
  },
  build: {
    manifest: true
  },
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
