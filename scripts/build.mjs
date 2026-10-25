import { copyFile, mkdir, access } from 'node:fs/promises';
await mkdir('dist/web', { recursive: true });
const assets = ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
await Promise.all(assets.map(async file => { try { await access(`src/web/${file}`); await copyFile(`src/web/${file}`, `dist/web/${file}`); } catch { /* optional asset not generated yet */ } }));
console.log('Built local server and browser assets.');
