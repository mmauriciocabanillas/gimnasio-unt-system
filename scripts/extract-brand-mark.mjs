/* Recorte determinista del original amarillo/azul: no genera ni redibuja formas. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const [input, output, sharpPath = 'sharp'] = process.argv.slice(2);
if (!input || !output) throw new Error('Uso: node scripts/extract-brand-mark.mjs original.png salida.png [ruta-al-modulo-sharp]');
const sharp = createRequire(import.meta.url)(sharpPath);
const { data, info } = await sharp(resolve(input)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);
let visible = 0;
for (let pixel = 0; pixel < info.width * info.height; pixel++) {
  const offset = pixel * info.channels;
  const [r, g, b] = data.subarray(offset, offset + 3);
  // El azul tiene R-B negativo; el amarillo, muy positivo. Solo la transición
  // antialias se vuelve semitransparente. El núcleo conserva sus colores originales.
  const alpha = Math.round(Math.max(0, Math.min(1, (r - b - 20) / 140)) * 255);
  const target = pixel * 4;
  if (alpha) {
    rgba[target] = alpha === 255 ? r : 250;
    rgba[target + 1] = alpha === 255 ? g : 198;
    rgba[target + 2] = alpha === 255 ? b : 25;
    rgba[target + 3] = alpha;
    visible++;
  }
}
if (!visible) throw new Error('No se encontró el emblema amarillo.');
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(resolve(output));
console.log(JSON.stringify({ width: info.width, height: info.height, visible, output }));
