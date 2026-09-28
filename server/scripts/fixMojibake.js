/**
 * One-off repair: several source files were written by PowerShell with the wrong
 * encoding, so multi-byte characters were double-encoded and render as garbage
 * (an em dash becomes a run of odd glyphs, the rupee sign becomes several).
 *
 * The mapping is built from explicit code points, never from typed characters,
 * because writing the damaged bytes literally would re-create the corruption.
 * The runs were dumped from the actual files rather than guessed.
 *
 *   node scripts/fixMojibake.js          # dry run, lists affected files
 *   node scripts/fixMojibake.js --apply  # rewrite them in UTF-8
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

const seq = (...codes) => String.fromCharCode(...codes);

// [damaged run, intended character]
const FIXES = [
  // --- single-encoded runs (lead U+00E2 / U+00C2) ---
  [seq(0x00e2, 0x2020, 0x2014), seq(0x2197)], // north-east arrow
  [seq(0x00e2, 0x0086, 0x0092), seq(0x2192)], // right arrow
  [seq(0x00e2, 0x0084, 0x009a), seq(0x2192)], // right arrow
  [seq(0x00e2, 0x0080, 0x0094), seq(0x2014)], // em dash
  [seq(0x00e2, 0x0080, 0x0093), seq(0x2013)], // en dash
  [seq(0x00e2, 0x0080, 0x0091), seq(0x2018)], // left single quote
  [seq(0x00e2, 0x0080, 0x0099), seq(0x2019)], // right single quote
  [seq(0x00e2, 0x0080, 0x009c), seq(0x201c)], // left double quote
  [seq(0x00e2, 0x0080, 0x009d), seq(0x201d)], // right double quote
  [seq(0x00e2, 0x0080, 0x00a6), seq(0x2026)], // ellipsis
  [seq(0x00e2, 0x0080, 0x00a0), ' '],          // non-breaking space
  [seq(0x00e2, 0x20ac, 0x2014), seq(0x2014)], // em dash
  [seq(0x00e2, 0x20ac, 0x2013), seq(0x2013)], // en dash
  [seq(0x00e2, 0x20ac, 0x2019), seq(0x2019)], // right single quote
  [seq(0x00e2, 0x20ac, 0x201c), seq(0x201c)], // left double quote
  [seq(0x00e2, 0x20ac, 0x201d), seq(0x201d)], // right double quote
  [seq(0x00e2, 0x20ac, 0x2122), seq(0x2019)], // right single quote
  [seq(0x00c2, 0x00b7), seq(0x00b7)],          // middle dot
  [seq(0x00c2, 0x00b0), seq(0x00b0)],          // degree sign
  [seq(0x00c2, 0x00a0), ' '],                 // non-breaking space

  // --- double-encoded runs (lead U+00C3) ---
  [seq(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00c2, 0x00a6), seq(0x2026)], // ellipsis
  [seq(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x20ac, 0x009d), seq(0x2014)], // em dash
  [seq(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x20ac, 0x009c), seq(0x2013)], // en dash
  [seq(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x20ac, 0x0099), seq(0x2019)], // right single quote
  [seq(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x20ac, 0x009c), seq(0x201c)], // left double quote
  [seq(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x20ac, 0x009d), seq(0x201d)], // right double quote
  [seq(0x00c3, 0x201a, 0x00b7), seq(0x00b7)],          // middle dot
  [seq(0x00c2, 0x00a5, 0x00e2, 0x20ac, 0x0161), seq(0x20b9)], // rupee sign
  [seq(0x00c2, 0x00a4, 0x00b0, 0x00c3), seq(0x0930)], // rupee letter
];

const repair = (text) => {
  let out = text;
  for (const [bad, good] of FIXES) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }
  return out;
};

// Run from the repo root, not from server/ — this script lives in server/scripts.
const ROOT = path.resolve(__dirname, '..', '..');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') walk(p);
    } else if (/\.(jsx|js|css|html)$/.test(entry.name)) {
      files.push(p);
    }
  }
})(ROOT);

const rel = (f) => path.relative(ROOT, f);

let touched = 0;
for (const file of files) {
  if (!/^(client|partners)[\\/]src[\\/]/.test(rel(file))) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = repair(before);
  if (after !== before) {
    touched++;
    console.log(`${APPLY ? 'fixed     ' : 'would fix '} ${rel(file)}`);
    if (APPLY) fs.writeFileSync(file, after, 'utf8');
  }
}

console.log(`\n${touched} file(s) ${APPLY ? 'rewritten' : 'need fixing'}.`);
if (!APPLY && touched) console.log('Re-run with --apply to write them.');
