import assert from 'node:assert/strict';
import { googleHarness } from './google-harness.mjs';
import { parallelGoogle } from './parallel-google.mjs';

export const qaForm = (code, start = '08:00') => ({ period: '2026-10', code, names: 'Alumno ficticio', surnames: 'Concurrencia QA', faculty: 'QA', career: 'QA', cycle: 4, method: 'CARNET', slots: [{ day: 1, start }] });
export function qaOpened() {
  const h = googleHarness('2026-10-05T07:00:00-05:00');
  h.invoke('configure', { actor: 'Administrador', version: 1, days: [1, 2, 3, 4, 5], enabled: true, codePattern: '^[0-9]{8}$' });
  return h;
}
function apply(h, run) {
  h.restore(run.snapshot);
  assert.ok(run.maxRequestsInFlight > 1, 'La prueba debe solapar solicitudes de workers independientes.');
  assert.ok(run.lockWaits > 0, 'Debe observarse contención, no una secuencia sin solapamiento.');
  assert.equal(run.maxCriticalSections, 1);
  const state = h.context.gymRead_(h.operational());
  assert.equal(new Set(state.students.map(s => s.code)).size, state.students.length);
  assert.equal(new Set(state.attendance.map(a => a.key)).size, state.attendance.length);
  assert.ok(h.context.GymDomain.occupancy(state).every(slot => slot.occupied <= 20));
  return state;
}
function evidence(name, run, extra = {}) {
  return { case: name, workers: run.workers, maxRequestsInFlight: run.maxRequestsInFlight, lockWaits: run.lockWaits,
    maxCriticalSections: run.maxCriticalSections, ms: run.ms, statuses: run.results.reduce((counts, r) => ({ ...counts, [r.status]: (counts[r.status] || 0) + 1 }), {}), ...extra };
}
export async function concurrencyScenario() {
  const events = [];
  let h = qaOpened();
  for (let i = 1; i <= 19; i++) h.invoke('register', qaForm(String(i).padStart(8, '0')));
  const accounts = ['ACCOUNT_ProfesorGYM', 'ACCOUNT_Administrador'].map(k => h.props.get(k));
  const contenders = Array.from({ length: 24 }, (_, i) => ({ action: 'register', data: qaForm(String(100 + i).padStart(8, '0')) }));
  let run = await parallelGoogle(h.dump(), contenders, '2026-10-05T07:00:00-05:00');
  let state = apply(h, run);
  assert.equal(run.results.filter(r => r.status === 200).length, 1);
  assert.equal(run.results.filter(r => r.status === 409).length, 23);
  assert.equal(state.students.length, 20); assert.equal(state.reservations.length, 20);
  for (let i = 1; i <= 19; i++) assert.ok(state.students.some(s => s.code === String(i).padStart(8, '0')));
  const winner = run.results.find(r => r.status === 200).client;
  assert.ok(state.students.some(s => s.code === contenders[winner].data.code));
  events.push(evidence('24 candidatos al último cupo', run, { accepted: 1, rejected: 23, finalStudents: 20, priorStudentsPreserved: true }));

  const codes = state.students.map(s => s.code);
  run = await parallelGoogle(h.dump(), Array.from({ length: 24 }, (_, i) => ({ action: 'attend', data: { code: codes[i % 20], method: 'CARNET' } })), '2026-10-05T08:10:00-05:00');
  state = apply(h, run);
  assert.ok(run.results.every(r => r.status === 200));
  assert.equal(run.results.filter(r => r.body.duplicate).length, 4);
  assert.equal(state.attendance.length, 20);
  assert.deepEqual(new Set(state.attendance.map(a => a.code)), new Set(codes));
  events.push(evidence('24 asistencias: 20 alumnos y 4 repetidas', run, { persistedAttendance: 20, duplicates: 4, lostWrites: 0 }));

  run = await parallelGoogle(h.dump(), Array.from({ length: 24 }, () => ({ action: 'attend', data: { code: codes[0], method: 'CARNET' } })), '2026-10-05T08:15:00-05:00');
  state = apply(h, run);
  assert.ok(run.results.every(r => r.status === 200 && r.body.duplicate));
  assert.equal(state.attendance.length, 20);
  events.push(evidence('24 reenvíos de una asistencia existente', run, { duplicateResponses: 24, extraRows: 0 }));

  const octoberId = h.props.get('MONTH_2026-10');
  const october = JSON.parse(JSON.stringify(state));
  run = await parallelGoogle(h.dump(), Array.from({ length: 8 }, () => ({ task: 'rollover' })), '2026-11-01T00:00:00-05:00');
  state = apply(h, run);
  assert.ok(run.results.every(r => r.status === 200));
  assert.equal(run.results.filter(r => r.body?.closed === '2026-10').length, 1);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-11'); assert.ok(h.props.get('ARCHIVED_2026-10'));
  assert.equal(state.students.length, 0); assert.equal(state.attendance.length, 0);
  assert.equal(h.stats.exports, 1);
  assert.equal([...h.sheets.values()].filter(s => s.name === 'GIMNASIO_UNT_NOVIEMBRE_2026').length, 1);
  assert.equal([...h.files.values()].filter(f => f.name === 'GIMNASIO_UNT_OCTUBRE_2026.xlsx').length, 1);
  assert.equal(h.sheets.get(octoberId).getSheetByName('REGISTRADOS').values.length, 21);
  assert.equal(h.sheets.get(octoberId).getSheetByName('ASISTENCIAS').values.length, 21);
  assert.deepEqual(['ACCOUNT_ProfesorGYM', 'ACCOUNT_Administrador'].map(k => h.props.get(k)), accounts);
  events.push(evidence('8 trabajos mensuales simultáneos', run, { archivedReports: 1, nextMonthBooks: 1, nextMonthStudents: 0, accountsUnchanged: true }));

  h = qaOpened();
  run = await parallelGoogle(h.dump(), Array.from({ length: 24 }, (_, i) => ({ action: 'register', data: qaForm(String(200 + i).padStart(8, '0')) })), '2026-10-05T07:00:00-05:00');
  state = apply(h, run);
  assert.equal(state.students.length, 20); assert.equal(run.results.filter(r => r.status === 200).length, 20);
  assert.equal(run.results.filter(r => r.status === 409).length, 4);
  assert.deepEqual(new Set(state.students.map(s => s.code)), new Set(run.results.filter(r => r.status === 200).map(r => String(200 + r.client).padStart(8, '0'))));
  events.push(evidence('24 registros simultáneos desde bloque vacío', run, { accepted: 20, rejected: 4, finalStudents: 20, lostWrites: 0 }));

  h = qaOpened();
  run = await parallelGoogle(h.dump(), Array.from({ length: 24 }, () => ({ action: 'register', data: qaForm('00000999') })), '2026-10-05T07:00:00-05:00');
  state = apply(h, run);
  assert.equal(run.results.filter(r => r.status === 200).length, 1); assert.equal(run.results.filter(r => r.status === 409).length, 23);
  assert.equal(state.students.length, 1); assert.equal(state.reservations.length, 1);
  events.push(evidence('24 registros del mismo código', run, { accepted: 1, rejected: 23, finalStudents: 1 }));

  h = qaOpened(); h.invoke('register', qaForm('00000100'));
  run = await parallelGoogle(h.dump(), [ ...Array.from({ length: 4 }, () => ({ task: 'rollover' })),
    ...Array.from({ length: 8 }, (_, i) => ({ action: 'register', data: qaForm(String(500 + i).padStart(8, '0')) })) ], '2026-11-01T07:00:00-05:00');
  state = apply(h, run);
  assert.equal(run.results.filter(r => r.client >= 4 && [409, 503].includes(r.status)).length, 8);
  assert.equal(state.students.length, 0); assert.equal(h.stats.exports, 1);
  assert.equal(run.results.filter(r => r.body?.opened === '2026-11').length, 1);
  events.push(evidence('Cierre mensual junto a 8 formularios del mes antiguo', run, { staleFormsRejected: 8, nextMonthStudents: 0, archivedReports: 1 }));

  h = qaOpened();
  run = await parallelGoogle(h.dump(), Array.from({ length: 24 }, () => ({ action: 'login', clientIp: 'qa-misma-red', data: { user: 'Administrador', password: h.passwords.Administrador } })), '2026-10-05T07:00:00-05:00');
  apply(h, run);
  assert.equal(run.results.filter(r => r.status === 200).length, 12); assert.equal(run.results.filter(r => r.status === 429).length, 12);
  events.push(evidence('24 logins simultáneos desde la misma red', run, { accepted: 12, rateLimited: 12, passwordChanges: 0 }));
  return { warning: 'QA AISLADO: concurrencia real entre workers, Google/Drive/Sheets/LockService simulados. No acredita concurrencia ni activadores reales de Google.',
    revision: h.context.GYM_REVISION, cases: events, octoberExample: { students: october.students.length, attendance: october.attendance.length }, passwordChanges: 0 };
}
