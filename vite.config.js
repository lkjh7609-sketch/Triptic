import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: '.',
    publicDir: 'public',

    plugins: [
      // 새 React 앱(index.html → src/app/main.tsx)의 JSX/Fast Refresh 변환.
      // legacy/index.html은 순수 vanilla 번들이라 이 플러그인의 영향을 받지 않는다.
      react(),
      {
        // 로컬 개발 서버에서 프로덕션 api/*.js 서버리스 함수와 동일한 동작을 흉내낸다.
        // AVIATIONSTACK_API_KEY는 절대 브라우저로 내려보내지 않고(H-4/H-2 수정),
        // /api/flight를 통해서만 서버 쪽에서 사용한다.
        name: 'api-dev-server',
        configureServer(server) {
          server.middlewares.use('/api/env', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
              SUPABASE_URL: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
              SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
              GEMINI_API_KEY_EXISTS: !!(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)
            }));
          });

          server.middlewares.use('/api/flight', async (req, res) => {
            const apiKey = env.AVIATIONSTACK_API_KEY || process.env.AVIATIONSTACK_API_KEY || '';
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (!apiKey) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: '항공편 조회 서비스가 설정되지 않았습니다.' }));
              return;
            }
            const url = new URL(req.url, 'http://localhost');
            const type = url.searchParams.get('type');
            try {
              let upstreamUrl;
              if (type === 'airport') {
                const iata = url.searchParams.get('iata') || '';
                upstreamUrl = `https://api.aviationstack.com/v1/airports?access_key=${apiKey}&iata_code=${encodeURIComponent(iata)}`;
              } else if (type === 'flight') {
                const flightNo = url.searchParams.get('flightNo') || '';
                const date = url.searchParams.get('date') || '';
                upstreamUrl = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(flightNo)}&flight_date=${encodeURIComponent(date)}`;
              } else {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'type 파라미터는 airport 또는 flight 여야 합니다.' }));
                return;
              }
              const upstream = await fetch(upstreamUrl);
              const data = await upstream.text();
              res.statusCode = upstream.status;
              res.end(data);
            } catch (e) {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: String(e) }));
            }
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
      // Strangler 전환(ADR-001): 새 React 셸(index.html)과 기존 vanilla 앱
      // (legacy/index.html)을 한 빌드에서 각각 dist/index.html, dist/legacy/index.html로
      // 산출한다. 기존 앱은 Phase 2 패리티 체크리스트 통과 전까지 배포 경로를 바꾸지 않는다.
      input: {
        main: resolve(__dirname, 'index.html'),
        legacy: resolve(__dirname, 'legacy/index.html')
      },
      output: {
        manualChunks: {
          // 유틸리티 분리 (legacy 앱이 사용)
          'utils': [
            './src/utils/dateUtils.js',
            './src/utils/timeUtils.js',
            './src/utils/escapeHtml.js',
            './src/utils/id.js'
          ],
          // 서비스 분리 (legacy 앱이 사용 — 새 앱은 src/shared/api/*.ts를 별도로 번들한다)
          'services': [
            './src/services/storageService.js',
            './src/services/apiService.js',
            './src/services/supabaseService.js',
            './src/services/supabaseClient.js',
            './src/services/authService.js'
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
      '@/app': resolve(__dirname, './src/app'),
      '@/features': resolve(__dirname, './src/features'),
      '@/shared': resolve(__dirname, './src/shared'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/services': resolve(__dirname, './src/services'),
      '@/state': resolve(__dirname, './src/state')
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
  }
};
});
