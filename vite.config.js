import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: '.',
    publicDir: 'public',

    plugins: [
      {
        name: 'api-env-dev-server',
        configureServer(server) {
          server.middlewares.use('/api/env', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
              SUPABASE_URL: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
              SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
              AVIATIONSTACK_API_KEY: env.AVIATIONSTACK_API_KEY || env.NEXT_PUBLIC_AVIATIONSTACK_API_KEY || process.env.AVIATIONSTACK_API_KEY || '',
              GEMINI_API_KEY_EXISTS: !!(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)
            }));
          });
        }
      }
    ],

    css: {
      postcss: {}
    },

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
};
});
