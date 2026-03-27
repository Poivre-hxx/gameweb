import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // 生产环境构建优化
  build: {
    // 输出目录
    outDir: 'dist',
    // 生成源码映射（可选，生产环境建议关闭）
    sourcemap: false,
    // 代码分割
    rollupOptions: {
      output: {
        // 手动分割代码块
        manualChunks: {
          // 将 React 相关库打包到一起
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 将 Phaser 游戏引擎单独打包
          'phaser': ['phaser'],
          // 将 AI SDK 单独打包
          'ai-vendor': ['@anthropic-ai/sdk', 'openai'],
        },
      },
    },
    // 压缩选项 - 使用 esbuild (Vite 7.x 默认)
    minify: 'esbuild',
    // 块大小警告限制（KB）
    chunkSizeWarningLimit: 1000,
  },

  // 服务器配置
  server: {
    port: 5173,
    host: true,
  },

  // 预览服务器配置
  preview: {
    port: 4173,
    host: true,
  },
})
