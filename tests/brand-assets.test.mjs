import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/template.css', import.meta.url), 'utf8');

test('marca usa WebP pequeño y no carga el logo antiguo con fondo azul', () => {
  assert.ok(!main.includes('/logo.webp'));
  assert.ok(main.includes('/logo-mark-small.webp'));
  assert.ok(main.includes('/logo-mark.webp'));
  assert.ok(css.includes('background: transparent; object-fit: contain; flex: 0 0 auto;'));
});
test('todos los WebP de marca tienen transparencia y presupuesto de tamaño', async () => {
  for (const [name, maxBytes] of [['logo-mark.webp', 50000], ['logo-mark-small.webp', 10000], ['favicon.webp', 5000]]) {
    const bytes = await readFile(new URL('../public/' + name, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < maxBytes, `${name}: ${bytes.length} bytes`);
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
    assert.ok(bytes[20] & 16, `${name} debe conservar el canal alfa`);
  }
});
test('favicon declarado con WebP y compatibilidad ICO válido de 32 píxeles', async () => {
  assert.ok(html.includes('href="/favicon.webp"'));
  assert.ok(html.includes('href="/favicon.ico"'));
  const ico = await readFile(new URL('../public/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 1);
  assert.equal(ico[6], 32); assert.equal(ico[7], 32);
  assert.equal(ico.readUInt32LE(18), 22);
  assert.equal(ico.readUInt32LE(14), ico.length - 22);
  assert.equal(ico.toString('ascii', 23, 26), 'PNG');
});
test('engranaje usa contorno dentro del viewBox y centro correcto', () => {
  const setting = main.split('\n').find(line => line.includes('configuracion:') && line.includes('<path'));
  assert.ok(setting.includes('cx="12" cy="12" r="3.2"'));
  const path = setting.match(/d="([^"]+)"/)[1];
  const coords = path.match(/\d+(?:\.\d+)?/g).map(Number);
  assert.ok(coords.every(n => n >= 2 && n <= 22));
});
