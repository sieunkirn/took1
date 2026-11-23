// 카드 담기 저장소 (src/lib/basket-store.js, 2026-11-23)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBasketStore, normalizeCard, BASKET_MAX } from '../src/lib/basket-store.js';

test('카드 번호 표기를 하나로 맞춘다', () => {
  assert.equal(normalizeCard('04:37:9d:1a:32:24:90'), '04379D1A322490');
  assert.equal(normalizeCard(' 04 37 9D '), '04379D');
});

test('담기·순서·중복·빼기·비우기', () => {
  const s = createBasketStore();
  s.add('04379D1A322490', 'A');
  s.add('04:37:9d:1a:32:24:90', 'B');
  assert.deepEqual(s.add('04379D1A322490', 'A').items, ['B', 'A']); // 다시 담으면 맨 뒤로
  assert.deepEqual(s.remove('04379D1A322490', 'B').items, ['A']);
  assert.deepEqual(s.remove('04379D1A322490').items, []);
  assert.deepEqual(s.get('04379D1A322490').items, []);
});

test('리더기가 글자를 흘린 번호도 같은 카드로 찾는다 (딱 하나일 때만)', () => {
  const s = createBasketStore();
  s.add('04379D1A322490', 'A');
  assert.equal(s.get('0437D1A32490').card, '04379D1A322490');
  assert.deepEqual(s.get('0437D1A32490').items, ['A']);
  s.add('04379D1A322491', 'B');
  assert.deepEqual(s.get('0437D1A3249').items, []); // 두 카드 다 맞으면 모른다고 한다
});

test(`카드 하나에 ${BASKET_MAX}개까지`, () => {
  const s = createBasketStore();
  for (let i = 0; i < BASKET_MAX + 5; i++) s.add('CARD0001', 'P' + i);
  const items = s.get('CARD0001').items;
  assert.equal(items.length, BASKET_MAX);
  assert.equal(items.at(-1), 'P' + (BASKET_MAX + 4));
});
