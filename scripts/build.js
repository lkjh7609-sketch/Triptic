import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public'); // Vite publicDir → dist/에 그대로 복사된다

// 루트의 정적 자산이 원본이다. Vite는 publicDir만 dist/로 복사하므로 매 dev/build 전에
// public/으로 동기화한다(privacy.html/terms.html은 rollupOptions.input에 없어 이 경로로만
// dist/에 들어간다).
//
// ⚠️ Capacitor(네이티브 앱)는 capacitor.config.json의 webDir("dist")을 읽는다 — 즉
// `vite build` 산출물이다. 루트 index.html은 Vite 번들링 전 원본(/src/app/main.tsx를
// 가리킴)이라 그대로 복사하면 네이티브 앱이 빈 화면이 된다. 네이티브 반영은
// `npm run cap:sync`(build → cap sync)로만 한다.
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

const STATIC_ASSETS = ['manifest.json', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png', 'privacy.html', 'terms.html'];

console.log('📦 Syncing Triptic static assets → public/ ...');

STATIC_ASSETS.forEach(file => {
    const src = path.join(rootDir, file);
    if (!fs.existsSync(src)) {
        console.warn(`  ⚠️ File not found: ${file}`);
        return;
    }

    if (file === 'sw.js') {
        // CACHE_NAME을 사람이 수동으로 올리는 걸 깜빡하면(실제로 이번 세션에 여러 번
        // 그랬다) 배포마다 새로 생기는 해시된 청크가 이전 배포분과 함께 캐시에 영원히
        // 쌓인다 — 매 빌드마다 이름 자체를 자동으로 새로 만들어 그 문제를 원천 차단한다.
        const buildId = `triptic-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const content = fs.readFileSync(src, 'utf8').replace('__BUILD_ID__', buildId);
        fs.writeFileSync(path.join(publicDir, file), content);
        console.log(`  ✓ Synced ${file} → public/ (CACHE_NAME=${buildId})`);
        return;
    }

    fs.copyFileSync(src, path.join(publicDir, file));
    console.log(`  ✓ Synced ${file} → public/`);
});

console.log('✅ Static assets synced!\n');
