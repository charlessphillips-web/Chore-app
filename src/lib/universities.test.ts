import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchUniversities, UNIVERSITIES } from './universities.ts';

test('no duplicates in the list', () => {
  assert.equal(new Set(UNIVERSITIES).size, UNIVERSITIES.length);
});

test('typing the start of a city finds its universities', () => {
  const r = searchUniversities('leed');
  assert.equal(r[0], 'University of Leeds');
  assert.ok(r.includes('Leeds Beckett University'));
  assert.ok(r.includes('Leeds Trinity University'));
});

test('short names and abbreviations', () => {
  assert.equal(searchUniversities('UCL')[0], 'University College London');
  assert.equal(searchUniversities('lse')[0], 'London School of Economics and Political Science');
  assert.equal(searchUniversities('kcl')[0], "King's College London");
  assert.equal(searchUniversities('man met')[0], 'Manchester Metropolitan University');
  assert.equal(searchUniversities('kings')[0], "King's College London");
});

test('"University of ..." typed in full', () => {
  assert.equal(searchUniversities('university of bri')[0], 'University of Bristol');
  assert.equal(searchUniversities('uni of nott')[0], 'University of Nottingham');
});

test('too short or nonsense gives nothing', () => {
  assert.deepEqual(searchUniversities('l'), []);
  assert.deepEqual(searchUniversities('zzzz'), []);
});

test('only listed universities are allowed, and firestore.rules has the same list', async () => {
  const { ALLOWED_UNIVERSITIES, isAllowedUniversity } = await import('./universities.ts');
  const { readFileSync } = await import('node:fs');
  assert.ok(isAllowedUniversity('University of Exeter'));
  assert.ok(isAllowedUniversity('Other UK university (not listed)'));
  assert.ok(!isAllowedUniversity('exeter'));
  assert.ok(!isAllowedUniversity('Hogwarts'));
  assert.ok(!isAllowedUniversity(''));
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const block = rules.split('// UNIVERSITIES-START')[1].split('// UNIVERSITIES-END')[0];
  const inRules = [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
  assert.deepEqual(inRules, ALLOWED_UNIVERSITIES, 'run: node scripts/sync-universities.mjs');
});
