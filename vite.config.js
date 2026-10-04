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
        // 첫 화면에 꼭 필요한 파일을 HTML 단계에서 미리 받게 한다. 원래는 메인 JS가 내려받혀 실행된 뒤에야 찾기 시작해서
        // 느린 회선에서 그만큼 직렬로 기다렸다(메인 JS → 번역 파일·홈 청크·홈 CSS → 화면).
        // ① 홈(/)이면 HomeScreen 청크 + 그 청크가 가져오는 공용 청크(chunk.imports — 진입 청크만 받으면 대기 사슬이 남는다)
        //    + 그 청크들의 CSS(rel=preload — 화면을 막지 않고 받아만 둔다, Vite가 나중에 붙일 때 바로 쓴다). 다른 주소에서는 받지 않는다.
        // ② 모든 주소: 표시 언어의 번역 파일 7개(+ 폴백 언어 ko — i18next가 같이 받는다). 언어는 i18n과 같은 순서로 고른다
        //    (저장된 값 → 브라우저 언어, src/shared/i18n/index.ts normalizeLocale). 틀리게 고르면 몇 KB를 더 받을 뿐이다.
        name: 'preload-first-screen',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html, ctx) {
            const bundle = ctx.bundle;
            if (!bundle) return html;
            const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
            const entry = chunks.find((c) => c.isEntry);
            const tags = [];

            const home = chunks.find((c) => c.isDynamicEntry && /features\/home\/HomeScreen\.tsx$/.test(c.facadeModuleId ?? ''));
            if (home) {
              const seen = new Set();
              const files = [];
              const css = new Set();
              const visit = (name) => {
                if (seen.has(name) || name === entry?.fileName) return;
                seen.add(name);
                const c = bundle[name];
                if (!c || c.type !== 'chunk') return;
                c.imports.forEach(visit);
                files.push(c.fileName);
                c.viteMetadata?.importedCss?.forEach((f) => css.add(f));
              };
              visit(home.fileName);
              const js = JSON.stringify(files.map((f) => `/${f}`));
              const styles = JSON.stringify([...css].map((f) => `/${f}`));
              tags.push(
                `<script>if(location.pathname==='/'){${js}.forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.href=h;document.head.appendChild(l)});${styles}.forEach(function(h){var l=document.createElement('link');l.rel='preload';l.as='style';l.href=h;document.head.appendChild(l)})}</script>`,
              );
            }

            // ③ PC 홈의 히어로 사진(LCP) — 원래는 JS가 화면을 그린 뒤에야 요청이 시작돼 사진 요청까지 1.2초를 기다렸다(Lighthouse 2026-10-04).
            //    HTML 단계에서 받게 한다. 홈(/)이고 PC 폭(1024px 이상, HeroDesktop과 같은 기준)일 때만 — 모바일·다른 주소에서는 받지 않는다.
            const hero = Object.values(bundle).find((a) => a.type === 'asset' && /^assets\/hero-[^/]+\.webp$/.test(a.fileName));
            if (hero) {
              tags.push(
                `<script>if(location.pathname==='/'&&matchMedia('(min-width:1024px)').matches){var l=document.createElement('link');l.rel='preload';l.as='image';l.href='/${hero.fileName}';l.setAttribute('fetchpriority','high');document.head.appendChild(l)}</script>`,
              );
            }

            const locales = {};
            for (const c of chunks) {
              // 사용 가이드(guide) 문구는 그 화면에서만 필요해 첫 화면 미리 받기에서 뺀다
              const m = /\/locales\/([^/]+)\/(?!guide\.json)[^/]+\.json$/.exec(c.facadeModuleId ?? '');
              if (m) (locales[m[1]] ??= []).push(`/${c.fileName}`);
            }
            if (Object.keys(locales).length) {
              tags.push(
                `<script>(function(){var m=${JSON.stringify(locales)},l=null;try{l=localStorage.getItem('triptic-locale')}catch(e){}` +
                  `l=l||(navigator.languages&&navigator.languages[0])||navigator.language||'ko';var x=l.toLowerCase(),b=x.split(/[-_]/)[0];` +
                  `var k=m[l]?l:x.indexOf('zh')===0?'zh-TW':m[b]?b:'ko';var f=(m[k]||[]).concat(k==='ko'?[]:m.ko||[]);` +
                  `f.forEach(function(h){var e=document.createElement('link');e.rel='modulepreload';e.href=h;document.head.appendChild(e)})})()</script>`,
              );
            }
            return tags.length ? html.replace('</head>', `${tags.join('\n')}\n</head>`) : html;
          },
        },
      },
      {
        // 첫 화면 데이터(홈: 항공 특가·접속 국가, 공항: 인천공항 전광판)를 JS보다 먼저 요청한다 — 자세한 설명은 src/shared/api/prefetch.ts.
        // 키(요청 주소)는 화면 코드가 만드는 주소와 같아야 쓰인다(어긋나면 그냥 안 쓰고 새로 받는다).
        // 웹(http/https)에서만 — 네이티브 앱(capacitor://)은 /api가 상대 주소로 안 통한다.
        name: 'prefetch-home-data',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            const supa = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
            const key = env.VITE_SUPABASE_ANON_KEY ?? '';
            const api = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
            // geo는 언어를 정한 적 없는 첫 방문에서만(n:1) — i18n이 접속 국가로 첫 언어를 정하는 요청(src/shared/i18n/geoLocale.ts)을 앞당겨,
            // 영어로 먼저 그렸다가 한국어로 바뀌는 순간을 줄인다
            // p: 이 경로에서만 시작한다 — 홈(/)은 특가·접속 국가, 공항(/airports)은 인천공항 전광판·주차장
            const reqs = [
              [`${api}/api/partnerProducts?provider=myrealtrip&kind=deals&origin=ICN&period=5`, { url: `${api}/api/partnerProducts?provider=myrealtrip&kind=deals&origin=ICN&period=5`, path: '/' }],
              [`${api}/api/geo`, { url: `${api}/api/geo`, init: { cache: 'no-store' }, first: true, path: '/' }],
            ];
            if (supa && key) {
              reqs.push([
                'incheon-board',
                {
                  url: `${supa}/functions/v1/incheon-board`,
                  init: { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: '{}' },
                  path: '/airports',
                },
              ]);
              reqs.push([
                'airport-parking',
                {
                  url: `${supa}/functions/v1/airport-parking`,
                  init: { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: '{}' },
                  path: '/airports',
                },
              ]);
            }
            const list = JSON.stringify(reqs.map(([k, v]) => ({ k, u: v.url, i: v.init, n: v.first ? 1 : 0, p: v.path })));
            const script =
              `<script>(function(){if(location.protocol.indexOf('http')!==0)return;var p=window.__prefetch={};` +
              `${list}.forEach(function(r){try{if(r.p!==location.pathname||(r.n&&localStorage.getItem('triptic-locale')))return;var q=fetch(r.u,r.i).then(function(x){if(!x.ok)throw 0;return x.json()});q.catch(function(){});p[r.k]=q}catch(e){}})})()</script>`;
            return html.replace('</head>', `${script}\n</head>`);
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
