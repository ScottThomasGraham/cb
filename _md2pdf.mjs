import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';

const [,, mdPath, pdfPath, titleArg] = process.argv;
const md = await readFile(mdPath, 'utf8');

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, (_,c)=>`<code>${c}</code>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const lines = md.split('\n');
let html = '', i = 0;
const cell = c => `<td>${inline(c.trim())}</td>`;
const hcell = c => `<th>${inline(c.trim())}</th>`;
const splitRow = r => r.replace(/^\||\|$/g,'').split('|');

while (i < lines.length) {
  const ln = lines[i];
  // fenced code
  if (/^```/.test(ln)) {
    let buf = []; i++;
    while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
    i++; html += `<pre><code>${esc(buf.join('\n'))}</code></pre>\n`; continue;
  }
  // table
  if (ln.includes('|') && i+1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i+1]) && lines[i+1].includes('-')) {
    const head = splitRow(ln); i += 2;
    let rows = '';
    while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows += `<tr>${splitRow(lines[i]).map(cell).join('')}</tr>\n`; i++; }
    html += `<table><thead><tr>${head.map(hcell).join('')}</tr></thead><tbody>${rows}</tbody></table>\n`; continue;
  }
  // heading
  let m = ln.match(/^(#{1,6})\s+(.*)$/);
  if (m) { const n = m[1].length; html += `<h${n}>${inline(m[2])}</h${n}>\n`; i++; continue; }
  // hr
  if (/^\s*([-*_])\1\1+\s*$/.test(ln)) { html += '<hr/>\n'; i++; continue; }
  // blockquote
  if (/^>\s?/.test(ln)) { let buf=[]; while (i<lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/,'')); i++; } html += `<blockquote>${inline(buf.join(' '))}</blockquote>\n`; continue; }
  // unordered list
  if (/^\s*[-*]\s+/.test(ln)) { let buf=''; while (i<lines.length && /^\s*[-*]\s+/.test(lines[i])) { buf += `<li>${inline(lines[i].replace(/^\s*[-*]\s+/,''))}</li>\n`; i++; } html += `<ul>${buf}</ul>\n`; continue; }
  // ordered list
  if (/^\s*\d+\.\s+/.test(ln)) { let buf=''; while (i<lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf += `<li>${inline(lines[i].replace(/^\s*\d+\.\s+/,''))}</li>\n`; i++; } html += `<ol>${buf}</ol>\n`; continue; }
  // blank
  if (!ln.trim()) { i++; continue; }
  // paragraph
  let buf=[]; while (i<lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !(lines[i].includes('|') && i+1<lines.length && /-/.test(lines[i+1]||''))) { buf.push(lines[i]); i++; }
  html += `<p>${inline(buf.join(' '))}</p>\n`;
}

const title = titleArg || 'Document';
const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color:#1a2230; font-size:10.5pt; line-height:1.5; }
h1 { color:#0b2545; font-size:21pt; margin:0 0 2pt; border-bottom:3px solid #0b2545; padding-bottom:6pt; }
h2 { color:#0b2545; font-size:14pt; margin:18pt 0 6pt; border-bottom:1px solid #c9d6e5; padding-bottom:3pt; }
h3 { color:#13315c; font-size:11.5pt; margin:13pt 0 4pt; }
p { margin:5pt 0; }
code { font-family:"SF Mono",Menlo,Consolas,monospace; background:#eef2f7; padding:1px 4px; border-radius:3px; font-size:9pt; }
pre { background:#0b2545; color:#e6edf6; padding:10pt 12pt; border-radius:6px; overflow-x:auto; font-size:8.6pt; line-height:1.45; }
pre code { background:none; color:inherit; padding:0; }
table { border-collapse:collapse; width:100%; margin:8pt 0; font-size:9pt; }
th { background:#0b2545; color:#fff; text-align:left; padding:5pt 7pt; }
td { border:1px solid #c9d6e5; padding:4pt 7pt; vertical-align:top; }
tbody tr:nth-child(even) { background:#f3f7fb; }
blockquote { margin:8pt 0; padding:6pt 12pt; background:#fff7e6; border-left:4px solid #e0a800; color:#5c4a00; }
hr { border:none; border-top:1px solid #d4deea; margin:14pt 0; }
a { color:#1d6fb8; text-decoration:none; }
strong { color:#0b2545; }
ul,ol { margin:5pt 0 5pt 0; padding-left:20pt; }
li { margin:2pt 0; }
.footer { margin-top:18pt; padding-top:8pt; border-top:1px solid #d4deea; color:#7a8aa0; font-size:8pt; }
</style></head><body>${html}
<div class="footer">Think-PLC · Prepared by Nyx · Generated ${new Date().toISOString().slice(0,10)} · Confidential — internal engagement document</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(doc, { waitUntil: 'load' });
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
await browser.close();
console.log('PDF written:', pdfPath);
