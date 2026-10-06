import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bridge, HttpError, configured } from '../server/bridge.mjs';

const env = { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', APPS_SCRIPT_SECRET: 'a'.repeat(32), SESSION_SECRET: 'b'.repeat(32) };
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

test('estado configurado exige URL /exec válida además de los secretos', () => {
  assert.equal(configured(env), true);
  for (const url of ['', 'http://example.com', 'https://script.google.com/macros/s/test/dev']) assert.equal(configured({ ...env, APPS_SCRIPT_URL: url }), false);
});

test('lectura reintenta HTML temporal con un nonce nuevo y conserva la firma privada', async () => {
  const requests = [];
  const result = await bridge('public.config', {}, env, { fetchImpl: async (_, options) => {
    requests.push(JSON.parse(options.body));
    return requests.length === 1 ? new Response('Google temporal', { status: 404 }) : json({ ok: true, data: { period: '2026-10' } });
  } });
  assert.equal(result.period, '2026-10');
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].nonce, requests[1].nonce);
  assert.equal(requests[0].payload, requests[1].payload);
  assert.ok(!JSON.stringify(requests).includes(env.APPS_SCRIPT_SECRET));
});

test('lecturas reintentan fallos de red solo una vez', async () => {
  let calls = 0;
  await assert.rejects(bridge('account.get', { user: 'Administrador' }, env, { fetchImpl: async () => { calls++; throw new Error('network'); } }), e => e instanceof HttpError && e.status === 504);
  assert.equal(calls, 2);
});

test('respuestas de negocio y autorización no se reintentan', async () => {
  for (const status of [401, 409, 503]) {
    let calls = 0;
    await assert.rejects(bridge('panel', {}, env, { fetchImpl: async () => { calls++; return json({ ok: false, status, error: 'Rechazado' }); } }), e => e.status === status);
    assert.equal(calls, 1);
  }
});

test('ninguna escritura ni exportación se repite ante fallos ambiguos', async () => {
  for (const action of ['register', 'attend', 'closure', 'schedule', 'configure', 'account.change', 'initialize', 'export']) {
    for (const network of [false, true]) {
      let calls = 0;
      await assert.rejects(bridge(action, {}, env, { fetchImpl: async () => { calls++; if (network) throw new Error('network'); return new Response('HTML', { status: 404 }); } }), e => e.status === (network ? 504 : 502));
      assert.equal(calls, 1, action);
    }
  }
});

test('el 405 de doGet después del POST se reintenta solamente en lecturas', async () => {
  for (const action of ['panel', 'attend']) {
    let calls = 0;
    const promise = bridge(action, {}, env, { fetchImpl: async () => {
      calls++;
      return calls === 1 ? json({ ok: false, status: 405, error: 'Este endpoint solo admite solicitudes firmadas del servidor.' }) : json({ ok: true, data: {} });
    } });
    if (action === 'panel') { await promise; assert.equal(calls, 2); }
    else { await assert.rejects(promise, e => e.status === 502); assert.equal(calls, 1); }
  }
});

test('un presupuesto agotado no llama a Google', async () => {
  let calls = 0;
  await assert.rejects(bridge('panel', {}, env, { deadline: Date.now() - 1, fetchImpl: async () => { calls++; return json({ ok: true }); } }), e => e.status === 504);
  assert.equal(calls, 0);
});
