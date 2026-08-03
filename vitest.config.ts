import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    // 测试环境
    environment: 'happy-dom',

    // 全局测试设置
    globals: true,

    // 测试设置文件
    setupFiles: ['./src/test/setup.ts'],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'out/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/types/**',
        'src/renderer/src/main.tsx'
      ]
    },

    // 测试匹配模式
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],

    // 排除模式
    exclude: ['node_modules', 'out', 'dist'],

    // 并发测试
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
