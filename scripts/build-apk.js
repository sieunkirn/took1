// 안드로이드 APK 만들기 (2026-11-17)
// 정적 버전(npm run build:web 과 같은 dist/static)을 앱 안에 넣은 WebView 앱을 만든다. 두 가지가 나온다 (2026-11-22):
//   dist/apk/took.apk      1번 '툭'    앱 안 화면만 쓴다
//   dist/apk/took-web.apk  2번 '툭 웹' Vercel 웹 주소를 연다 (배포하면 바로 반영, 인터넷 끊기면 앱 안 화면)
//   npm run build:apk
// 앱 코드: android/AndroidManifest.xml, android/src/com/took/kiosk/MainActivity.java
// 필요: JDK 17 이상(javac·java·keytool), Android SDK(build-tools, platforms/android-NN). Gradle 은 쓰지 않고 SDK 도구로 바로 만든다.
// 서명: 이 PC 의 안드로이드 디버그 키(~/.android/debug.keystore, 없으면 만든다). 다른 PC 에서 만든 APK 는 서명이 달라
//       기기에 덮어 설치할 수 없다(앱을 지우고 새로 설치).
// 음성 인식(Web Speech API)은 안드로이드 WebView 에 없어서 앱에서는 동작하지 않는다.
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const MIN_SDK = 24; // Android 7.0
const TARGET_SDK = 35; // Android 15
const EXE = process.platform === 'win32' ? '.exe' : '';

const fail = (msg) => { console.error('\n' + msg); process.exit(1); };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const numCmp = (a, b) => {
  const x = a.match(/\d+/g).map(Number), y = b.match(/\d+/g).map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

// ---------- 도구 찾기 ----------
const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  join(homedir(), 'Library', 'Android', 'sdk'), join(homedir(), 'Android', 'Sdk')].find((p) => p && existsSync(p));
if (!sdk) fail('Android SDK 를 찾지 못했습니다. Android Studio 로 SDK 를 설치하거나 ANDROID_HOME 을 SDK 폴더로 지정하세요.');
const newest = (dir, re, need) => (existsSync(dir) ? readdirSync(dir) : [])
  .filter((n) => re.test(n) && existsSync(join(dir, n, need))).sort(numCmp).pop();
const btName = newest(join(sdk, 'build-tools'), /^\d+(\.\d+)*$/, join('lib', 'd8.jar'));
const platName = newest(join(sdk, 'platforms'), /^android-\d+(\.\d+)?$/, 'android.jar');
if (!btName || !platName) fail(`SDK(${sdk})에 build-tools 또는 platforms/android-NN 이 없습니다. Android Studio SDK Manager 에서 설치하세요.`);
const bt = join(sdk, 'build-tools', btName);
const androidJar = join(sdk, 'platforms', platName, 'android.jar');
const jdkBin = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin') : '';
const jdk = (n) => (jdkBin && existsSync(join(jdkBin, n + EXE)) ? join(jdkBin, n + EXE) : n);
try { execFileSync(jdk('javac'), ['-version'], { stdio: 'ignore' }); } catch {
  fail('javac(JDK 17 이상)를 찾지 못했습니다. JDK 를 설치하거나 JAVA_HOME 을 지정하세요 (Android Studio 의 jbr 폴더도 됩니다).');
}
console.log(`SDK: ${sdk}\n  build-tools ${btName}, ${platName}`);

// ---------- 1. 정적 버전 만들기 (Vercel 과 같은 파일) ----------
run(process.execPath, [join(root, 'scripts', 'build-static.js'), '--web']);
const www = join(root, 'dist', 'static');

// 작업 폴더: SDK 도구가 한글·공백 경로에서 문제를 일으키지 않게 임시 폴더(영문 경로)에서 만든다
const work = join(tmpdir(), 'took-apk-build');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const w = (...p) => join(work, ...p);

// ---------- 2. 리소스(아이콘)·매니페스트·앱 안 파일 묶기 ----------
cpSync(www, w('assets', 'www'), { recursive: true });
// 앱은 일반 안드로이드 기기용: 거울 터치 필름 보정값(touch-calib.js BUILT_IN_CODE)을 빼서 터치를 그대로 쓴다 (2026-11-17 사용자 요청)
// 웹(Vercel)에는 그대로 남는다. 앱에서도 관리자 화면에서 직접 보정해 저장하면 그 기기에서는 적용된다
const calibFile = w('assets', 'www', 'js', 'touch-calib.js');
const calibSrc = readFileSync(calibFile, 'utf8');
const calibOff = calibSrc.replace(/const BUILT_IN_CODE = '[^']*';/, "const BUILT_IN_CODE = ''; // 앱: 보정값 없음");
if (calibOff === calibSrc && !/const BUILT_IN_CODE = '';/.test(calibSrc)) fail('touch-calib.js 에서 BUILT_IN_CODE 를 찾지 못했습니다.');
writeFileSync(calibFile, calibOff);
// 앱 아이콘 (2026-11-20): TOOK 로고 마크. android/res 는 npm run icon:apk 가 android/icon/mark.svg 로 만든다 (적응형 + 안드로이드 7용)
if (!existsSync(join(root, 'android', 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml'))) fail('앱 아이콘이 없습니다. 먼저 npm run icon:apk 를 실행하세요.');
cpSync(join(root, 'android', 'res'), w('res'), { recursive: true });
const now = new Date();
const versionCode = Math.floor(now.getTime() / 60000); // 분 단위: 새로 만들수록 커져서 덮어 설치된다
const p2 = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}.${p2(now.getHours())}${p2(now.getMinutes())}`; // 이 PC 시각
const versionName = `${pkg.version}-${stamp}`;
run(join(bt, 'aapt2' + EXE), ['compile', '--dir', w('res'), '-o', w('res.zip')]);
// ---------- 3. 자바 코드 → classes.dex ----------
const javaFiles = walk(join(root, 'android', 'src')).filter((f) => f.endsWith('.java'));
run(jdk('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-bootclasspath', androidJar,
  '-Xlint:-options', '-nowarn', '-d', w('classes'), ...javaFiles]);
mkdirSync(w('dex'), { recursive: true });
run(jdk('java'), ['-cp', join(bt, 'lib', 'd8.jar'), 'com.android.tools.r8.D8', '--release', '--min-api', String(MIN_SDK),
  '--lib', androidJar, '--output', w('dex'), ...walk(w('classes')).filter((f) => f.endsWith('.class'))]);
// ---------- 3-1. USB 웹캠 네이티브 라이브러리 (android/jni/uvc.c → lib/<abi>/libtookuvc.so, 2026-11-22) ----------
// NDK 가 없으면 경고만 하고 빼고 만든다 → 등시 전송 웹캠(대부분)은 앱에서도 안 잡힌다
const ndkName = newest(join(sdk, 'ndk'), /^\d+(\.\d+)*$/, 'toolchains');
const hostTag = process.platform === 'win32' ? 'windows-x86_64' : process.platform === 'darwin' ? 'darwin-x86_64' : 'linux-x86_64';
const clang = ndkName && join(sdk, 'ndk', ndkName, 'toolchains', 'llvm', 'prebuilt', hostTag, 'bin', 'clang' + EXE);
let nativeLibs = false;
if (clang && existsSync(clang)) {
  const src = w('uvc.c');
  copyFileSync(join(root, 'android', 'jni', 'uvc.c'), src); // 한글 경로를 피해 작업 폴더에서 만든다
  const ABIS = { 'arm64-v8a': 'aarch64-linux-android', 'armeabi-v7a': 'armv7a-linux-androideabi', 'x86_64': 'x86_64-linux-android' };
  for (const [abi, triple] of Object.entries(ABIS)) {
    mkdirSync(w('lib', abi), { recursive: true });
    run(clang, [`--target=${triple}${MIN_SDK}`, '-shared', '-fPIC', '-O2', '-Wall', '-Wl,-z,max-page-size=16384',
      '-o', w('lib', abi, 'libtookuvc.so'), src, '-llog']);
  }
  nativeLibs = true;
  console.log(`USB 웹캠 네이티브 라이브러리: NDK ${ndkName} (${Object.keys(ABIS).join(', ')})`);
} else {
  console.warn('\n[경고] Android NDK 가 없어 USB 웹캠 네이티브 라이브러리(libtookuvc.so)를 빼고 만듭니다.'
    + '\n       Android Studio → SDK Manager → SDK Tools → NDK (Side by side) 를 설치한 뒤 다시 만드세요.\n');
}

// ---------- 4. 두 가지 APK (2026-11-22 사용자 요청) ----------
//  1번 took.apk     (앱 이름 '툭',    com.took.kiosk)     앱 안에 넣은 화면(assets/www)만 쓴다. 인터넷 없이도 된다
//  2번 took-web.apk (앱 이름 '툭 웹', com.took.kiosk.web) 웹 주소(Vercel)를 연다 → push 로 배포하면 앱을 다시 안 깔아도 바로 반영.
//      인터넷이 끊겨 첫 화면을 못 열면 앱 안 화면으로 연다. 두 앱은 이름·패키지가 달라 같이 설치된다
// 둘 다 USB 웹캠 직접 연결(UvcCamera·libtookuvc.so)이 들어 있다. 시작 주소는 assets/start-url.txt 로 알려 준다 (MainActivity)
const WEB_URL = 'https://took-sieunkirns-projects.vercel.app/index.html';
const VARIANTS = [
  { file: 'took.apk', label: '툭', pkg: null, startUrl: null },
  { file: 'took-web.apk', label: '툭 웹', pkg: 'com.took.kiosk.web', startUrl: WEB_URL },
];
const ks = join(homedir(), '.android', 'debug.keystore');
if (!existsSync(ks)) {
  mkdirSync(dirname(ks), { recursive: true });
  // 안드로이드 표준 디버그 키 (비밀번호 android 는 모든 개발 PC 에서 같은 공개 기본값)
  run(jdk('keytool'), ['-genkeypair', '-keystore', ks, '-storepass', 'android', '-alias', 'androiddebugkey', '-keypass', 'android',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US']);
}
const apksigner = ['-jar', join(bt, 'lib', 'apksigner.jar')];
const outDir = join(root, 'dist', 'apk');
mkdirSync(outDir, { recursive: true });
const manifestSrc = readFileSync(join(root, 'android', 'AndroidManifest.xml'), 'utf8');
const done = [];

for (const v of VARIANTS) {
  const vd = (...p) => w('v-' + v.file, ...p);
  mkdirSync(vd(), { recursive: true });
  // 매니페스트: 앱 이름만 바꾼다. 패키지는 aapt2 --rename-manifest-package 로 (자바 클래스 이름은 그대로 com.took.kiosk.*)
  const manifest = manifestSrc.replace('android:label="툭"', `android:label="${v.label}"`);
  if (manifest === manifestSrc && v.label !== '툭') fail('AndroidManifest.xml 에서 android:label="툭" 을 찾지 못했습니다.');
  writeFileSync(vd('AndroidManifest.xml'), manifest);
  run(join(bt, 'aapt2' + EXE), ['link', '-o', vd('base.apk'), '-I', androidJar, '--manifest', vd('AndroidManifest.xml'),
    ...(v.pkg ? ['--rename-manifest-package', v.pkg] : []),
    '--min-sdk-version', String(MIN_SDK), '--target-sdk-version', String(TARGET_SDK),
    '--version-code', String(versionCode), '--version-name', versionName, w('res.zip')]);
  // 앱 안 파일(assets/www)·classes.dex·네이티브 라이브러리는 JDK jar 로 넣는다. aapt2 -A 는 윈도우에서 경로를 'assets/www\a.html' 처럼
  // 역슬래시로 넣어서 기기가 파일을 찾지 못한다. jar 는 늘 '/' 로 넣는다 (resources.arsc 는 무압축 그대로 둔다)
  const extra = [];
  if (v.startUrl) {
    mkdirSync(vd('extra', 'assets'), { recursive: true });
    writeFileSync(vd('extra', 'assets', 'start-url.txt'), v.startUrl);
    extra.push('-C', vd('extra'), 'assets');
  }
  run(jdk('jar'), ['--update', '--no-manifest', '--file', vd('base.apk'), '-C', work, 'assets', ...extra,
    ...(nativeLibs ? ['-C', work, 'lib'] : []), '-C', w('dex'), 'classes.dex']);
  run(join(bt, 'zipalign' + EXE), ['-f', '-p', '4', vd('base.apk'), vd('aligned.apk')]);
  run(jdk('java'), [...apksigner, 'sign', '--ks', ks, '--ks-pass', 'pass:android', '--key-pass', 'pass:android',
    '--ks-key-alias', 'androiddebugkey', '--out', vd(v.file), vd('aligned.apk')]);
  run(jdk('java'), [...apksigner, 'verify', vd(v.file)]);

  // 빠진 파일 확인: APK 안 경로가 'assets/www/…' 로 모두 들어갔는지
  const entries = execFileSync(jdk('jar'), ['--list', '--file', vd(v.file)], { encoding: 'utf8', maxBuffer: 256 << 20 }).split(/\r?\n/);
  if (!entries.includes('classes.dex') || !entries.includes('resources.arsc')) fail(`${v.file} 에 classes.dex 또는 resources.arsc 가 없습니다.`);
  if (nativeLibs && !entries.includes('lib/arm64-v8a/libtookuvc.so')) fail(`${v.file} 에 lib/arm64-v8a/libtookuvc.so 가 없습니다.`);
  if (v.startUrl && !entries.includes('assets/start-url.txt')) fail(`${v.file} 에 assets/start-url.txt 가 없습니다.`);
  const listed = new Set(entries.filter((l) => l.startsWith('assets/www/') && !l.endsWith('/')).map((l) => l.slice('assets/www/'.length)));
  const missing = walk(www).map((f) => relative(www, f).split(sep).join('/')).filter((f) => !listed.has(f));
  if (missing.length) fail(`${v.file} 에 빠진 파일 ${missing.length}개:\n  ${missing.slice(0, 20).join('\n  ')}`);

  copyFileSync(vd(v.file), join(outDir, v.file));
  const mb = (statSync(join(outDir, v.file)).size / 1048576).toFixed(1);
  done.push(`  dist/apk/${v.file}  '${v.label}'  ${mb} MB  ${v.startUrl ? '웹 주소: ' + v.startUrl : '앱 안 화면 ' + listed.size + '개'}`);
}
rmSync(work, { recursive: true, force: true });
console.log(`\nAPK 완료 (버전 ${versionName}, USB 웹캠 직접 연결 ${nativeLibs ? '포함' : '빠짐(NDK 없음)'})\n${done.join('\n')}`);
