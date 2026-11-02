const FUZZY_BONUS = 15;
const WORD_SPLIT = /[^a-z0-9]+/;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const editDistance = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return Infinity;
  let twoBack = null;
  let prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1);
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], twoBack[j - 2] + 1);
      }
    }
    twoBack = prev;
    prev = cur;
  }
  return prev[b.length];
};

const fuzzyWordMatch = (haystack, word, maxEdits) =>
  String(haystack).toLowerCase().split(WORD_SPLIT).some((candidate) =>
    candidate.length > 2
    && candidate[0] === word[0]
    && editDistance(word, candidate, maxEdits) <= maxEdits);

const fuzzyPattern = (word) => {
  const term = String(word).toLowerCase().replace(/(.)\1+/g, '$1');
  if (term.length < 2 || term.length > 24) return null;

  const maxEdits = term.length >= 5 ? 2 : 1;
  const variants = new Set([term]);
  let frontier = [term];
  for (let edits = 0; edits < maxEdits; edits++) {
    const next = [];
    for (const variant of frontier) {
      for (let index = 1; index < variant.length; index++) {
        const shortened = `${variant.slice(0, index)}${variant.slice(index + 1)}`;
        if (!variants.has(shortened)) {
          variants.add(shortened);
          next.push(shortened);
        }
      }
      for (let index = 1; index < variant.length - 1; index++) {
        const swapped = `${variant.slice(0, index)}${variant[index + 1]}${variant[index]}${variant.slice(index + 2)}`;
        if (!variants.has(swapped)) {
          variants.add(swapped);
          next.push(swapped);
        }
      }
    }
    frontier = next;
  }

  const alternatives = [...variants].map((variant) => [...variant]
    .map((character, index) => `${index ? '.{0,2}?' : ''}${escapeRegex(character)}`)
    .join(''));
  return `(?:${alternatives.join('|')})`;
};

const relevanceScore = (product, terms) => {
  const name = String(product.name || '').toLowerCase();
  const category = String(product.category || '').toLowerCase();
  const query = terms.join(' ');
  let score = 0;
  if (name === query) score = 100;
  else if (name.startsWith(query)) score = 80;
  else if (terms.some((term) => new RegExp(`(^|\\s)${escapeRegex(term)}`).test(name))) score = 60;
  else if (name.includes(query)) score = 40;
  else if (category.includes(query) || terms.some((term) => category.includes(term))) score = 20;

  if (!score && terms.some((term) => fuzzyWordMatch(name, term, term.length >= 5 ? 2 : 1))) {
    score = FUZZY_BONUS;
  }
  if (!score) return 0;

  const shopName = String(product.merchant?.shopName || '').toLowerCase();
  if (shopName && (shopName.includes(query) || terms.some((term) => shopName.includes(term)))) score += 4;
  if ((product.stock || 0) <= 0) score -= 5;
  return score;
};

const isFuzzyOnly = (product, terms) => {
  const name = String(product.name || '').toLowerCase();
  const category = String(product.category || '').toLowerCase();
  const query = terms.join(' ');
  const literal = name.includes(query)
    || terms.some((term) => name.includes(term) || category.includes(term));
  return !literal;
};

module.exports = { fuzzyPattern, relevanceScore, isFuzzyOnly, editDistance };
