import { chromium } from 'playwright-core';
const [,, htmlPath, pngPath] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1160 }, deviceScaleFactor: 2 });
await p.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await p.screenshot({ path: pngPath, fullPage: true });
await b.close();
console.log('shot:', pngPath);
