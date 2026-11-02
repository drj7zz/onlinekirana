const test = require('node:test');
const assert = require('node:assert/strict');
const { editDistance, fuzzyPattern, relevanceScore } = require('../lib/productSearch');

test('fuzzy candidates include common missing, repeated, and transposed characters', () => {
  for (const [query, product] of [['milk2', 'Milk'], ['milkk', 'Milk'], ['onin', 'Onion'], ['onoin', 'Onion']]) {
    const pattern = new RegExp(fuzzyPattern(query), 'i');
    assert.equal(pattern.test(product), true, `${query} should match ${product}`);
    assert.equal(relevanceScore({ name: product, stock: 5 }, [query]), 15);
  }
});

test('fuzzy candidate search does not turn a first-character mismatch into a match', () => {
  assert.equal(new RegExp(fuzzyPattern('milk'), 'i').test('Silk'), false);
  assert.equal(relevanceScore({ name: 'Silk', stock: 5 }, ['milk']), 0);
});

test('search punctuation is treated literally instead of throwing a regular expression error', () => {
  assert.doesNotThrow(() => relevanceScore({ name: 'Milk', stock: 5 }, ['*']));
  assert.equal(new RegExp(fuzzyPattern('.*'), 'i').test('Milk'), false);
});

test('bounded Damerau-Levenshtein distance recognizes adjacent transpositions', () => {
  assert.equal(editDistance('onoin', 'onion', 1), 1);
  assert.equal(editDistance('milk', 'silk', 1), 1);
});
