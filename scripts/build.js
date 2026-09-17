const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'www');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const filesToCopy = [
    'index.html',
    'manifest.json',
    'sw.js',
    'icon-180.png',
    'icon-192.png',
    'icon-512.png'
];

console.log('📦 Building Triptic web assets for Capacitor...');

filesToCopy.forEach(file => {
    const src = path.join(rootDir, file);
    const dest = path.join(outDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`  ✓ Copied ${file} -> www/${file}`);
    } else {
        console.warn(`  ⚠️ File not found: ${file}`);
    }
});

console.log('✅ Web assets successfully built into www/ directory!\n');
