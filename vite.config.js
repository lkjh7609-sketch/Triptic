import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { existsSync } from 'fs';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: '.',
    publicDir: 'public',

    plugins: [
      react(),
      {
        // 홈(/)으로 들어오면 HomeScreen 청크를 HTML 단계에서 미리 받게 한다. 홈은 lazy 라우트라 원래는 메인 JS가 내려받혀
        // 실행된 뒤에야 청크를 찾기 시작한다(느린 회선에서 그만큼의 직렬 대기). 다른 주소에서는 받지 않는다.
        // 청크가 다시 가져오는 공용 청크(chunk.imports)도 같이 — 진입 청크만 미리 받으면 대기 사슬이 남는다.
        name: 'preload-home-chunk',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html, ctx) {
            const bundle = ctx.bundle;
            if (!bundle) return html;
            const home = Object.values(bundle).find(
              (c) => c.type === 'chunk' && c.isDynamicEntry && /features\/home\/HomeScreen\.tsx$/.test(c.facadeModuleId ?? '')
            );
            if (!home) return html;
            const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry);
            const seen = new Set();
            const files = [];
            const visit = (name) => {
              if (seen.has(name) || name === entry?.fileName) return;
              seen.add(name);
              const c = bundle[name];
              if (!c || c.type !== 'chunk') return;
              c.imports.forEach(visit);
              files.push(c.fileName);
            };
            visit(home.fileName);
            const list = JSON.stringify(files.map((f) => `/${f}`));
            const tag = `<script>if(location.pathname==='/'){${list}.forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.href=h;document.head.appendChild(l)})}</script>`;
            return html.replace('</head>', `${tag}\n</head>`);
          },
        },
      },
      {
        // 로컬 개발 서버에서 api/*.js(Vercel 서버리스 함수)를 그대로 실행하는 어댑터.
        // Vercel 런타임이 주는 req.query/req.body/res.status().json()만 흉내낸다.
        // 키는 .env.local에서 읽는다(VITE_ 접두사 없는 서버 전용 키 포함).
        name: 'api-dev-server',
        configureServer(server) {
          for (const [key, value] of Object.entries(env)) {
            if (!key.startsWith('VITE_') && process.env[key] === undefined) process.env[key] = value;
          }
          server.middlewares.use('/api', async (req, res, next) => {
            const url = new URL(req.url, 'http://localhost');
            const name = url.pathname.replace(/^\/+|\/+$/g, '');
            if (!/^[A-Za-z0-9-]+$/.test(name) || !existsSync(resolve(__dirname, `api/${name}.js`))) return next();
            try {
              const mod = await server.ssrLoadModule(`/api/${name}.js`);
              req.query = Object.fromEntries(url.searchParams);
              if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const raw = Buffer.concat(chunks).toString('utf8');
                try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
              }
              res.status = (code) => { res.statusCode = code; return res; };
              res.json = (body) => {
                if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(body));
                return res;
              };
              await mod.default(req, res);
            } catch (e) {
              server.config.logger.error(`[api-dev-server] /api/${name} failed: ${e instanceof Error ? e.stack : e}`);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'dev_handler_failed' }));
              }
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
          drop_console: true,
          drop_debugger: true
        }
      },
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      chunkSizeWarningLimit: 500
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@/app': resolve(__dirname, './src/app'),
        '@/features': resolve(__dirname, './src/features'),
        '@/shared': resolve(__dirname, './src/shared'),
        '@/types': resolve(__dirname, './src/types'),
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
