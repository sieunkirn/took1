// 레포트북 54~57쪽 HTML 을 Noto Sans KR(피그마와 같은 글꼴)로 다시 앉힌 뒤
// 글자(줄바꿈·위치·색)·사각형·그림·SVG 를 수치로 뽑아 쪽별 JSON 으로 저장한다.
// 쓰는 법: node extract.mjs "<took 폴더>" [추가 CSS 파일]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

// 다른 쪽에 쓸 때: node figma-extract.mjs "<took 폴더>" --dir=레포트북-64-100쪽 --ids=p64 [--css=추가.css] [--out=결과 폴더]
//   (--dir 는 docs 아래 폴더 이름, HTML 은 그 폴더와 같은 이름의 .html. 글자 칸에는 class="t" 를, 레이어 묶음 이름은 data-g="…" 로 준다)
const tookDir = process.argv[2];
const opt = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const extraCssFile = opt.css || (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null);
const here = opt.out || path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(tookDir, 'package.json'));
const { chromium } = require('playwright');

const dirName = opt.dir || '레포트북-54-57쪽';
const html = path.join(tookDir, 'docs', dirName, dirName + '.html');
const IDS = opt.ids ? String(opt.ids).split(',') : ['p54', 'p55', 'p56', 'p57'];
const MM = 96 / 25.4;

let css = `
@font-face { font-family: "Noto Sans KR"; src: url("file:///C:/Windows/Fonts/NotoSansKR-VF.ttf"); font-weight: 100 900; }
.head .no, .stats b { font-weight: 700 !important; }   /* 피그마 Noto Sans KR 에는 ExtraBold 가 없다 */
.kinds svg { height: 20.52mm !important; }              /* viewBox 비율과 똑같이 */
html, body { background: #fff !important; }
.page { margin: 0 !important; }
.page.off { display: none !important; }
`;
if (extraCssFile) css += fs.readFileSync(extraCssFile, 'utf8');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 700, height: 980 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: css });
await page.evaluate(async () => { await document.fonts.load('400 10px "Noto Sans KR"', '가나다abc'); await document.fonts.load('700 10px "Noto Sans KR"', '가나다abc'); await document.fonts.load('500 10px "Noto Sans KR"', '가나다abc'); await document.fonts.ready; });

const fontOk = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '100px "Noto Sans KR"'; const a = c.measureText('가나다라 Question').width;
  c.font = '100px "Malgun Gothic"'; const b = c.measureText('가나다라 Question').width;
  return { noto: a, malgun: b, loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight) };
});
console.log('font', JSON.stringify(fontOk));

for (const id of IDS) {
  await page.evaluate((id) => { document.querySelectorAll('.page').forEach((p) => p.classList.toggle('off', p.id !== id)); window.scrollTo(0, 0); }, id);
  const data = await page.evaluate((id) => {
    const P = document.getElementById(id);
    const O = P.getBoundingClientRect();
    const r2 = (v) => Math.round(v * 100) / 100;
    const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { c: [p[0], p[1], p[2]].map((v) => Math.round(v)), a: p.length > 3 ? p[3] : 1 }; };
    const items = [];
    const groupOf = (el) => {
      const dg = el.closest('[data-g]');
      if (dg) return dg.dataset.g;
      const sec = el.closest('.sec');
      if (sec) { const no = sec.querySelector('.no'), h = sec.querySelector('h2'); return '꼭지 ' + (no ? no.textContent.trim() + ' ' : '') + (h ? h.textContent.trim() : ''); }
      const fig = el.closest('figure');
      if (fig) { const all = [...P.querySelectorAll('figure')]; const cap = fig.querySelector('figcaption b'); return (cap ? cap.textContent.trim() : '그림') + (all.length > 1 ? '' : ''); }
      if (el.closest('.bar')) return '위 색 띠';
      return '그림 칸';
    };

    // ---------- 사각형(바탕·테두리)·그림 ----------
    const walker = document.createTreeWalker(P, NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.closest('svg') && n.tagName.toLowerCase() !== 'svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let el = walker.nextNode(); el; el = walker.nextNode()) {
      const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const x = r2(b.left - O.left), y = r2(b.top - O.top), w = r2(b.width), h = r2(b.height);
      const g = groupOf(el);
      if (el.tagName === 'IMG') {
        const bw = parseFloat(cs.borderTopWidth) || 0;
        items.push({ t: 'img', g, src: el.getAttribute('src'), x, y, w, h, rad: cs.borderRadius.includes('%') ? Math.min(w, h) / 2 : parseFloat(cs.borderRadius) || 0, bw: r2(bw), bc: bw ? rgb(cs.borderTopColor).c : null });
        continue;
      }
      const bg = rgb(cs.backgroundColor);
      const bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0, bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0;
      const all4 = bt > 0 && bb > 0 && bl > 0 && br > 0;
      const rad = parseFloat(cs.borderRadius) || 0;
      const rr = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => parseFloat(v) || 0); const rads = rr.some((v) => v !== rr[0]) ? rr : null;
      if (bg && bg.a > 0 || all4) {
        items.push({ t: 'rect', g, n: el.className && typeof el.className === 'string' ? el.className : el.tagName.toLowerCase(), x, y, w, h, rad, rads, fill: bg && bg.a > 0 ? bg.c : null, sw: all4 ? r2(bt) : 0, sc: all4 ? rgb(cs.borderTopColor).c : null, dash: all4 && cs.borderTopStyle === 'dashed' });
      }
      if (!all4) {
        if (bt > 0) items.push({ t: 'rect', g, n: '선', x, y, w, h: r2(bt), fill: rgb(cs.borderTopColor).c });
        if (bb > 0) items.push({ t: 'rect', g, n: '선', x, y: r2(y + h - bb), w, h: r2(bb), fill: rgb(cs.borderBottomColor).c });
        if (bl > 0) items.push({ t: 'rect', g, n: '세로 띠', x, y, w: r2(bl), h, fill: rgb(cs.borderLeftColor).c });
      }
    }

    // ---------- SVG (글자는 따로 뽑는다) ----------
    const PRES = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-opacity', 'stroke-opacity'];
    for (const svg of P.querySelectorAll('svg')) {
      const b = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal;
      const clone = svg.cloneNode(true);
      const src = [...svg.querySelectorAll('*')], dst = [...clone.querySelectorAll('*')];
      src.forEach((s, i) => {
        const d = dst[i]; const tag = s.tagName.toLowerCase();
        if (tag === 'text') return;
        if (['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(tag)) {
          const cs = getComputedStyle(s);
          for (const p of PRES) { let v = cs.getPropertyValue(p); if (p === 'stroke-dasharray' && v === 'none') { d.removeAttribute(p); continue; } if (p === 'stroke-width') v = String(parseFloat(v)); if (p === 'stroke-dasharray') v = v.replace(/px/g, ''); d.setAttribute(p, v.replace(/rgb\((\d+), (\d+), (\d+)\)/, (m, r, g2, bl) => '#' + [r, g2, bl].map((n) => (+n).toString(16).padStart(2, '0')).join(''))); }
        }
        d.removeAttribute('class');
      });
      clone.querySelectorAll('text').forEach((t) => t.remove());
      clone.querySelectorAll('g').forEach((g) => { if (!g.children.length) g.remove(); });
      clone.removeAttribute('class'); clone.removeAttribute('style'); clone.removeAttribute('preserveAspectRatio');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', r2(b.width)); clone.setAttribute('height', r2(b.height)); clone.setAttribute('fill', 'none');
      const sv = clone.outerHTML.replace(/\s+/g, ' ').replace(/> </g, '><');
      const head = svg.closest('.head');
      items.push({ t: 'svg', g: groupOf(svg), n: head ? '아이콘' : (svg.classList.contains('scrn') ? '화면 그림' : '도식'), x: r2(b.left - O.left), y: r2(b.top - O.top), w: r2(b.width), h: r2(b.height), svg: sv });
      const scale = b.width / vb.width;
      for (const t of svg.querySelectorAll('text')) {
        const tb = t.getBoundingClientRect(); const cs = getComputedStyle(t); const fill = rgb(cs.fill);
        const anchor = cs.textAnchor;
        items.push({ t: 'text', g: groupOf(svg), n: t.textContent, s: t.textContent, al: anchor === 'middle' ? 'C' : anchor === 'end' ? 'R' : 'L', L: r2(tb.left - O.left), R: r2(tb.right - O.left), cx: r2((tb.left + tb.right) / 2 - O.left), cy: r2((tb.top + tb.bottom) / 2 - O.top), lh: 0, ind: 0,
          base: { fs: r2(parseFloat(cs.fontSize) * scale), fw: +cs.fontWeight >= 600 ? 700 : +cs.fontWeight >= 500 ? 500 : 400, c: fill.c, it: 0, ff: 'N', ls: 0 }, runs: [] });
      }
    }

    // ---------- 글자 ----------
    const CONT = '.no, h2, .sub, p.ko, p.en, p.eq, .lab, .lab > span, figcaption, figcaption > .en, .n, h3, .note, .stats span, .stats b, .slot b, .slot span, .t, .k, .ke, .num, .ar, .dh, .cn, .cap, .anum, .ct, .cb, .cd, .cx, .ml, .tdate';
    const styleOf = (el) => { const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs; return { fs: r2(fs), fw: +cs.fontWeight >= 600 ? 700 : +cs.fontWeight >= 500 ? 500 : 400, c: rgb(cs.color).c, it: cs.fontStyle === 'italic' ? 1 : 0, ff: /STIX|Cambria|Times/.test(cs.fontFamily.split(',')[0]) ? 'S' : /Playfair|Bodoni|Didot/.test(cs.fontFamily.split(',')[0]) ? 'P' : 'N', ls: Math.round(ls * 1000) / 1000 }; };
    const key = (s) => [s.fs, s.fw, s.c.join('.'), s.it, s.ff, s.ls].join('|');
    for (const C of P.querySelectorAll(CONT)) {
      if (C.closest('svg')) continue;
      const tw = document.createTreeWalker(C, NodeFilter.SHOW_TEXT);
      const chars = []; const range = document.createRange();
      for (let tn = tw.nextNode(); tn; tn = tw.nextNode()) {
        let own = tn.parentElement; while (own && !own.matches(CONT)) own = own.parentElement;
        if (own !== C) continue;
        const st = styleOf(tn.parentElement);
        const txt = tn.nodeValue;
        for (let i = 0; i < txt.length; i++) {
          range.setStart(tn, i); range.setEnd(tn, i + 1);
          const rs = range.getClientRects(); if (!rs.length) continue;
          const rc = rs[0]; const ch = txt[i];
          const isSp = /\s/.test(ch);
          if (rc.width === 0 && !isSp) continue;
          if (rc.width === 0 && isSp) continue;
          chars.push({ ch: isSp ? ' ' : ch, l: rc.left - O.left, r: rc.right - O.left, t: rc.top - O.top, b: rc.bottom - O.top, st });
        }
      }
      if (!chars.length) continue;
      const lines = []; let cur = null;
      for (const c of chars) {
        if (!cur || c.t > cur.maxB - 2 || c.l < cur.lastR - 4) { cur = { cs: [], maxB: c.b, lastR: c.r }; lines.push(cur); }
        cur.cs.push(c); cur.maxB = Math.max(cur.maxB, c.b); cur.lastR = c.r;
      }
      let s = ''; const runs = []; const meta = [];
      lines.forEach((ln, li) => {
        while (ln.cs.length && ln.cs[0].ch === ' ') ln.cs.shift();
        while (ln.cs.length && ln.cs[ln.cs.length - 1].ch === ' ') ln.cs.pop();
        if (!ln.cs.length) return;
        if (s) s += '\u2028';
        let big = ln.cs[0];
        let prev = null;
        for (const c of ln.cs) {
          if (prev && prev.ch !== ' ' && c.ch !== ' ' && c.l - prev.r > 0.22 * c.st.fs) { s += ' '; }   // margin 으로 벌린 틈 → 빈칸
          if (prev && prev.ch === ' ' && c.ch === ' ') { prev = c; continue; }
          const k = key(c.st); const last = runs[runs.length - 1];
          if (last && last.k === k && last.e === s.length) last.e = s.length + 1; else if (last && last.k === k && s.length - last.e <= 1) last.e = s.length + 1; else runs.push({ k, st: c.st, b: s.length, e: s.length + 1 });
          s += c.ch; if (c.st.fs > big.st.fs) big = c; prev = c;
        }
        meta.push({ L: Math.min(...ln.cs.map((c) => c.l)), R: Math.max(...ln.cs.map((c) => c.r)), cy: (big.t + big.b) / 2 });
      });
      if (!s) continue;
      const cs = getComputedStyle(C); const base = styleOf(C); const bk = key(base);
      const lhCss = parseFloat(cs.lineHeight) || base.fs * 1.2;
      const pitch = meta.length > 1 ? (meta[meta.length - 1].cy - meta[0].cy) / (meta.length - 1) : lhCss;
      const blockL = Math.min(...meta.map((m) => m.L));
      const restL = meta.length > 1 ? Math.min(...meta.slice(1).map((m) => m.L)) : meta[0].L;
      const al = C.matches('.stats b') ? 'R' : (cs.textAlign === 'center' ? 'C' : 'L');
      const cb = C.getBoundingClientRect();
      items.push({ t: 'text', g: groupOf(C), n: s.replace(/\u2028/g, ' ').slice(0, 24), s, al,
        L: r2(al === 'L' ? restL : blockL), R: r2(Math.max(...meta.map((m) => m.R))), cx: r2(al === 'C' ? (cb.left + cb.right) / 2 - O.left : 0), cy: r2(meta[0].cy), lh: r2(pitch), ind: r2(al === 'L' && meta.length > 1 ? Math.max(0, meta[0].L - restL) : 0), nl: meta.length,
        base, runs: runs.filter((r) => r.k !== bk).map((r) => ({ b: r.b, e: r.e, st: r.st })) });
    }
    const figsEl = P.querySelector('.figs'); const limit = O.bottom - parseFloat(getComputedStyle(P).paddingBottom);
    if (!figsEl) {   // 그림 칸이 없는 쪽: 가장 아래 글자 줄이 아래 여백 선을 얼마나 넘는지만 본다(음수면 남는다)
      const low = Math.max(...items.filter((i) => i.t === 'text').map((i) => i.cy + (i.nl ? (i.nl - 1) * i.lh : 0) + i.base.fs * 0.6));
      return { id, w: r2(O.width), h: r2(O.height), slackMm: 0, overMm: r2((low + O.top - limit) * 25.4 / 96), items };
    }
    const figs = figsEl.getBoundingClientRect(); const lastSec = ([...P.querySelectorAll('.sec, .tb, .two2')].pop() || P).getBoundingClientRect();
    return { id, w: r2(O.width), h: r2(O.height), slackMm: r2((figs.top - lastSec.bottom) * 25.4 / 96), overMm: r2((figs.bottom - limit) * 25.4 / 96), items };
  }, id);
  const out = path.join(here, 'figma-' + id + '.json');
  fs.writeFileSync(out, JSON.stringify(data));
  const cnt = data.items.reduce((a, i) => (a[i.t] = (a[i.t] || 0) + 1, a), {});
  console.log(id, 'slackMm', data.slackMm, 'overMm', data.overMm, JSON.stringify(cnt), 'bytes', fs.statSync(out).size);
  await page.locator('#' + id).screenshot({ path: path.join(here, 'noto-' + id + '.png') });
}
await browser.close();
