import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.resolve(rootDir, 'www');       // Capacitor 네이티브 앱이 그대로 읽는 정적 사본
const publicDir = path.resolve(rootDir, 'public'); // Vite의 publicDir (dist/ 빌드 시 정적 자산만 필요)

[wwwDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// index.html은 Vite가 직접 번들링해 dist/index.html을 생성하므로 publicDir(public/)에는
// 복사하지 않는다 — 원본을 그대로 복사하면 빌드된 산출물과 내용이 어긋나기 쉽다.
// www/(Capacitor)는 Vite 빌드를 거치지 않고 원본을 그대로 사용하므로 복사가 필요하다.
//
// ⚠️ Triptic 3.0 Strangler 전환(ADR-001): 루트 index.html은 이제 새 React 앱의
// 진입점(<script type="module" src="/src/app/main.tsx">)이라 Vite 번들링 없이는
// 실행되지 않는다. Capacitor(www/)는 정적 파일을 그대로 실행하므로, 패리티
// 체크리스트(DEVELOPMENT_PLAN.md §10.3) 통과 전까지는 legacy/index.html(기존
// vanilla 앱, 번들링 불필요)을 계속 www/index.html로 미러링한다.
const STATIC_ASSETS = ['manifest.json', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png'];

console.log('📦 Syncing Triptic web assets for Capacitor (www/) & Vite (public/)...');

STATIC_ASSETS.forEach(file => {
    const src = path.join(rootDir, file);
    if (!fs.existsSync(src)) {
        console.warn(`  ⚠️ File not found: ${file}`);
        return;
    }
    [wwwDir, publicDir].forEach(dir => fs.copyFileSync(src, path.join(dir, file)));
    console.log(`  ✓ Synced ${file} → www/, public/`);
});

const indexSrc = path.join(rootDir, 'legacy', 'index.html');
if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, path.join(wwwDir, 'index.html'));
    console.log('  ✓ Synced legacy/index.html → www/index.html (Capacitor, Phase 2 패리티 통과 전까지 유지)');
} else {
    console.warn('  ⚠️ File not found: legacy/index.html');
}

console.log('✅ Web assets successfully synced!\n');
