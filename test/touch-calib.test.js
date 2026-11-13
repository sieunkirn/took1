// 외부 터치 필름 좌표 보정(public/js/touch-calib.js)의 아핀 변환 계산 단위 테스트
// 브라우저용 일반 스크립트라 vm 으로 실행해 계산 함수(TookAffine)만 꺼낸다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../public/js/touch-calib.js', import.meta.url), 'utf8');
const box = {};
vm.runInNewContext(code, box);
const { solveAffine, applyAffine, invertAffine } = box.TookAffine;

const W = 800, H = 1280;
const TARGETS = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.5, 0.5]].map(([u, v]) => [u * W, v * H]);
// 실제 좌표 → 원본 좌표(왜곡) 행렬을 정해 점 쌍을 만들고, 풀어서 나온 원본 → 실제 행렬이 그 역행렬인지 본다
const pairsFrom = (distort, noise = 0) => TARGETS.map((real, i) => {
  const [x, y] = applyAffine(distort, real[0], real[1]);
  const n = noise ? [Math.sin(i * 7.1) * noise, Math.cos(i * 3.3) * noise] : [0, 0];
  return { raw: [x + n[0], y + n[1]], real };
});
const close = (a, b, eps = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${i}: ${v} ≠ ${b[i]}`));

const CASES = {
  '그대로': [1, 0, 0, 0, 1, 0],
  '이동만': [1, 0, 12, 0, 1, -30],
  '90° 회전 + 가로 0.85·세로 0.77 + 이동 (calibsim 과 같은 왜곡)': [0, 0.85 * W / H, 0.08 * W, -0.77 * H / W, 0, 0.87 * H],
  '축 교환 + 좌우 반전': [0, -0.9, 760, 1.1, 0, 20],
  '180° 회전 + 축소': [-0.82, 0, 700, 0, -0.82, 1150],
  '기울어짐 (전단 + 약간 회전)': [0.9, 0.05, 15, -0.03, 0.88, 40],
};

for (const [name, distort] of Object.entries(CASES)) {
  test(`아핀 보정: ${name}`, () => {
    const res = solveAffine(pairsFrom(distort));
    assert.ok(res, '행렬을 구해야 한다');
    close(res.m, invertAffine(distort), 1e-6);
    assert.ok(res.rms < 1e-6 && res.max < 1e-6);
  });
}

test('아핀 보정: 원본 → 실제 행렬을 알려진 행렬로 바로 만들어도 같은 행렬이 나온다', () => {
  const m = [0.12, -1.3, 900, 1.4, 0.07, -55];
  const pairs = TARGETS.map((raw) => ({ raw, real: applyAffine(m, raw[0], raw[1]) }));
  close(solveAffine(pairs).m, m, 1e-6);
});

test('아핀 보정: 흔들림이 있으면 최소제곱으로 가깝게 맞추고 남은 오차를 알려 준다', () => {
  const distort = CASES['90° 회전 + 가로 0.85·세로 0.77 + 이동 (calibsim 과 같은 왜곡)'];
  const res = solveAffine(pairsFrom(distort, 3));
  assert.ok(res.rms > 0 && res.rms < 6, `rms ${res.rms}`);
  // 화면 가운데 점이 몇 px 안에 맞는다
  const [x, y] = applyAffine(res.m, ...applyAffine(distort, W / 2, H / 2));
  assert.ok(Math.hypot(x - W / 2, y - H / 2) < 6);
});

test('아핀 보정: 점이 모자라거나 한 줄 위에 있으면 null', () => {
  assert.equal(solveAffine([{ raw: [0, 0], real: [0, 0] }, { raw: [1, 1], real: [1, 1] }]), null);
  assert.equal(solveAffine([0, 1, 2, 3].map((i) => ({ raw: [i * 10, i * 20], real: [i, i] }))), null);
});
