// 레포트북 54~57쪽 HTML → 쪽별 PNG(300dpi) + PDF(B5 182×257mm)
// 쓰는 법: node render.mjs "<took 폴더>"
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 다른 쪽에 쓸 때: node render-png-pdf.mjs "<took 폴더>" --dir=레포트북-64-100쪽 --ids=p64,p65 [--nopdf]
//   (--dir 는 docs 아래 폴더 이름. HTML 은 그 폴더와 같은 이름의 .html)
const tookDir = process.argv[2];
const opt = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const require = createRequire(path.join(tookDir, 'package.json'));
const { chromium } = require('playwright');

const dirName = opt.dir || '레포트북-54-57쪽';
const dir = path.join(tookDir, 'docs', dirName);
const html = path.join(dir, dirName + '.html');
const IDS = opt.ids ? String(opt.ids).split(',') : ['p54', 'p55', 'p56', 'p57'];
const MM = 96 / 25.4;

const browser = await chromium.launch();
// 300dpi = 96dpi × 3.125
const ctx = await browser.newContext({ viewport: { width: Math.ceil(202 * MM), height: Math.ceil(277 * MM) }, deviceScaleFactor: 3.125 });
const page = await ctx.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// 넘침 검사: 쪽 안 내용이 쪽 높이를 넘으면 알려 준다
const report = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p) => {
  const r = p.getBoundingClientRect();
  const mm = (v) => +(v * 25.4 / 96).toFixed(1);
  const cs = getComputedStyle(p);
  const bottomLimit = r.bottom - parseFloat(cs.paddingBottom);
  const base = { id: p.id, scrollOver: p.scrollHeight - p.clientHeight, font: getComputedStyle(p.querySelector('.ko') || p).fontFamily };
  const figsEl = p.querySelector('.figs');
  if (!figsEl) {
    // 그림 칸이 없는 쪽: 글자가 놓인 가장 아래 줄이 아래 여백 선을 넘는지, 표의 줄마다 내용이 칸을 넘는지 본다
    let low = 0; const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); const rg = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.nodeValue.trim()) continue; rg.selectNodeContents(n); for (const b of rg.getClientRects()) low = Math.max(low, b.bottom); }
    const rows = [...p.querySelectorAll('.tr')].map((t) => { const tb = t.getBoundingClientRect(); let cb = 0; for (const c of t.querySelectorAll('.ko, .en, .sub, h2')) cb = Math.max(cb, c.getBoundingClientRect().bottom); return { h: mm(tb.height), free: mm(tb.bottom - cb) }; });
    return { ...base, textBottomOver: mm(low - bottomLimit), rows };
  }
  const figs = figsEl.getBoundingClientRect();
  const lastSec = ([...p.querySelectorAll('.sec, .tb, .two2')].pop() || p).getBoundingClientRect();
  return { ...base, gapSecToFigs: mm(figs.top - lastSec.bottom), figsBottomOver: mm(figs.bottom - bottomLimit) };
}));
console.log(JSON.stringify(report.filter((x) => IDS.includes(x.id)), null, 1));

// 쪽마다 그 쪽만 (0,0)에 놓고 찍어서 네 장의 크기를 똑같이 맞춘다
await page.addStyleTag({ content: 'html,body{background:#fff!important} .page{margin:0!important} .page.off{display:none!important}' });
for (const id of IDS) {
  await page.evaluate((id) => { document.querySelectorAll('.page').forEach((p) => p.classList.toggle('off', p.id !== id)); window.scrollTo(0, 0); }, id);
  await page.locator('#' + id).screenshot({ path: path.join(dir, id.slice(1) + '쪽.png') });
}
await page.evaluate(() => document.querySelectorAll('.page').forEach((p) => p.classList.remove('off')));
if (!opt.nopdf) {
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(dir, dirName + '.pdf'), width: '182mm', height: '257mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
}
await browser.close();
console.log('done');
