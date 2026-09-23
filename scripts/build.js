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

const STATIC_ASSETS = ['manifest.json', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png', 'privacy.html', 'terms.html'];

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

// index.html → www/ (Capacitor)
const indexSrc = path.join(rootDir, 'index.html');
if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, path.join(wwwDir, 'index.html'));
    console.log('  ✓ Synced index.html → www/ (Capacitor)');
} else {
    console.warn('  ⚠️ File not found: index.html');
}

console.log('✅ Web assets successfully synced!\n');
