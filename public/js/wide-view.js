// 광각(0.5배 줌처럼 배경 넓게) 보기 (2026-11-23 사용자 요청 "배경이 넓게 보이게", "카메라 0.5배줌 같은 효과")
// 웹캠은 가로(4:3·16:9)로 찍는데 거울 화면은 세로(5:8)라, 꽉 채우면(cover) 양옆이 절반 넘게 잘린다.
// 이 효과는 가운데(얼굴)는 원래 비율 그대로 두고 가장자리로 갈수록 눌러서, 잘리던 양옆 배경까지 화면에 담는다
// (휴대폰 0.5배 초광각처럼 가장자리가 살짝 늘어/눌려 보인다). 검은 여백은 생기지 않는다.
//  - 원본 캔버스(#view)는 그대로 그려 두고(피부색 측정 등은 원본에서 읽는다) 그 위에 WebGL 캔버스를 겹쳐 보여 준다
//  - 축마다 따로: 화면 u(-1~1) → 원본 = c·u + e·u³ (c = 꽉 채웠을 때 보이는 절반, e = 더 담을 만큼)
//  - 세기 0 이면 WebGL 캔버스를 숨기고 원본을 그대로. WebGL 을 못 쓰는 기기도 원본 그대로
//  (같은 날 물고기 눈(가운데 볼록) 버전을 먼저 만들었다가 사용자 뜻이 아니어서 바꿨다)

const VS = `attribute vec2 a; varying vec2 uv; void main() { uv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); gl_Position = vec4(a, 0.0, 1.0); }`;
const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 dst;   // 보이는 칸 크기 (px)
uniform vec2 src;   // 원본 캔버스 크기 (px)
uniform float t;    // 세기 0~1 (1 = 원본 전체 폭·높이를 담는다)
uniform float cover; // 1 = object-fit: cover, 0 = contain
void main() {
  float s = cover > 0.5 ? max(dst.x / src.x, dst.y / src.y) : min(dst.x / src.x, dst.y / src.y);
  vec2 c = dst * 0.5 / s;                 // 꽉 채울 때 보이는 절반 (원본 px)
  vec2 e = max(src * 0.5 - c, 0.0) * t;   // 가장자리에서 더 담을 만큼
  vec2 u = uv * 2.0 - 1.0;
  vec2 p = src * 0.5 + c * u + e * u * u * u;
  vec2 q = p / src;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  gl_FragColor = texture2D(tex, q);
}`;

/** 세기 0~100 → 0~1 */
export const wideAmount = (v) => Math.max(0, Math.min(100, Number(v) || 0)) / 100;

/** 화면에 담기는 양을 '몇 배 줌'으로 (가로·세로 중 더 넓어지는 쪽). 원본·칸 크기를 모르면 null */
export function wideZoomLabel(amount, srcW, srcH, W, H) {
  if (!srcW || !srcH || !W || !H) return null;
  const s = Math.max(W / srcW, H / srcH);
  const cx = W / 2 / s, cy = H / 2 / s;
  const zx = cx / (cx + Math.max(srcW / 2 - cx, 0) * amount);
  const zy = cy / (cy + Math.max(srcH / 2 - cy, 0) * amount);
  return Math.min(zx, zy);
}

/**
 * @param {HTMLCanvasElement} source 원본 캔버스 (영상이 그려지는 곳)
 * @param {{ getAmount: () => number, visible?: () => boolean, fit?: () => 'cover'|'contain' }} opts
 */
export function attachWideView(source, opts) {
  const none = { amount: () => 0, mapPoint: (x, y) => ({ x, y }), destroy() {} };
  const out = document.createElement('canvas');
  out.className = 'wide-out';
  out.setAttribute('aria-hidden', 'true');
  out.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none;';
  source.after(out);
  const gl = out.getContext('webgl', { premultipliedAlpha: false }) || out.getContext('experimental-webgl');
  if (!gl) { out.remove(); console.warn('[took] WebGL 을 못 써서 광각 보기 없이 보여요'); return none; }

  const sh = (type, code) => { const x = gl.createShader(type); gl.shaderSource(x, code); gl.compileShader(x); return x; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[took] 광각 보기 셰이더 오류', gl.getProgramInfoLog(prog));
    out.remove();
    return none;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uDst = U('dst'), uSrc = U('src'), uT = U('t'), uCover = U('cover');

  let t = 0;
  let on = false;
  let isCover = true;
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    t = Math.max(0, Math.min(1, Number(opts.getAmount()) || 0));
    const show = t > 0.001 && source.width > 1 && (opts.visible ? opts.visible() : true);
    if (show !== on) {
      on = show;
      out.style.display = show ? 'block' : 'none';
      source.style.visibility = show ? 'hidden' : ''; // 원본은 계속 그려지지만(측정용) 화면에는 광각 쪽만
    }
    if (!show) return;
    out.style.opacity = getComputedStyle(source).opacity;
    const W = out.clientWidth, H = out.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (out.width !== bw || out.height !== bh) { out.width = bw; out.height = bh; }
    gl.viewport(0, 0, bw, bh);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); } catch { return; }
    isCover = (opts.fit ? opts.fit() : getComputedStyle(source).objectFit) !== 'contain';
    gl.uniform2f(uDst, W, H);
    gl.uniform2f(uSrc, source.width, source.height);
    gl.uniform1f(uT, t);
    gl.uniform1f(uCover, isCover ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  raf = requestAnimationFrame(frame);

  // c·u + e·u³ = d 를 u 에 대해 푼다 (뉴턴법, 단조 증가라 금방 맞는다)
  const solve = (c, e, d) => {
    let u = d / (c + e);
    for (let i = 0; i < 10; i++) u -= (c * u + e * u * u * u - d) / (c + 3 * e * u * u);
    return u;
  };
  return {
    amount: () => (on ? t : 0),
    /** 꽉 채움(cover) 기준 화면 점(칸 안 px) → 광각 화면에서 보이는 자리. W·H = 칸 크기 */
    mapPoint(x, y, W, H) {
      if (!on || !isCover) return { x, y };
      const sw = source.width, shh = source.height;
      const s = Math.max(W / sw, H / shh);
      const cx = W / 2 / s, cy = H / 2 / s;
      const ex = Math.max(sw / 2 - cx, 0) * t, ey = Math.max(shh / 2 - cy, 0) * t;
      const ux = solve(cx, ex, (x - W / 2) / s), uy = solve(cy, ey, (y - H / 2) / s);
      return { x: W / 2 + ux * W / 2, y: H / 2 + uy * H / 2 };
    },
    destroy() { cancelAnimationFrame(raf); out.remove(); source.style.visibility = ''; },
  };
}
