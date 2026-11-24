import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailProblem, looksLikeEmail, suggestEmail } from './emailCheck.ts';

test('typos get a suggestion', () => {
  assert.equal(suggestEmail('Fabio@Gmial.com '), 'fabio@gmail.com');
  assert.equal(suggestEmail('fabio@hotmail.co'), 'fabio@hotmail.co.uk');
  assert.equal(suggestEmail('fabio@exeter.ac.u'), 'fabio@exeter.ac.uk');
  assert.equal(suggestEmail('fabio@something.con'), 'fabio@something.com');
  assert.equal(suggestEmail('fabio@gmail.com'), null);
  assert.equal(suggestEmail('fabio@exeter.ac.uk'), null);
});

test('not an email, or throwaway', () => {
  assert.equal(looksLikeEmail('fabio'), false);
  assert.equal(looksLikeEmail('fabio@gmail'), false);
  assert.equal(looksLikeEmail('fabio @gmail.com'), false);
  assert.ok(emailProblem('fabio'));
  assert.ok(emailProblem('x@mailinator.com'));
  assert.equal(emailProblem('fabio@gmail.com'), null);
});
