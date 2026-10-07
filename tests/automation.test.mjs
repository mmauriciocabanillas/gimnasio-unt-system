import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleHarness } from './helpers/google-harness.mjs';
const actor = { actor: 'Administrador', version: 1 };
test('consulta privada de activadores no escribe ni toca Sheets y no promete ejecución/frecuencia', () => {
  const h = googleHarness(), before = h.dump();
  const report = h.invoke('automation.status', actor);
  assert.equal(report.revision, '2026-10-07-access-4'); assert.equal(report.currentPeriod, '2026-10');
  assert.equal(report.monthPending, false); assert.equal(report.missingClockHandlers.length, 0);
  assert.equal(report.duplicateClockHandlers.length, 0); assert.equal(report.executionVerified, false); assert.equal(report.frequencyVerified, false);
  assert.deepEqual(h.dump().props, before.props); assert.deepEqual(h.stats, before.stats);
  assert.ok(!JSON.stringify(report).includes('scrypt$'));
  h.context.instalarActivadores(); assert.equal(h.triggers.length, 2);
});
test('diagnóstico muestra activador faltante, incorrecto, duplicado y mes pendiente', () => {
  const h = googleHarness(); h.triggers.splice(0, h.triggers.length, { handler: 'procesarFaltas', event: 'ON_EDIT' }, { handler: 'procesarCambioMensual', event: 'CLOCK' }, { handler: 'procesarCambioMensual', event: 'CLOCK' });
  h.setTime('2026-11-01T07:00:00-05:00');
  const report = h.invoke('automation.status', actor);
  assert.equal(report.monthPending, true); assert.equal(report.expectedPeriod, '2026-11');
  assert.deepEqual(Array.from(report.missingClockHandlers), ['procesarFaltas']);
  assert.deepEqual(Array.from(report.duplicateClockHandlers), ['procesarCambioMensual']);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10');
});
test('diagnóstico de activadores rechaza cuenta/versión inválidas antes de inspeccionar proyecto', () => {
  const h = googleHarness(); h.context.ScriptApp.getProjectTriggers = () => { throw new Error('No debe inspeccionar'); };
  assert.equal(h.request('automation.status', { ...actor, version: 0 }).status, 401);
  assert.equal(h.request('automation.status', { actor: 'intruso', version: 1 }).status, 401);
});
