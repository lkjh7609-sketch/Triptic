import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 프로덕션에서 console.log 제거
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          // 벤더 코드 분리
          'vendor': ['@supabase/supabase-js'],
          // 유틸리티 분리
          'utils': [
            './src/utils/dateUtils.ts',
            './src/utils/timeUtils.ts',
            './src/utils/escapeHtml.ts'
          ],
          // 서비스 분리
          'services': [
            './src/services/storageService.js',
            './src/services/apiService.js',
            './src/services/supabaseService.js'
          ]
        },
        // 청크 파일명 패턴
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // 번들 크기 경고 임계값
    chunkSizeWarningLimit: 500
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/services': resolve(__dirname, './src/services'),
      '@/state': resolve(__dirname, './src/state'),
      '@/types': resolve(__dirname, './src/types')
    }
  },

  server: {
    port: 3000,
    open: true,
    cors: true
  },

  preview: {
    port: 4173,
    open: true
  },

  // PWA 최적화
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  }
});
