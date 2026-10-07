import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const context = vm.createContext({ console });
vm.runInContext(await readFile(new URL('../apps-script/Domain.js', import.meta.url), 'utf8'), context);
const G = context.GymDomain;
const at = (date, time = '07:00') => new Date(`${date}T${time}:00-05:00`);
const initial = () => { const s = G.empty('2026-10'); s.config.enabled = true; return s; };
const form = (code = '0000000001', slots = [{ day: 1, start: '08:00' }]) => ({ code, names: 'José Luis', surnames: 'Pérez Vargas', faculty: 'Ingeniería', career: 'Informática', cycle: 4, method: 'CARNET', slots });
const signup = (s, code = '0000000001', slots) => G.register(s, form(code, slots), at('2026-10-01'));
const plain = value => JSON.parse(JSON.stringify(value));

test('horario vigente y conteos no adelantan un cambio futuro entre turnos', () => {
  const s = initial(); signup(s);
  G.changeSchedule(s, { code: '0000000001', effectiveDate: '2026-10-06', slots: [{ day: 3, start: '19:00' }] }, 'Administrador', at('2026-10-05'));
  assert.equal(G.activeReservations(s, at('2026-10-05'))[0].start, '08:00');
  assert.equal(G.dashboard(s, at('2026-10-05'), 'MANANA').registered, 1);
  assert.equal(G.dashboard(s, at('2026-10-05'), 'TARDE').registered, 0);
  assert.equal(G.activeReservations(s, at('2026-10-06'))[0].start, '19:00');
  assert.equal(G.dashboard(s, at('2026-10-06'), 'MANANA').registered, 0);
  assert.equal(G.dashboard(s, at('2026-10-06'), 'TARDE').registered, 1);
});

test('America/Lima usa la fecha de Perú aunque UTC esté en el día siguiente', () => {
  assert.deepEqual(plain(G.lima('2026-10-06T02:20:00Z')), { date: '2026-10-05', time: '21:20', day: 1, period: '2026-10' });
});
test('la inscripción queda cerrada hasta confirmar la configuración', () => {
  assert.throws(() => G.register(G.empty('2026-10'), form(), at('2026-10-01')), /no están habilitadas/);
});
test('inscripción válida mantiene ceros iniciales del código', () => {
  const s = initial(); signup(s); assert.equal(s.students[0].code, '0000000001'); assert.equal(s.students[0].absences, 0); assert.equal(s.reservations.length, 1);
});
test('registro exige CARNET', () => {
  assert.throws(() => G.register(initial(), { ...form(), method: 'MANUAL' }, at('2026-10-01')), /requiere leer/);
});

test('carnet fijo de diez dígitos, incluso con una configuración antigua', () => {
  const state = G.empty('2026-10');
  assert.deepEqual(plain(state.config.days), [1, 2, 3, 4, 5]);
  assert.equal(state.config.enabled, false);
  assert.equal(state.config.codePattern, '^[0-9]{10}$');
  for (const code of ['ABCD1234', '0000-001', '0000.001', '123456789', '12345678901', '000000000001', '102270092A']) assert.throws(() => signup(initial(), code), /Formato inválido/);
  const example = initial(); signup(example, '1022700924'); assert.equal(example.students[0].code, '1022700924');
  const s = initial(); s.config.codePattern = '^[0-9]{1,40}$';
  assert.throws(() => signup(s, '123'), /10 dígitos/);
  signup(s, '0000000001'); assert.equal(s.students[0].code, '0000000001');
});

test('turno tarde incluye cinco bloques de 15:00 a 20:00 y rechaza empezar a las 20:00', () => {
  const afternoon = plain(G.BLOCKS).filter(b => b.shift === 'TARDE');
  assert.deepEqual(afternoon.map(b => b.start), ['15:00', '16:00', '17:00', '18:00', '19:00']);
  assert.equal(afternoon.at(-1).end, '20:00');
  const s = initial(); signup(s, '0000000001', [{ day: 1, start: '19:00' }]);
  G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '19:59'));
  assert.equal(s.attendance[0].end, '20:00');
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '20:00')), /horario de hoy/);
  assert.throws(() => signup(initial(), '0000000001', [{ day: 1, start: '20:00' }]));
});
test('no se inscribe dos veces el mismo código en el mes', () => {
  const s = initial(); signup(s); assert.throws(() => signup(s), /ya está inscrito/); assert.equal(s.students.length, 1);
});
test('el alumno 21 no entra al bloque de aforo 20', () => {
  const s = initial(); for (let i = 0; i < 20; i++) signup(s, String(i).padStart(10, '0'));
  assert.throws(() => signup(s, '0000000021'), /cupo.*completó/); assert.equal(s.students.length, 20);
});
test('dos candidatos al último cupo: solo uno pasa la segunda validación', () => {
  const s = initial(); for (let i = 0; i < 19; i++) signup(s, String(i).padStart(10, '0'));
  const results = ['0000000100', '0000000101'].map(code => { try { signup(s, code); return true; } catch { return false; } });
  assert.deepEqual(results, [true, false]); assert.equal(G.occupancy(s, null, at('2026-10-02')).find(x => x.day === 1 && x.start === '08:00').occupied, 20);
});
test('rechaza cero, cuatro días y dos bloques en el mismo día', () => {
  for (const slots of [[], [1, 2, 3, 4].map(day => ({ day, start: '08:00' })), [{ day: 1, start: '08:00' }, { day: 1, start: '09:00' }]]) assert.throws(() => signup(initial(), '0000000001', slots));
});
test('rechaza días deshabilitados, horas inexistentes y ciclo inválido', () => {
  for (const slots of [[{ day: 0, start: '08:00' }], [{ day: 1, start: '12:00' }]]) assert.throws(() => signup(initial(), '0000000001', slots));
  assert.throws(() => G.register(initial(), { ...form(), cycle: 0 }, at('2026-10-01')), /ciclo/);
});
test('asistencia válida, método carnet y prevención de duplicados', () => {
  const s = initial(); signup(s);
  assert.match(G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '08:20')).message, /registrada/);
  assert.equal(G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '08:40')).duplicate, true);
  assert.equal(s.attendance.length, 1);
});
test('manual exige código y nombre completo; normaliza acentos y espacios', () => {
  const s = initial(); signup(s);
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'MANUAL', fullName: 'Otra Persona' }, at('2026-10-05', '08:20')), /no coinciden/);
  G.attend(s, { code: '0000000001', method: 'MANUAL', fullName: ' JOSE  LUIS PEREZ VARGAS ' }, at('2026-10-05', '08:20'));
  assert.equal(s.attendance[0].method, 'MANUAL');
});
test('rechaza alumno inexistente, día incorrecto y horario incorrecto', () => {
  const s = initial(); signup(s);
  assert.throws(() => G.attend(s, { code: '0000000002', method: 'CARNET' }, at('2026-10-05', '08:20')), /No estás inscrito/);
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-06', '08:20')), /No tienes/);
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '07:59')), /horario de hoy/);
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '09:00')), /horario de hoy/);
});
test('una sesión pendiente no cuenta como falta; al terminar sí', () => {
  const s = initial(); signup(s); G.recalculate(s, at('2026-10-05', '08:59')); assert.equal(s.students[0].absences, 0);
  G.recalculate(s, at('2026-10-05', '09:00')); assert.equal(s.students[0].absences, 1);
});
test('el cálculo de faltas es idempotente', () => {
  const s = initial(); signup(s); G.recalculate(s, at('2026-10-12', '10:00')); const before = JSON.stringify(s);
  G.recalculate(s, at('2026-10-12', '10:00')); assert.equal(JSON.stringify(s), before);
});
test('tres faltas bloquean y las posteriores no siguen acumulando', () => {
  const s = initial(); signup(s); G.recalculate(s, at('2026-10-26', '10:00'));
  assert.equal(s.students[0].absences, 3); assert.equal(s.students[0].status, 'BLOQUEADO');
  assert.equal(s.absences.filter(a => a.status === 'NO_APLICA_BLOQUEO').length, 1);
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-26', '08:20')), /bloqueado/);
});
test('cierre retroactivo anula solo la falta afectada y reactiva; reapertura la recupera', () => {
  const s = initial(); signup(s); const now = at('2026-10-19', '10:00'); G.recalculate(s, now); assert.equal(s.students[0].absences, 3);
  G.closure(s, { date: '2026-10-19', shift: 'MANANA', closed: true, reason: 'Mantenimiento' }, 'ProfesorGYM', now);
  assert.equal(s.students[0].absences, 2); assert.equal(s.students[0].status, 'ACTIVO');
  G.closure(s, { date: '2026-10-19', shift: 'MANANA', closed: false, reason: 'Corrección' }, 'Administrador', now);
  assert.equal(s.students[0].absences, 3); assert.equal(s.students[0].status, 'BLOQUEADO'); assert.equal(s.audit.length, 2);
});
test('un cierre de mañana no afecta la tarde', () => {
  const s = initial(); signup(s, '0000000001', [{ day: 1, start: '08:00' }]); signup(s, '0000000002', [{ day: 1, start: '16:00' }]);
  G.closure(s, { date: '2026-10-05', shift: 'MANANA', closed: true, reason: 'No abrió' }, 'Administrador', at('2026-10-05', '18:00'));
  assert.equal(s.students[0].absences, 0); assert.equal(s.students[1].absences, 1);
});
test('cierre de todo el día excluye ambos turnos y rechaza marcado', () => {
  const s = initial(); signup(s);
  G.closure(s, { date: '2026-10-05', shift: 'TODO', closed: true, reason: 'Feriado' }, 'Administrador', at('2026-10-05'));
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '08:20')), /cerrado/);
  G.recalculate(s, at('2026-10-05', '18:00')); assert.equal(s.students[0].absences, 0);
});
test('inscribir después de empezar un bloque no crea faltas anteriores', () => {
  const s = initial(); G.register(s, form(), at('2026-10-05', '08:20')); G.recalculate(s, at('2026-10-05', '10:00')); assert.equal(s.students[0].absences, 0);
  assert.throws(() => G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '08:30')), /No tienes/);
});
test('cambio de horario conserva historial y solo afecta sesiones futuras', () => {
  const s = initial(); signup(s); G.recalculate(s, at('2026-10-05', '10:00'));
  G.changeSchedule(s, { code: '0000000001', effectiveDate: '2026-10-06', slots: [{ day: 3, start: '16:00' }] }, 'ProfesorGYM', at('2026-10-05', '10:00'));
  G.recalculate(s, at('2026-10-08', '10:00')); assert.equal(s.students[0].absences, 2); assert.equal(s.absences[0].date, '2026-10-05'); assert.equal(s.absences[1].date, '2026-10-07');
  assert.throws(() => G.changeSchedule(s, { code: '0000000001', effectiveDate: '2026-10-05', slots: [{ day: 3, start: '16:00' }] }, 'Administrador', at('2026-10-05', '10:00')), /mañana/);
});
test('un cambio futuro no libera anticipadamente el cupo anterior', () => {
  const s = initial(); for (let i = 0; i < 20; i++) signup(s, String(i).padStart(10, '0'));
  G.changeSchedule(s, { code: '0000000000', effectiveDate: '2026-10-13', slots: [{ day: 3, start: '16:00' }] }, 'Administrador', at('2026-10-05', '10:00'));
  assert.throws(() => G.register(s, form('0000000100'), at('2026-10-06')), /cupo.*completó/);
  assert.equal(G.occupancy(s, null, at('2026-10-14')).find(x => x.day === 1 && x.start === '08:00').occupied, 19);
});
test('un bloqueado conserva su reserva', () => {
  const s = initial(); signup(s); G.recalculate(s, at('2026-10-26', '10:00'));
  assert.equal(G.occupancy(s, null, at('2026-10-26')).find(x => x.day === 1 && x.start === '08:00').occupied, 1);
});
test('configuración conserva aforo, máximo de faltas y formato fijo no editable', () => {
  const s = initial(); G.configure(s, { days: [1, 3, 5], codePattern: '^[0-9]{10}$', enabled: true, capacity: 100 }, 'Administrador', at('2026-10-01'));
  assert.equal(s.config.capacity, 20); assert.equal(s.config.maxAbsences, 3); assert.throws(() => signup(s, 'ABCD1234'), /Formato inválido/);
  G.configure(s, { days: [1], codePattern: '^(a+)+$', enabled: true }, 'Administrador', at('2026-10-01'));
  assert.equal(s.config.codePattern, '^[0-9]{10}$');
  G.configure(s, { days: [1], enabled: true }, 'Administrador', at('2026-10-01'));
  assert.equal(s.config.codePattern, '^[0-9]{10}$');
});
test('mes nuevo empieza vacío; no permite inscripción contra el mes antiguo', () => {
  const s = initial(); signup(s); const next = G.empty(G.nextPeriod(s.period), s.config);
  assert.equal(next.period, '2026-11'); assert.equal(next.students.length, 0); assert.equal(next.attendance.length, 0); assert.equal(next.absences.length, 0);
  assert.throws(() => G.register(s, form('0000000002'), at('2026-11-01')), /cambio mensual/);
});
test('dashboard separa reservas, asistencia real y sesiones finalizadas', () => {
  const s = initial(); signup(s); G.attend(s, { code: '0000000001', method: 'CARNET' }, at('2026-10-05', '08:20'));
  const pending = G.dashboard(s, at('2026-10-05', '08:30'), 'TODO'); assert.equal(pending.finishedApplicable, 0); assert.equal(pending.attendanceRate, 0);
  const done = G.dashboard(s, at('2026-10-05', '09:30'), 'TODO'); assert.equal(done.attendanceRate, 100); assert.equal(done.registered, 1); assert.equal(done.byBlock[0].occupied, 1);
});
