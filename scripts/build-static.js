// 서버 없이 동작하는 정적 버전을 dist/static 에 만든다.
// 제품 검색·추천·챗봇은 서버와 같은 src/lib 모듈을 브라우저에서 실행한다 (public/js/common.js 의 STATIC 모드).
//   npm run build:static   claude.ai Artifact 용 (호스트가 index.html 을 문서 골격으로 감싸므로 골격 태그를 뺀다)
//   npm run build:web      Vercel 등 일반 정적 호스팅용 (모든 화면의 문서 골격을 그대로 둔다)
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist/static');
const BROWSER_LIBS = ['color.js', 'constants.js', 'catalog.js', 'recommend.js', 'chat.js', 'spoken.js'];
const FOR_ARTIFACT = !process.argv.includes('--web');

if (!existsSync(join(root, 'public/vendor/mediapipe/vision_bundle.js'))) {
  console.error('public/vendor 가 없습니다. 먼저 npm install 을 실행하세요.');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'public'), out, { recursive: true });
mkdirSync(join(out, 'lib'));
for (const f of BROWSER_LIBS) cpSync(join(root, 'src/lib', f), join(out, 'lib', f));
mkdirSync(join(out, 'data'));
// 서버와 같은 데이터(기본: 올리브영, TOOK_DATA=virtual 이면 가상)를 정적 버전에 넣는다
const { dataFile } = await import('../src/lib/repository.js');
cpSync(fileURLToPath(dataFile()), join(out, 'data/products.json'));

// 모델(.task)은 정적 호스팅에서 제공되지 않는 형식이라 base64 텍스트로 바꿔 넣는다
const model = join(out, 'vendor/mediapipe/face_landmarker.task');
writeFileSync(model + '.b64.txt', readFileSync(model).toString('base64'));
rmSync(model);

const MODE_META = '<meta name="took-mode" content="static">';
for (const f of readdirSync(out).filter((n) => n.endsWith('.html'))) {
  let html = readFileSync(join(out, f), 'utf8').replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + MODE_META);
  if (FOR_ARTIFACT && f === 'index.html') {
    // Artifact 의 메인 페이지는 호스트가 doctype/html/head/body 골격을 감싸므로 골격 태그를 뺀다
    html = html.replace(/<!doctype html>\s*/i, '').replace(/<\/?html[^>]*>\s*/gi, '').replace(/<\/?head>\s*/gi, '')
      .replace(/<\/?body>\s*/gi, '').replace(/<meta charset="utf-8">\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  }
  writeFileSync(join(out, f), html);
}

// 게시용 파일 목록 (index.html 제외)
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (relative(out, p) !== 'index.html') files.push(relative(out, p));
  }
})(out);
writeFileSync(join(root, 'dist/static-files.json'), JSON.stringify(files, null, 2) + '\n');
console.log(`정적 빌드 완료: dist/static (${files.length + 1}개 파일)`);
