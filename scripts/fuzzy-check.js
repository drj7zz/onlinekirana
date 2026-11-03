const cases = [
  ['milkk', ['Milk'], ['Silk', 'Butter']],
  ['onin', ['Onion', 'Red Onion Big'], ['Milk']],
  ['chickn', ['Chicken', 'Chicken Curry Cut'], ['Milk']],
  ['mlk', ['Milk'], ['Butter']],
  ['rice', ['Rice Basmati', 'Chamal Rice'], ['Milk']],
];
let fail = 0;
for (const [q, shouldHit, shouldMiss] of cases) {
  const collapsed = q.toLowerCase().replace(/(.)\1+/g, '$1');
  const chars = collapsed.split('').map((c) => `${c}.{0,2}?`).join('');
  const rx = new RegExp(chars.slice(0, chars.length - '.{0,2}?'.length), 'i');
  for (const n of shouldHit) { if (!rx.test(n)) { console.log('MISS', q, n, rx.source); fail++; } }
  for (const n of shouldMiss) { if (rx.test(n)) { console.log('FALSE-POSITIVE', q, n, rx.source); fail++; } }
}
console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILURES`);
