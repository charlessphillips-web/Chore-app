import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPostcode, normalisePostcode } from './postcode.ts';

test('postcodes', () => {
  assert.equal(normalisePostcode(' ls61ab '), 'LS6 1AB');
  assert.equal(normalisePostcode('sw1a 1aa'), 'SW1A 1AA');
  assert.equal(normalisePostcode('M1 1AE'), 'M1 1AE');
  assert.ok(isValidPostcode('ls6 1ab'));
  assert.ok(isValidPostcode('EC1A1BB'));
  assert.ok(!isValidPostcode('LS6'));
  assert.ok(!isValidPostcode('12345'));
  assert.ok(!isValidPostcode('hello'));
});
