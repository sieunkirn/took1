// 레포트북 쪽을 피그마 프레임 안에 "편집 가능한 레이어"로 그리는 use_figma 스크립트
// (2026-11-26, 54~57쪽에 처음 씀 → 64~100쪽부터는 여러 쪽을 한 번에 그리도록 JOBS 로 바꿈)
//
// 순서
//  1) node figma-extract.mjs "<took 폴더>" --dir=레포트북-64-100쪽 --ids=p65,p66 --out=<임시 폴더>
//       → 쪽마다 figma-pNN.json (글자·사각형·그림·SVG 위치)
//  2) node figma-data-svg.mjs figma-pNN.json data-pNN.svg  → JSON 을 base64 글자로 실은 SVG
//     upload_assets(count = 쪽 수, currentPageId = 689:18) 로 받은 주소에 SVG 를 POST(Content-Type: image/svg+xml)
//       → 응답의 placedOnNodeId 가 그 쪽의 DATA_ID  (use_figma 코드에 데이터를 직접 적지 않으려고 쓰는 길. 코드는 5만 자 제한)
//  3) 아래 코드를 use_figma 에 넣고 JOBS 만 바꾼다: [프레임 id, DATA_ID, 묶음 이름] → 결과의 imgs(그림 칸 id)를 받는다
//  4) 사진이 있는 쪽은 upload_assets(nodeIds = imgs 의 id 들)로 원본을 올려 그림 칸을 채운다
//
// 알아 둘 것: 글자는 문단마다 한 레이어, 줄바꿈은 U+2028(고정 줄바꿈), 피그마 글꼴은 Noto Sans KR(Regular·Medium·Bold),
//            원래 있던 레이어는 지우지 않고 숨긴다, 다시 돌리면 같은 이름의 묶음만 지우고 새로 그린다.
//            프레임 id: 52~61쪽 = 2020:(837+쪽), 62~81쪽 = 2020:(857+쪽), 82~100쪽 = 2020:(817+쪽)

const JOBS = [["2020:922", "0:0", "65쪽 내용 (편집용)"]];
const first = await figma.getNodeByIdAsync(JOBS[0][0]);
let pg = first; while (pg.type !== "PAGE") pg = pg.parent;
await figma.setCurrentPageAsync(pg);
const F = { N400: { family: "Noto Sans KR", style: "Regular" }, N500: { family: "Noto Sans KR", style: "Medium" }, N700: { family: "Noto Sans KR", style: "Bold" }, S: { family: "STIX Two Text", style: "Italic" } };
await Promise.all([F.N400, F.N500, F.N700].map(f => figma.loadFontAsync(f)));
let sLoaded = false;
const fontOf = st => st.ff === "S" ? F.S : F["N" + st.fw];
const solid = c => ({ type: "SOLID", color: { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 } });
const NAMES = { bar: "색 띠", slot: "사진 자리", n: "번호 상자", svg: "도식 바탕" };
const utf8 = by => { let s = "", i = 0; const parts = []; while (i < by.length) { const c = by[i++]; let cp; if (c < 128) cp = c; else if (c < 224) cp = ((c & 31) << 6) | (by[i++] & 63); else if (c < 240) cp = ((c & 15) << 12) | ((by[i++] & 63) << 6) | (by[i++] & 63); else cp = ((c & 7) << 18) | ((by[i++] & 63) << 12) | ((by[i++] & 63) << 6) | (by[i++] & 63); if (cp > 0xFFFF) { const u = cp - 0x10000; s += String.fromCharCode(0xD800 + (u >> 10), 0xDC00 + (u & 1023)); } else s += String.fromCharCode(cp); if (s.length > 4000) { parts.push(s); s = ""; } } parts.push(s); return parts.join(""); };
const out = [];
for (const [FRAME_ID, DATA_ID, LABEL] of JOBS) {
  const frame = await figma.getNodeByIdAsync(FRAME_ID);
  const dataFrame = await figma.getNodeByIdAsync(DATA_ID);
  const b64 = dataFrame.findAllWithCriteria({ types: ["TEXT"] }).sort((a, b) => a.name < b.name ? -1 : 1).map(c => c.characters).join("");
  const D = JSON.parse(utf8(figma.base64Decode(b64)));
  if (!sLoaded && D.items.some(it => it.t === "text" && (it.base.ff === "S" || it.runs.some(r => r.st.ff === "S")))) { await figma.loadFontAsync(F.S); sLoaded = true; }   // 식(STIX)이 있는 쪽만
  for (const c of [...frame.children]) { if (c.name === LABEL) c.remove(); else c.visible = false; }
  frame.fills = [solid([255, 255, 255])];
  const box = figma.createFrame(); box.name = LABEL; box.fills = []; box.clipsContent = false; frame.appendChild(box); box.x = 0; box.y = 0; box.resize(frame.width, frame.height);
  const groups = new Map(); const imgs = {}; const warn = [];
  const add = (g, n) => { box.appendChild(n); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); };
  for (const it of D.items) {
    if (it.t === "rect") {
      const r = figma.createRectangle(); r.name = NAMES[it.n] || it.n; add(it.g, r);
      r.x = it.x; r.y = it.y; r.resize(Math.max(it.w, 0.01), Math.max(it.h, 0.01)); if (it.rad) r.cornerRadius = it.rad;
      r.fills = it.fill ? [solid(it.fill)] : [];
      if (it.sw) { r.strokes = [solid(it.sc)]; r.strokeWeight = it.sw; r.strokeAlign = "INSIDE"; if (it.dash) r.dashPattern = [3, 2.5]; }
    } else if (it.t === "img") {
      const r = figma.createRectangle(); r.name = "사진 " + it.src.split("/").pop(); add(it.g, r);
      r.x = it.x; r.y = it.y; r.resize(it.w, it.h); if (it.rad) r.cornerRadius = it.rad;
      r.fills = [solid([238, 238, 238])];
      if (it.bw) { r.strokes = [solid(it.bc)]; r.strokeWeight = it.bw; r.strokeAlign = "INSIDE"; }
      imgs[it.src] = r.id;
    } else if (it.t === "svg") {
      const v = figma.createNodeFromSvg(it.svg); v.name = it.n; add(it.g, v); v.x = it.x; v.y = it.y;
      if (Math.abs(v.width - it.w) > 0.5 || Math.abs(v.height - it.h) > 0.5) warn.push("svg size " + it.n + " " + v.width + "x" + v.height + " vs " + it.w + "x" + it.h);
    } else if (it.t === "text") {
      const t = figma.createText(); t.name = it.n; add(it.g, t);
      t.fontName = fontOf(it.base); t.fontSize = it.base.fs; t.characters = it.s; t.fills = [solid(it.base.c)];
      if (it.lh) t.lineHeight = { unit: "PIXELS", value: it.lh };
      if (it.base.ls) t.letterSpacing = { unit: "PERCENT", value: it.base.ls * 100 };
      for (const r of it.runs) { t.setRangeFontName(r.b, r.e, fontOf(r.st)); t.setRangeFontSize(r.b, r.e, r.st.fs); t.setRangeFills(r.b, r.e, [solid(r.st.c)]); if (r.st.ls !== it.base.ls) t.setRangeLetterSpacing(r.b, r.e, { unit: "PERCENT", value: r.st.ls * 100 }); }
      if (it.ind) t.paragraphIndent = it.ind;
      t.textAlignHorizontal = it.al === "C" ? "CENTER" : it.al === "R" ? "RIGHT" : "LEFT";
      t.textAutoResize = "WIDTH_AND_HEIGHT";
      t.y = it.cy - (it.lh ? it.lh / 2 : t.height / 2);
      t.x = it.al === "C" ? it.cx - t.width / 2 : it.al === "R" ? it.R - t.width : it.L;
      if (it.al === "L" && it.R && t.x + t.width > it.R + 3) warn.push("wide " + it.n + " +" + Math.round(t.x + t.width - it.R));
    }
  }
  const groupIds = [];
  for (const [name, nodes] of groups) { const g = figma.group(nodes, box); g.name = name; groupIds.push(g.id); }
  dataFrame.remove();
  const counts = {}; for (const n of box.findAll(() => true)) counts[n.type] = (counts[n.type] || 0) + 1;
  out.push({ frameId: frame.id, name: frame.name, boxId: box.id, groups: groupIds.length, imgs, counts, warn });
}
return out;
