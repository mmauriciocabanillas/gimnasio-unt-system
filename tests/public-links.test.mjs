import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAppOrigin } from '../src/public-links.js';
import { readFile } from 'node:fs/promises';

test('QR local apunta al dominio público, no al servidor de desarrollo', () => {
  for (const origin of ['http://localhost:3184', 'https://localhost:3184', 'http://127.0.0.1:3184', 'https://[::1]:3184']) {
    assert.equal(publicAppOrigin('', origin), 'https://gimnasiount.vercel.app');
  }
});
test('QR respeta un dominio HTTPS configurado o el dominio publicado actual', () => {
  assert.equal(publicAppOrigin('https://gym.example.com/#ingresar', 'http://localhost:3184'), 'https://gym.example.com');
  assert.equal(publicAppOrigin('', 'https://gimnasiount.vercel.app'), 'https://gimnasiount.vercel.app');
  assert.equal(publicAppOrigin('http://localhost:3184', 'https://gym.example.com'), 'https://gym.example.com');
  assert.equal(publicAppOrigin('javascript:alert(1)', 'http://localhost:3184'), 'https://gimnasiount.vercel.app');
});
test('interfaz usa el mismo destino para enlaces y QR y no presenta notas de desarrollo', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal((main.match(/publicAppOrigin\(status\?\.publicUrl, location\.origin\)/g) || []).length, 2);
  assert.ok(!main.includes('Los QR definitivos'));
  assert.ok(!main.includes("location.hostname === 'localhost'"));
});
