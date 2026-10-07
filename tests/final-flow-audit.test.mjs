import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleHarness } from './helpers/google-harness.mjs';
import { handleApi } from '../server/api.mjs';

const form = (code = '9000000001', slots = [{ day: 1, start: '15:00' }]) => ({ code, slots, method: 'CARNET', names: 'Estudiante', surnames: 'Ficticio Auditoría', faculty: 'Ingeniería', career: 'Informática', cycle: 4 });
function opened() {
  const h = googleHarness('2026-10-01T07:00:00-05:00');
  h.invoke('configure', { actor: 'Administrador', version: 1, days: [1, 2, 3, 4, 5], enabled: true });
  return h;
}
async function api(h, action, body, cookie) {
  const req = { url: '/api/' + action, method: 'POST', body, socket: { remoteAddress: 'qa-audit' }, headers: { host: 'qa.local', origin: 'http://qa.local', ...(cookie ? { cookie } : {}) } };
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(raw) { this.body = JSON.parse(raw); } };
  await handleApi(req, res, { env: h.env, invoke: async (a,d) => h.invoke(a,d) });
  return res;
}
const persisted = h => JSON.stringify(h.context.gymRead_(h.operational()));

for (const method of ['CARNET', 'MANUAL']) {
  test(`API asistencia ${method}: permite horario válido, cierre ajeno no afecta y repetir no duplica`, async () => {
    const h = opened(); h.invoke('register', form()); h.setTime('2026-10-05T15:00:00-05:00');
    h.invoke('closure', { actor: 'Administrador', version: 1, date: '2026-10-05', shift: 'MANANA', closed: true, reason: 'Cierre ficticio solo mañana' });
    const input = { code: '9000000001', method, fullName: 'Estudiante Ficticio Auditoría' };
    const valid = await api(h, 'attend', input); assert.equal(valid.statusCode, 200);
    const repeated = await api(h, 'attend', input); assert.equal(repeated.statusCode, 200); assert.equal(repeated.body.duplicate, true);
    assert.equal(h.context.gymRead_(h.operational()).attendance.length, 1);
  });
  for (const [scenario, time, setup, message] of [
    ['fuera de día', '2026-10-06T15:10:00-05:00', null, /No tienes/],
    ['antes del horario', '2026-10-05T14:59:00-05:00', null, /horario de hoy/],
    ['en otro turno', '2026-10-05T08:10:00-05:00', null, /horario de hoy/],
    ['al terminar el horario', '2026-10-05T16:00:00-05:00', null, /horario de hoy/],
    ['tres faltas', '2026-10-26T15:10:00-05:00', null, /bloqueado/],
    ['cierre del turno', '2026-10-05T15:10:00-05:00', 'TARDE', /cerrado/],
    ['cierre de todo el día', '2026-10-05T15:10:00-05:00', 'TODO', /cerrado/],
  ]) test(`API asistencia ${method}: rechaza ${scenario} sin añadir registros`, async () => {
    const h = opened(); h.invoke('register', form()); h.setTime(time);
    if (setup) h.invoke('closure', { actor: 'Administrador', version: 1, date: '2026-10-05', shift: setup, closed: true, reason: 'Cierre ficticio QA' });
    const before = persisted(h), accounts = [...h.props].filter(([k]) => k.startsWith('ACCOUNT_'));
    const result = await api(h, 'attend', { code: '9000000001', method, fullName: 'Estudiante Ficticio Auditoría' });
    assert.ok(result.statusCode >= 400); assert.match(result.body.error, message);
    assert.equal(persisted(h), before);
    assert.deepEqual([...h.props].filter(([k]) => k.startsWith('ACCOUNT_')), accounts);
  });
}
test('API inscripción y cambio rechazan cuatro y cinco días sin guardar reservas', async () => {
  const h = opened(); h.invoke('register', form());
  const login = await api(h, 'login', { user: 'Administrador', password: h.passwords.Administrador });
  assert.equal(login.statusCode, 200); const cookie = login.headers['Set-Cookie'].split(';')[0];
  for (const count of [4, 5]) {
    const slots = Array.from({ length: count }, (_, i) => ({ day: i + 1, start: '15:00' }));
    const before = persisted(h);
    for (const action of ['register', 'schedule']) {
      const body = action === 'register' ? form('9000000002', slots) : { code: '9000000001', slots, effectiveDate: '2026-10-02' };
      const result = await api(h, action, body, cookie);
      assert.equal(result.statusCode, 400); assert.match(result.body.error, /entre uno y tres/);
      assert.equal(persisted(h), before);
    }
  }
});
test('API último cupo: inscripción y cambio hacia horario lleno no se guardan; cupo propio se conserva', async () => {
  const h = opened();
  for (let i = 0; i < 20; i++) h.invoke('register', form(String(9000000000 + i)));
  h.invoke('register', form('9000000021', [{ day: 2, start: '16:00' }]));
  const login = await api(h, 'login', { user: 'Administrador', password: h.passwords.Administrador });
  const cookie = login.headers['Set-Cookie'].split(';')[0], before = persisted(h);
  const overflow = await api(h, 'register', form('9000000022'));
  assert.equal(overflow.statusCode, 409); assert.equal(persisted(h), before);
  const move = await api(h, 'schedule', { code: '9000000021', effectiveDate: '2026-10-02', slots: [{ day: 1, start: '15:00' }] }, cookie);
  assert.equal(move.statusCode, 409); assert.equal(persisted(h), before);
  const own = await api(h, 'schedule', { code: '9000000001', effectiveDate: '2026-10-02', slots: [{ day: 1, start: '15:00' }] }, cookie);
  assert.equal(own.statusCode, 200);
});
