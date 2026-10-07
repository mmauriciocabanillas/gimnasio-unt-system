import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../server/api.mjs';
import { createSession, hashPassword, readSession, sessionCookie, verifyPassword } from '../server/auth.mjs';
import { signedEnvelope, HttpError } from '../server/bridge.mjs';
import { createHmac } from 'node:crypto';

const env = { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/example/exec', APPS_SCRIPT_SECRET: 'a'.repeat(32), SESSION_SECRET: 'b'.repeat(32) };
const hash = hashPassword('Password1');
async function call(path, method = 'GET', body, invoke, cookie, headers = {}) {
  const req = { url: path, method, body, headers: { host: 'localhost:3180', ...(method === 'POST' ? { origin: 'http://localhost:3180' } : {}), ...(cookie ? { cookie } : {}), ...headers } };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } };
  await handleApi(req, res, { env, invoke: invoke || (async () => ({ hash, version: 1 })) }); return res;
}
test('hash scrypt compara sin guardar contraseña en claro', () => {
  assert.ok(verifyPassword('Password1', hash)); assert.ok(!verifyPassword('Wrong', hash)); assert.ok(!hash.includes('Password1'));
});
test('sesión firmada: no acepta modificación ni vencimiento', () => {
  const token = createSession('ProfesorGYM', 1, env.SESSION_SECRET, 1000);
  assert.equal(readSession(token, env.SESSION_SECRET, 2000).user, 'ProfesorGYM');
  assert.equal(readSession(token + 'x', env.SESSION_SECRET, 2000), null);
  assert.equal(readSession(token, env.SESSION_SECRET, 1000 + 8 * 3600000), null);
  assert.match(sessionCookie(token), /HttpOnly; SameSite=Strict/);
});
test('panel requiere sesión', async () => { const r = await call('/api/panel'); assert.equal(r.statusCode, 401); });
test('diagnóstico de activadores requiere sesión y usa exclusivamente identidad de cookie', async () => {
  assert.equal((await call('/api/automation')).statusCode, 401);
  for (const user of ['ProfesorGYM','Administrador']) {
    const seen = [], cookie = `gym_session=${createSession(user, 1, env.SESSION_SECRET)}`;
    const r = await call('/api/automation?actor=intruso&version=999', 'GET', undefined, async (action, data) => { seen.push({ action, data }); return {}; }, cookie);
    assert.equal(r.statusCode, 200); assert.deepEqual(seen, [{ action: 'automation.status', data: { actor: user, version: 1 } }]);
  }
});
test('ambos usuarios tienen acceso al mismo panel y acciones', async () => {
  for (const user of ['ProfesorGYM', 'Administrador']) {
    const session = `gym_session=${createSession(user, 1, env.SESSION_SECRET)}`;
    const seen = []; const r = await call('/api/closure', 'POST', { date: '2026-10-05', actor: 'intruso', version: 100 }, async (action, data) => { seen.push({ action, data }); return action === 'account.get' ? { hash, version: 1 } : { ok: true }; }, session);
    assert.equal(r.statusCode, 200); assert.equal(seen.length, 1); assert.equal(seen[0].data.actor, user); assert.equal(seen[0].data.version, 1);
  }
});
test('cambio persistente de versión revoca una sesión antigua', async () => {
  const session = `gym_session=${createSession('Administrador', 1, env.SESSION_SECRET)}`;
  const r = await call('/api/me', 'GET', undefined, async () => ({ hash, version: 2 }), session); assert.equal(r.statusCode, 401);
});

test('panel hace una sola consulta con la cuenta y versión de la cookie verificada', async () => {
  const session = `gym_session=${createSession('Administrador', 1, env.SESSION_SECRET)}`;
  const seen = [];
  const r = await call('/api/panel?shift=TODO', 'GET', undefined, async (action, data) => { seen.push({ action, data }); return { students: [] }; }, session);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(seen, [{ action: 'panel', data: { actor: 'Administrador', version: 1, shift: 'TODO' } }]);
});

test('panel propaga la revocación de sesión comprobada por Apps Script', async () => {
  const session = `gym_session=${createSession('Administrador', 1, env.SESSION_SECRET)}`;
  const r = await call('/api/panel', 'GET', undefined, async () => { throw new HttpError('La sesión venció.', 401); }, session);
  assert.equal(r.statusCode, 401);
});
test('login valida del lado servidor y genera cookie, sin devolver hashes', async () => {
  const r = await call('/api/login', 'POST', { user: 'ProfesorGYM', password: 'Password1' });
  assert.equal(r.statusCode, 200); assert.equal(r.body.user, 'ProfesorGYM'); assert.match(r.headers['Set-Cookie'], /gym_session=/); assert.equal(r.body.hash, undefined);
});
test('login rechaza contraseña incorrecta', async () => { const r = await call('/api/login', 'POST', { user: 'ProfesorGYM', password: 'Wrong' }); assert.equal(r.statusCode, 401); });

test('Profesor ingresa con nombre nuevo conservando identidad, permisos e historial', async () => {
  let sent;
  const r = await call('/api/login', 'POST', { user: 'Profesor', password: 'Password1' }, async (action, data) => { sent = { action, data }; return { hash, version: 2 }; });
  assert.equal(r.statusCode, 200);
  assert.equal(sent.action, 'account.get'); assert.equal(sent.data.user, 'ProfesorGYM');
  const token = r.headers['Set-Cookie'].split(';')[0].slice('gym_session='.length);
  const session = readSession(token, env.SESSION_SECRET);
  assert.equal(session.user, 'ProfesorGYM'); assert.equal(session.version, 2);
  assert.equal(r.body.hash, undefined);
});

test('Profesor con contraseña incorrecta no recibe una sesión', async () => {
  const r = await call('/api/login', 'POST', { user: 'Profesor', password: 'Wrong' });
  assert.equal(r.statusCode, 401); assert.equal(r.headers['Set-Cookie'], undefined);
});
test('no admite POST desde otra web', async () => { const r = await call('/api/login', 'POST', {}, undefined, undefined, { origin: 'https://otra-web.example' }); assert.equal(r.statusCode, 403); });
test('registro público no puede reenviar actor ni timestamp del cliente', async () => {
  let sent;
  const r = await call('/api/register', 'POST', { code: '0000000001', method: 'CARNET', actor: 'Administrador', timestamp: '2020-01-01', names: 'José', slots: [] }, async (action, data) => { sent = data; return { ok: true }; });
  assert.equal(r.statusCode, 200); assert.equal(sent.actor, undefined); assert.equal(sent.timestamp, undefined);
});
test('firma HMAC verifica exactamente payload, timestamp y nonce', () => {
  const envelope = signedEnvelope('attend', { code: '0000000001' }, env.APPS_SCRIPT_SECRET);
  assert.equal(envelope.signature, createHmac('sha256', env.APPS_SCRIPT_SECRET).update(`${envelope.timestamp}.${envelope.nonce}.${envelope.payload}`).digest('hex'));
});
test('rewrite de Vercel conserva ruta y filtros', async () => {
  const session = `gym_session=${createSession('Administrador', 1, env.SESSION_SECRET)}`;
  let sent;
  const r = await call('/api/index?route=panel&shift=TARDE', 'GET', undefined, async (action, data) => { if (action === 'account.get') return { hash, version: 1 }; sent = data; return {}; }, session);
  assert.equal(r.statusCode, 200); assert.equal(sent.shift, 'TARDE');
});

test('estado diferencia configuración local de salud remota', async () => {
  const r = await call('/api/status');
  assert.equal(r.body.configured, true); assert.equal(r.body.health, 'not_checked');
});

test('identidad del limitador es del servidor, no del cuerpo público', async () => {
  let sent;
  await call('/api/attend', 'POST', { code: '0000000001', method: 'CARNET', _rate: 'intruso' }, async (_, data) => { sent = data; return {}; });
  assert.match(sent._rate, /^[a-f0-9]{64}$/); assert.notEqual(sent._rate, 'intruso');
});
