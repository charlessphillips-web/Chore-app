import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPayChoice, formatPrice, normalisePayLink, parsePrice, payUrl, priceError } from './money.ts';

test('prices', () => {
  assert.equal(parsePrice('3'), 300);
  assert.equal(parsePrice('£3.50'), 350);
  assert.equal(parsePrice(' 3.5 '), 350);
  assert.equal(parsePrice('0.5'), 50);
  assert.equal(parsePrice('0.10'), null);
  assert.equal(parsePrice('51'), null);
  assert.equal(parsePrice('3.555'), null);
  assert.equal(parsePrice('three'), null);
  assert.equal(priceError(''), 'Enter a price.');
  assert.equal(priceError('2'), null);
  assert.equal(formatPrice(300), '£3');
  assert.equal(formatPrice(350), '£3.50');
  assert.equal(formatPrice(5), '£0.05');
});

test('payment links', () => {
  assert.equal(normalisePayLink(''), null);
  assert.equal(normalisePayLink('monzo.me/charlie'), 'https://monzo.me/charlie');
  assert.equal(normalisePayLink('https://Monzo.me/Charlie.P/'), 'https://monzo.me/Charlie.P');
  assert.equal(normalisePayLink('www.paypal.me/sam_99'), 'https://paypal.me/sam_99');
  assert.deepEqual(normalisePayLink('https://evil.com/monzo.me/x'), { error: 'Use your monzo.me or paypal.me link, e.g. monzo.me/yourname' });
  assert.equal(payUrl('https://monzo.me/sam', 350, 'Bins'), 'https://monzo.me/sam/3.50?d=Bins');
  assert.equal(payUrl('https://paypal.me/sam', 300, 'Bins'), 'https://paypal.me/sam/3.00GBP');
});

test('pay choice per deal', () => {
  assert.deepEqual(checkPayChoice('cash', 'whatever'), { method: 'cash', link: null });
  assert.deepEqual(checkPayChoice('monzo', 'monzo.me/sam'), { method: 'monzo', link: 'https://monzo.me/sam' });
  assert.deepEqual(checkPayChoice('monzo', ''), { error: 'Add your Monzo link, e.g. monzo.me/yourname' });
  assert.deepEqual(checkPayChoice('paypal', 'monzo.me/sam'), { error: "That's not a PayPal link." });
});
