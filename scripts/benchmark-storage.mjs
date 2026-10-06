/* Compara tamaños de escritura local, no mide tiempos de Google. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { googleHarness } from '../tests/helpers/google-harness.mjs';

const baseline = ['Domain.js', 'Code.js'].map(name => {
  const r = spawnSync('git', ['show', `adeff29:apps-script/${name}`], { encoding: 'utf8' });
  if (r.status) throw new Error('No se encontró la revisión de referencia adeff29.');
  return r.stdout;
}).join('\n');
const inputs = JSON.parse(readFileSync('docs/simulacion/octubre-2026-datos-ficticios.json', 'utf8')).registeredInputs;
function measure(source) {
  const h = googleHarness('2026-10-01T07:00:00-05:00', source);
  h.invoke('configure', { actor: 'Administrador', version: 1, days: [1, 2, 3, 4, 5], codePattern: '^[0-9]{8}$', enabled: true });
  for (const input of inputs) h.invoke('register', input);
  h.setTime('2026-10-05T08:05:00-05:00');
  h.context.procesarFaltas(); // Estado recalculado como en la operación con activador.
  const before = { ...h.stats };
  h.invoke('attend', { code: '00000001', method: 'CARNET' });
  const state = h.context.gymRead_(h.operational());
  return { cellsSent: h.stats.writtenCells - before.writtenCells, atomicWrites: h.stats.batchWrites - before.batchWrites, attendance: state.attendance.length, students: state.students.length, data: JSON.stringify({ students: state.students, attendance: state.attendance, absences: state.absences }) };
}
const before = measure(baseline), after = measure();
assert.equal(before.data, after.data);
const result = { scenario: 'Una asistencia tras 120 inscripciones ficticias y cálculo previo de faltas, mismo resultado persistido', baselineCommit: 'adeff29', beforeCells: before.cellsSent, afterCells: after.cellsSent, reductionPercent: Math.round((1 - after.cellsSent / before.cellsSent) * 100), beforeAtomicWrites: before.atomicWrites, afterAtomicWrites: after.atomicWrites, identicalPersistedData: true, note: 'Servicios en memoria. No es un porcentaje de reducción del tiempo real en Google.' };
console.log(JSON.stringify(result, null, 2));
