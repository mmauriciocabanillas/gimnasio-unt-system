/* Compara tamaños de escritura local, no mide tiempos de Google. */
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { googleHarness } from '../tests/helpers/google-harness.mjs';

const baseline = ['Domain.js', 'Code.js'].map(name => {
  const r = spawnSync('git', ['show', `adeff29:apps-script/${name}`], { encoding: 'utf8' });
  if (r.status) throw new Error('No se encontró la revisión de referencia adeff29.');
  return r.stdout;
}).join('\n');
// Comparación en memoria sin depender de archivos de ejecuciones anteriores.
const inputs = Array.from({ length: 120 }, (_, index) => ({
  code: String(index + 1).padStart(10, '0'), names: 'Alumno ficticio', surnames: 'Comparación local',
  faculty: 'Ingeniería', career: 'Carrera ficticia', cycle: 1, method: 'CARNET',
  slots: [{ day: index < 20 ? 1 : (index - 20) % 5 + 1,
    start: index < 20 ? '08:00' : ['09:00', '10:00', '15:00', '16:00', '19:00'][Math.floor((index - 20) / 20)] }]
}));
function measure(source) {
  const h = googleHarness('2026-10-01T07:00:00-05:00', source);
  h.invoke('configure', { actor: 'Administrador', version: 1, days: [1, 2, 3, 4, 5], codePattern: '^[0-9]{10}$', enabled: true });
  for (const input of inputs) h.invoke('register', input);
  h.setTime('2026-10-05T08:05:00-05:00');
  h.context.procesarFaltas(); // Estado recalculado como en la operación con activador.
  const before = { ...h.stats };
  h.invoke('attend', { code: '0000000001', method: 'CARNET' });
  const state = h.context.gymRead_(h.operational());
  return { cellsSent: h.stats.writtenCells - before.writtenCells, atomicWrites: h.stats.batchWrites - before.batchWrites, attendance: state.attendance.length, students: state.students.length, data: JSON.stringify({ students: state.students, attendance: state.attendance, absences: state.absences }) };
}
const before = measure(baseline), after = measure();
assert.equal(before.data, after.data);
const result = { scenario: 'Una asistencia tras 120 inscripciones ficticias y cálculo previo de faltas, mismo resultado persistido', baselineCommit: 'adeff29', beforeCells: before.cellsSent, afterCells: after.cellsSent, reductionPercent: Math.round((1 - after.cellsSent / before.cellsSent) * 100), beforeAtomicWrites: before.atomicWrites, afterAtomicWrites: after.atomicWrites, identicalPersistedData: true, note: 'Servicios en memoria. No es un porcentaje de reducción del tiempo real en Google.' };
console.log(JSON.stringify(result, null, 2));
