/* Solo conversión/redimensionado de una imagen que ya tiene transparencia. */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [input, sharpPath = 'sharp'] = process.argv.slice(2);
if (!input) throw new Error('Uso: node scripts/prepare-brand-assets.mjs imagen-transparente.png [ruta-al-modulo-sharp]');
const sharp = createRequire(import.meta.url)(sharpPath);
const source = sharp(resolve(input));
const metadata = await source.metadata();
if (!metadata.hasAlpha) throw new Error('Se requiere el recorte con transparencia, no el original azul.');
const outputs = [
  ['logo-mark.webp', 384, 'webp'],
  ['logo-mark-small.webp', 96, 'webp'],
  ['favicon.webp', 64, 'webp'],
];
for (const [name, size, format] of outputs) {
  const result = await source.clone().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })[format]({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(resolve('public', name));
  console.log(name, result.size, 'bytes');
}
const png = await source.clone().resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = 32; ico[7] = 32;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(resolve('public/favicon.ico'), Buffer.concat([ico, png]));
console.log('favicon.ico', ico.length + png.length, 'bytes');
