// File: onlinekirana/_logo-tool.mjs
// One-off asset tool: the source logo PNG is 512x512 with huge white margins,
// which is why it renders as a tiny stamp inside every container. Trim the white
// border, pad it back out with a small uniform margin, and emit a compact logo.
//
// Run from the repo root:  npm run logo     (or: node _logo-tool.mjs)
import sharp from 'sharp';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolve paths relative to this file so the tool works from anywhere.
const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'logo.png');

// The master asset in the repo root is overwritten by this script, so running it
// twice would trim the padding it just added and silently shrink the mark. Keep a
// pristine copy of the source and always trim from that, never from the output.
const ORIGINAL = join(ROOT, 'logo.original.png');
if (!existsSync(ORIGINAL)) {
  copyFileSync(SRC, ORIGINAL);
  console.log('backed up source ->', 'logo.original.png');
}
const sourcePath = ORIGINAL;

// If a previous run already overwrote logo.png with a trimmed master, restore the
// original first so this run trims the true source again.
copyFileSync(ORIGINAL, SRC);

const meta = await sharp(sourcePath).metadata();
console.log('source  ', `${meta.width}x${meta.height}`);

const trimmed = await sharp(sourcePath).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
console.log('trimmed ', `${trimmed.info.width}x${trimmed.info.height}`);

// Pad the trimmed art back out on a transparent canvas so the mark keeps its
// aspect ratio and is no longer dwarfed by empty margins. The canvas must fit the
// art in BOTH axes: the trim box is 467x482 (taller than it is wide), so squaring
// it to max(w, h) would clip the sides of the wordmark. Scale the padding off the
// trimmed area rather than off one edge, so it stays uniform and size-independent.
const { width: cw, height: ch } = trimmed.info;
const pad = Math.round(Math.max(cw, ch) * 0.06);
const canvasW = cw + pad * 2;
const canvasH = ch + pad * 2;
console.log('canvas  ', `${canvasW}x${canvasH} (${pad}px padding)`);

async function emit(out, size) {
  const canvas = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed.data, left: pad, top: pad }])
    .png()
    .toBuffer();
  // `fit: contain` letterboxes the padded canvas into a square transparent frame,
  // so all three logos are the same 1:1 footprint without distorting the art.
  await sharp(canvas)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('wrote   ', out.replace(ROOT + '\\', '').replace(ROOT + '/', ''), `${size}x${size}`);
}

// Every logo.png consumer in the repo. The root copy is the master asset.
for (const dir of ['client/public', 'partners/public']) {
  mkdirSync(join(ROOT, dir), { recursive: true });
}
await emit(join(ROOT, 'client/public/logo.png'), 256);   // navbar + favicon
await emit(join(ROOT, 'partners/public/logo.png'), 256); // partner dashboard navbar
await emit(SRC, 512);                                    // master asset kept in the repo root