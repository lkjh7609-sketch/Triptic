const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDirs = [
    path.resolve(rootDir, 'www'),
    path.resolve(rootDir, 'public')
];

outDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const filesToCopy = [
    'index.html',
    'manifest.json',
    'sw.js',
    'icon-180.png',
    'icon-192.png',
    'icon-512.png',
    'icon-1024.png'
];

console.log('📦 Building Triptic web assets for Capacitor & Vercel...');

filesToCopy.forEach(file => {
    const src = path.join(rootDir, file);
    if (fs.existsSync(src)) {
        outDirs.forEach(dir => {
            fs.copyFileSync(src, path.join(dir, file));
        });
        console.log(`  ✓ Copied ${file}`);
    } else {
        console.warn(`  ⚠️ File not found: ${file}`);
    }
});

console.log('✅ Web assets successfully built!\n');
