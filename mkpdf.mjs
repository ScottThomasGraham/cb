import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file:///Users/scottgraham/Projects/Think-PLC/reports/gpu-plan.html', { waitUntil: 'networkidle' });
await p.pdf({
  path: '/Users/scottgraham/Projects/Think-PLC/reports/Think-PLC-GPU-Plan-2026-06-12.pdf',
  format: 'Letter', printBackground: true,
  margin: { top: '0.45in', bottom: '0.45in', left: '0.5in', right: '0.5in' }
});
await b.close();
console.log('PDF written');
