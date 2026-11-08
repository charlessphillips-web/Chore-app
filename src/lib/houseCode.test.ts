import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateHouseCode, normaliseHouseCode, CODE_ALPHABET, CODE_LENGTH } from './houseCode.ts';
import { choreKey } from './chores.ts';

test('generated codes are the right length and alphabet', () => {
  for (let i = 0; i < 500; i++) {
    const c = generateHouseCode();
    assert.equal(c.length, CODE_LENGTH);
    for (const ch of c) assert.ok(CODE_ALPHABET.includes(ch));
  }
});

test('normalise accepts messy input and rejects bad codes', () => {
  assert.equal(normaliseHouseCode(' abc-def '), 'ABCDEF');
  assert.equal(normaliseHouseCode('ABC DE2'), 'ABCDE2');
  assert.equal(normaliseHouseCode('ABCDE'), null);
  assert.equal(normaliseHouseCode('ABCDE0'), null); // 0 not allowed
});

test('choreKey groups the same chore', () => {
  assert.equal(choreKey('  Take OUT   bins '), 'take out bins');
});

test('choreKey strips characters that would break Firestore field paths', () => {
  assert.equal(choreKey('Clean the fridge!!'), 'clean the fridge');
  assert.equal(choreKey('Buy loo roll (x2).'), 'buy loo roll x2');
});
