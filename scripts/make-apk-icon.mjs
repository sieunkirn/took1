// 앱(APK) 아이콘 PNG 만들기 (2026-11-20): android/icon/mark.svg(TOOK 로고 마크, 핑크) → android/res/
//  - 안드로이드 8 이상: 적응형 아이콘(mipmap-anydpi-v26/ic_launcher.xml) = 검정 바탕 + 마크(전경 PNG). 기기마다 동그라미·둥근 네모로 잘라도 마크가 안전 영역 안에 남는다
//  - 안드로이드 7: 검정 둥근 네모 + 마크 PNG (ic_launcher.png)
// 실행: npm run icon:apk   (Playwright 의 Chromium 으로 그린다. 결과 PNG 는 저장소에 같이 둔다)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android', 'res');
const mark = readFileSync(join(root, 'android', 'icon', 'mark.svg'), 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '');
const markUri = 'data:image/svg+xml;base64,' + Buffer.from(mark).toString('base64');
const BG = '#000000';

// 밀도별 크기: 일반 아이콘 48dp, 적응형 전경 108dp
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// 마크 크기 (캔버스 대비). 적응형은 가운데 66dp 원이 안전 영역이라 108dp 중 58dp 정도로
const LEGACY_MARK = 0.62;
const FG_MARK = 58 / 108;

const browser = await chromium.launch();
const page = await browser.newPage();
async function draw(size, { bg, radius, markScale }) {
  await page.setViewportSize({ width: size, height: size });
  const m = Math.round(size * markScale);
  // 마크 원본은 143.2×143.7 로 거의 정사각형. 가운데에 놓는다
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg || 'transparent'};border-radius:${radius || 0}px">
      <img src="${markUri}" style="width:${m}px;height:${m}px;display:block">
    </div></body></html>`);
  await page.waitForFunction(() => document.images[0].complete);
  return page.screenshot({ omitBackground: true, type: 'png' });
}

for (const [name, k] of Object.entries(DENSITIES)) {
  const dir = join(res, 'mipmap-' + name);
  mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * k);
  writeFileSync(join(dir, 'ic_launcher.png'), await draw(legacy, { bg: BG, radius: Math.round(legacy * 0.22), markScale: LEGACY_MARK }));
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), await draw(Math.round(108 * k), { markScale: FG_MARK }));
}
// 미리보기 (README·확인용): 512px 둥근 네모
mkdirSync(join(root, 'android', 'icon'), { recursive: true });
writeFileSync(join(root, 'android', 'icon', 'preview-512.png'), await draw(512, { bg: BG, radius: 112, markScale: LEGACY_MARK }));
await browser.close();

mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true });
writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- 적응형 아이콘 (안드로이드 8 이상). scripts/make-apk-icon.mjs 가 만든다 -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`);
mkdirSync(join(res, 'values'), { recursive: true });
writeFileSync(join(res, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG}</color>
</resources>
`);
console.log('앱 아이콘을 만들었습니다 → android/res/ (미리보기 android/icon/preview-512.png)');
