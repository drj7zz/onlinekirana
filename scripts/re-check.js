// The doubled-last-letter case: "milkk" typed, real word "Milk" (one k).
// After matching m,i,l,k there is no 5th char, so the regex needs the final k
// to be optional — i.e. the LAST char also gets a quantifier, but a bare
// optional char (k.?) rather than a gap (k.{0,2}?), so it can simply not match.
const mk = (w) => {
  const parts = w.split('');
  const last = parts.pop();
  return parts.map((c) => `${c}.{0,2}?`).join('') + `${last}.?`;
};
console.log('milkk', new RegExp(mk('milkk'), 'i').test('Milk'));
console.log('onin', new RegExp(mk('onin'), 'i').test('Onion'));
console.log('chickn', new RegExp(mk('chickn'), 'i').test('Chicken'));
console.log('mlk', new RegExp(mk('mlk'), 'i').test('Milk'));
console.log('silk?', new RegExp(mk('milkk'), 'i').test('Silk'));
console.log('butter?', new RegExp(mk('mlk'), 'i').test('Butter'));
