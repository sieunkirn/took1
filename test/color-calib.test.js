// 카메라 색 보정 (public/js/color-calib.js): 흰 종이 측정값 → 이득, 코드 주고받기, 측정 칸 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGain, checkSample, describeCast, encodeCode, decodeCode, toLinear } from '../public/js/color-calib.js';

test('노랗게 찍힌 종이 → 파랑 이득이 빨강보다 크고, 보정하면 세 채널이 같아진다', () => {
  const paper = [230, 215, 170];
  const g = computeGain(paper);
  assert.ok(g[2] > g[0]);
  const fixed = paper.map((v, k) => toLinear(v) * g[k]);
  assert.ok(Math.abs(fixed[0] - fixed[2]) < 1e-6 && Math.abs(fixed[0] - fixed[1]) < 1e-6);
  assert.match(describeCast(g), /노랗게/);
});

test('노출을 고정하면 밝기도 기준 흰색에 맞춘다', () => {
  const g = computeGain([120, 120, 120], { exposureLocked: true });
  assert.ok(Math.abs(toLinear(120) * g[0] - toLinear(235)) < 1e-6);
  const g2 = computeGain([120, 120, 120]);
  assert.deepEqual(g2.map((v) => Math.round(v * 1000)), [1000, 1000, 1000]);
});

test('측정 칸 검사', () => {
  assert.equal(checkSample({ mean: [220, 215, 205], std: 5 }), null);
  assert.equal(checkSample({ mean: [30, 30, 30], std: 5 }), 'dark');
  assert.equal(checkSample({ mean: [254, 254, 254], std: 1 }), 'bright');
  assert.equal(checkSample({ mean: [200, 200, 200], std: 40 }), 'uneven');
  assert.equal(checkSample({ mean: [220, 40, 40], std: 5 }), 'colored');
});

test('코드 C1 주고받기, 잘못된 코드는 null', () => {
  const o = { gain: [0.9, 1, 1.3], exposureLocked: true, lock: { wb: true, colorTemperature: 4500 }, raw: [230, 215, 170], at: '2026-11-20T00:00:00.000Z' };
  const code = encodeCode(o);
  assert.match(code, /^C1\./);
  assert.deepEqual(decodeCode(code), o);
  assert.equal(decodeCode('C1.###'), null);
  assert.equal(decodeCode('T1.abc'), null);
  assert.equal(encodeCode({ gain: [100, 1, 1] }), null);
});
