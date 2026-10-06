import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoute } from '../src/routes.js';

test('registro y asistencia se reconocen con o sin barra final', () => {
  for (const route of ['/registro', '/asistencia', '/panel', '/qr']) {
    assert.equal(normalizeRoute(route), route);
    assert.equal(normalizeRoute(route + '/'), route);
    assert.equal(normalizeRoute(route + '//'), route);
  }
  assert.equal(normalizeRoute('/'), '/'); assert.equal(normalizeRoute('///'), '/');
});
