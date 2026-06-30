import { chromium } from 'playwright-core';
const [,, htmlPath, pdfPath] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log('PDF written:', pdfPath);
