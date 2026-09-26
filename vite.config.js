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
