// figma-extract.mjs 가 만든 쪽 JSON 을 피그마로 실어 보낼 SVG 로 바꾼다.
// JSON → base64 → 2,400자씩 <text id="d000">…</text> 로 쪼갠 SVG. 이 SVG 를 upload_assets(image/svg+xml)로 올리면
// 피그마에 글자 레이어 묶음으로 들어오고, figma-build.js 가 그 글자를 이어 붙여 다시 JSON 으로 읽는다.
// 쓰는 법: node figma-data-svg.mjs <figma-pNN.json> <결과.svg>
import fs from 'node:fs';

const [, , src, dst] = process.argv;
const b64 = fs.readFileSync(src).toString('base64');
const N = 2400;
const chunks = [];
for (let i = 0; i < b64.length; i += N) chunks.push(b64.slice(i, i + N));
const h = chunks.length * 4 + 8;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${h}" viewBox="0 0 400 ${h}">`;
chunks.forEach((c, i) => { svg += `<text id="d${String(i).padStart(3, '0')}" x="0" y="${4 + i * 4}" font-family="Inter" font-size="2" fill="#000000">${c}</text>`; });
svg += '</svg>';
fs.writeFileSync(dst, svg);
console.log('chunks', chunks.length, 'svg bytes', svg.length);
