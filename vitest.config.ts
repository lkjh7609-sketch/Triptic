import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/app': resolve(__dirname, './src/app'),
      '@/features': resolve(__dirname, './src/features'),
      '@/shared': resolve(__dirname, './src/shared'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/services': resolve(__dirname, './src/services'),
      '@/state': resolve(__dirname, './src/state'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts,tsx}'],
      exclude: [
        'src/main.js',
        'src/app/main.tsx',
        'src/**/*.test.{js,ts,tsx}',
        'src/**/*.d.ts',
      ],
      thresholds: {
        // 전체 기준. 도메인 로직(src/features/**/lib, src/shared/utils)은
        // Phase 2 이후 코드가 늘어나면 85%로 별도 강화한다 (DEVELOPMENT_PLAN.md §10.1)
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
