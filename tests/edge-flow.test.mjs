import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleHarness } from './helpers/google-harness.mjs';

const actor = { actor: 'Administrador', version: 1 };
const form = code => ({ code, names: 'Alumno ficticio', surnames: 'QA', faculty: 'QA', career: 'QA', cycle: 5, method: 'CARNET', slots: [{ day: 1, start: '08:00' }] });
function opened() { const h = googleHarness('2026-10-05T07:00:00-05:00'); h.invoke('configure', { ...actor, days: [1, 2, 3, 4, 5], codePattern: '^[0-9]{10}$', enabled: true }); return h; }
test('inscripciones cerradas y formularios inválidos no escriben ninguna tabla', () => {
  const closed = googleHarness(); closed.invoke('configure', { ...actor, days: [1, 2, 3, 4, 5], enabled: false }); const before = closed.stats.batchWrites;
  assert.equal(closed.request('register', form('0000000001')).status, 503);
  assert.equal(closed.stats.batchWrites, before);
  const h = opened();
  for (const input of [{ ...form('0000000001'), names: '' }, { ...form('0000000001'), cycle: 21 }, { ...form('0000000001'), slots: [] }, { ...form('0000000001'), method: 'MANUAL' }, { ...form('0000000001'), code: '1234ABCD' }]) {
    const writes = h.stats.batchWrites; assert.equal(h.request('register', input).status, 400); assert.equal(h.stats.batchWrites, writes);
  }
  assert.equal(h.context.gymRead_(h.operational()).students.length, 0);
});
test('inscribir durante una sesión no crea asistencia ni falta anteriores al alta', () => {
  const h = opened(); h.setTime('2026-10-05T08:30:00-05:00'); h.invoke('register', form('0000000001'));
  assert.equal(h.request('attend', { code: '0000000001', method: 'CARNET' }).status, 400);
  h.setTime('2026-10-05T10:00:00-05:00'); h.context.procesarFaltas();
  assert.equal(h.context.gymRead_(h.operational()).absences.length, 0);
});
test('guardar texto con aspecto de fórmula mantiene datos literales en Sheets', () => {
  const h = opened(); let payload;
  const original = h.context.Sheets.Spreadsheets.batchUpdate;
  h.context.Sheets.Spreadsheets.batchUpdate = (body, id) => { payload = body; return original(body, id); };
  h.invoke('register', { ...form('0000000001'), names: '=FORMULA_QA', faculty: '@QA', career: '+QA' });
  const row = h.operational().getSheetByName('REGISTRADOS').values[1];
  assert.equal(row[1], '=FORMULA_QA QA'); assert.equal(row[2], '@QA'); assert.equal(row[3], '+QA');
  const fields = payload.requests.flatMap(r => r.updateCells?.rows.flatMap(row => row.values.map(c => c.userEnteredValue)) || []);
  assert.ok(fields.some(c => c.stringValue === '=FORMULA_QA QA')); assert.ok(fields.every(c => !Object.hasOwn(c, 'formulaValue')));
  h.invoke('export', { ...actor, shift: 'TODO', archive: false });
  assert.equal(h.exports.at(-1).sheets.find(s => s.name === 'REGISTRADOS').values[1][1], "'=FORMULA_QA QA");
  assert.equal(h.context.gymRead_(h.operational()).students[0].names, '=FORMULA_QA');
});
test('dos cierres superpuestos: reabrir un turno no anula el cierre total', () => {
  const h = opened(); h.invoke('register', form('0000000001'));
  h.invoke('closure', { ...actor, date: '2026-10-05', shift: 'TODO', closed: true, reason: 'QA total' });
  h.invoke('closure', { ...actor, date: '2026-10-05', shift: 'MANANA', closed: false, reason: 'QA turno' });
  h.setTime('2026-10-05T08:10:00-05:00'); assert.match(h.request('attend', { code: '0000000001', method: 'CARNET' }).error, /cerrado/);
  h.invoke('closure', { ...actor, date: '2026-10-05', shift: 'TODO', closed: false, reason: 'QA reapertura total' });
  assert.equal(h.request('attend', { code: '0000000001', method: 'CARNET' }).ok, true);
});
test('cambio aplicado, cambio futuro repetido y mes siguiente preservan historial', () => {
  const h = opened(); h.invoke('register', form('0000000001'));
  h.invoke('schedule', { ...actor, code: '0000000001', effectiveDate: '2026-10-07', slots: [{ day: 3, start: '19:00' }] });
  assert.equal(h.request('schedule', { ...actor, code: '0000000001', effectiveDate: '2026-10-08', slots: [{ day: 4, start: '15:00' }] }).status, 400);
  h.setTime('2026-10-07T19:10:00-05:00'); const panel = h.invoke('panel', actor);
  assert.equal(panel.students[0].slots[0].start, '19:00'); assert.equal(panel.students[0].futureSlots.length, 0);
  assert.equal(h.request('attend', { code: '0000000001', method: 'CARNET' }).ok, true);
  const before = h.context.gymRead_(h.operational());
  h.invoke('export', { ...actor, shift: 'MANANA', archive: false });
  assert.equal(h.exports.at(-1).sheets.find(s => s.name === 'ASISTENCIAS').values.length, 1);
  assert.equal(h.context.gymRead_(h.operational()).attendance.length, before.attendance.length);
  h.setTime('2026-11-01T07:00:00-05:00'); assert.equal(h.request('register', form('0000000002')).status, 503);
  h.context.procesarCambioMensual(); assert.equal(h.context.gymRead_(h.operational()).students.length, 0);
  assert.equal(h.request('register', { ...form('0000000002'), period: '2026-10' }).status, 409);
  assert.equal(h.context.gymRead_(h.operational()).students.length, 0);
  assert.equal(h.request('register', { ...form('0000000002'), period: '2026-11' }).ok, true);
});
