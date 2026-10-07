/* QA local: no red, .env, cuentas reales ni servicios de producción. */
import assert from 'node:assert/strict';
import { googleHarness } from '../tests/helpers/google-harness.mjs';
import { handleApi } from '../server/api.mjs';
import { createSession } from '../server/auth.mjs';

const h = googleHarness();
const actor = { actor: 'Administrador', version: 1 };
let propertyOps = 0;
const properties = h.context.PropertiesService.getScriptProperties();
for (const name of ['getProperty', 'setProperty', 'deleteProperty']) {
  const original = properties[name];
  properties[name] = (...args) => { propertyOps++; return original(...args); };
}
const hours = h.context.GymDomain.BLOCKS.map(b => b.start);
const minutes = new Map(), daily = new Map(), profiles = {};
let googleWebRequests = 0, faultTriggers = 0, monthlyTriggers = 0;
let maxPanelBytes = 0, maxDailyProperties = 0;
function track(label, fn, web = false) {
  const before = { ...h.stats }, p = propertyOps;
  const result = fn();
  const delta = {
    reads: h.stats.batchReads - before.batchReads + h.stats.metadataReads - before.metadataReads,
    writes: h.stats.batchWrites - before.batchWrites, properties: propertyOps - p
  };
  profiles[label] = delta;
  const key = h.now().toISOString().slice(0, 16);
  const count = minutes.get(key) || { reads: 0, writes: 0 };
  count.reads += delta.reads; count.writes += delta.writes; minutes.set(key, count);
  const date = h.context.GymDomain.lima(h.now()).date;
  daily.set(date, (daily.get(date) || 0) + delta.properties);
  if (web) googleWebRequests++;
  return result;
}
const call = (action, data = {}) => track(action, () => h.invoke(action, data), true);
call('configure', { ...actor, days: [1,2,3,4,5], enabled: true, codePattern: '^[0-9]{10}$' });
const rate = 'a'.repeat(64);
call('account.get', { user: 'Administrador', _rate: rate });
call('public.config', { _rate: rate });

// 300 estudiantes, 3 días cada uno: 900 reservas, todos los bloques llenos.
for (let i = 0; i < 300; i++) {
  h.setTime(new Date(Date.parse('2026-10-01T07:00:00-05:00') + i * 10000).toISOString());
  const slots = Array.from({ length: 3 }, (_, j) => {
    const index = i * 3 + j;
    return { day: index % 5 + 1, start: hours[Math.floor(index / 5) % 9] };
  });
  call('register', { _rate: rate, period: '2026-10', code: String(i + 1).padStart(10, '0'),
    method: 'CARNET', names: `Alumno ficticio ${i + 1}`, surnames: 'Prueba de capacidad',
    faculty: 'Facultad ficticia', career: 'Carrera ficticia', cycle: 1, slots });
}
const registrations = h.context.gymRead_(h.operational());
assert.equal(registrations.students.length, 300);
assert.equal(registrations.reservations.length, 900);
assert.ok(h.context.GymDomain.occupancy(registrations).every(s => s.occupied === 20));
console.log('300 alumnos y 900 reservas creadas localmente; comenzando 31 días completos.');

let accepted = 0, weekdays = 0, lastPanel;
for (let day = 1; day <= 31; day++) {
  const date = `2026-10-${String(day).padStart(2, '0')}`;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const open = weekday >= 1 && weekday <= 5;
  if (open) weekdays++;
  const events = [];
  for (let q = 0; q < 96; q++) events.push({ seconds: q * 900 + 180, type: 'faults' });
  for (let hour = 0; hour < 24; hour++) events.push({ seconds: hour * 3600 + 660, type: 'monthly' });
  if (open) for (const start of hours) {
    const seconds = Number(start.slice(0, 2)) * 3600;
    const group = registrations.reservations.filter(r => r.day === weekday && r.start === start);
    assert.equal(group.length, 20);
    group.forEach((r, i) => events.push({ seconds: seconds + i * 6, type: 'attend', code: r.code }));
    events.push({ seconds: seconds + 300, type: 'panel' });
    events.push({ seconds: seconds + 360, type: 'panel' });
  }
  events.sort((a, b) => a.seconds - b.seconds);
  for (const e of events) {
    h.setTime(new Date(Date.parse(`${date}T00:00:00-05:00`) + e.seconds * 1000).toISOString());
    if (e.type === 'attend') { call('attend', { _rate: rate, code: e.code, method: 'CARNET' }); accepted++; }
    if (e.type === 'faults') { track('faults', () => h.context.procesarFaltas()); faultTriggers++; }
    if (e.type === 'monthly') { track('monthly', () => h.context.procesarCambioMensual()); monthlyTriggers++; }
    if (e.type === 'panel') {
      lastPanel = call('panel', { ...actor, shift: 'TODO' });
      maxPanelBytes = Math.max(maxPanelBytes, Buffer.byteLength(JSON.stringify(lastPanel)));
    }
  }
  maxDailyProperties = Math.max(maxDailyProperties, daily.get(date) || 0);
  console.log(JSON.stringify({ day: date, attendance: accepted, propertyOps: daily.get(date), panelBytes: maxPanelBytes }));
}
assert.equal(weekdays, 22); assert.equal(accepted, 3960);
assert.equal(lastPanel.students.length, 300); assert.equal(lastPanel.attendance.length, 3960);
assert.equal(lastPanel.absences.length, 0);
const archiveBefore = h.stats.exports;
h.setTime('2026-11-01T00:11:00-05:00');
const rollover = track('close', () => h.context.procesarCambioMensual());
assert.equal(rollover.opened, '2026-11');
track('retryClose', () => h.context.procesarCambioMensual());
assert.equal(h.stats.exports - archiveBefore, 1);
const next = h.context.gymRead_(h.operational());
assert.equal(next.students.length, 0); assert.equal(next.attendance.length, 0);
assert.equal(JSON.parse(h.props.get('ACCOUNT_Administrador')).version, 1);
assert.equal(JSON.parse(h.props.get('ACCOUNT_ProfesorGYM')).version, 1);

// Proyección explícita: 2 personas consultan 1 vez/min durante 9 h/día.
// Se ejecutaron 18 paneles/día; los restantes se contabilizan, no se repiten.
const projectedPanels = 2 * 9 * 60 * weekdays;
const simulatedPanels = 18 * weekdays;
const extraPanels = projectedPanels - simulatedPanels;
const projectedLogins = 4 * weekdays;
const projectedPublic = 2 * 300;
const googleRequests = projectedPanels + projectedLogins + projectedPublic + 300 + accepted + 4;
// Estado inicial: uno por visita de asistencia/registro y dos por apertura de personal;
// dos paneles sin autenticar al abrir también invocan Vercel, no Google.
const fastLocalRequests = accepted + 300 + 4 * weekdays;
const functions = googleRequests + fastLocalRequests;
const projectedPropertiesMonth = propertyOps
  + extraPanels * profiles.panel.properties
  + (projectedLogins - 1) * profiles['account.get'].properties
  + (projectedPublic - 1) * profiles['public.config'].properties;
const projectedPeakDayProperties = maxDailyProperties
  + (1080 - 18) * profiles.panel.properties
  + 4 * profiles['account.get'].properties
  + 600 * profiles['public.config'].properties;
const assumptions = {
  students: 300, weekdaySessions: 180, openWeekdays: weekdays,
  staff: 2, manualRefreshPerStaffPerMinute: 1, activeHoursDaily: 9,
  freshAttendancePagePerMark: true, reports: 4,
  fastRequestSeconds: 0.02, vercelInstanceGB: 2,
  noOtherAccountProjects: true, noBotsOrAbusiveTraffic: true
};
const memorySweep = [4, 10, 20, 30].map(seconds => ({
  averageGoogleRequestSeconds: seconds,
  gbHoursNoConcurrencySharing: +((googleRequests * seconds + fastLocalRequests * 0.02) * 2 / 3600).toFixed(2)
}));
const cpuSweep = [10, 50, 100, 250, 500].map(milliseconds => ({
  averageActiveCPUmsPerFunction: milliseconds,
  cpuHours: +(functions * milliseconds / 3600000).toFixed(3)
}));
// Referencia CPU local de la API Node, sin ejecutar el simulador de Google dentro
// del tramo cronometrado. Incluye parseo de JSON simulado, sesión y serialización.
const token = createSession('Administrador', 1, h.env.SESSION_SECRET);
const panelRaw = JSON.stringify({ ok: true, data: lastPanel });
async function benchmark(path, repetitions, body) {
  const start = process.cpuUsage();
  for (let i = 0; i < repetitions; i++) {
    const req = { url: '/api/' + path, method: body ? 'POST' : 'GET', body,
      socket: { remoteAddress: 'QA' }, headers: { host: 'qa.local', origin: 'http://qa.local', cookie: 'gym_session=' + token } };
    const res = { setHeader() {}, end() {} };
    await handleApi(req, res, { env: h.env, invoke: async action => action === 'panel'
      ? JSON.parse(panelRaw).data : { fullName: 'QA', message: 'QA' } });
    assert.equal(res.statusCode, 200);
  }
  const usage = process.cpuUsage(start);
  // Algunos entornos Windows devuelven cero: no confundirlo con CPU gratuita.
  return usage.user + usage.system > 0
    ? +((usage.user + usage.system) / repetitions / 1000).toFixed(3) : null;
}
const cpuLocal = {
  caveat: 'Referencia de CPU local; no medición de Vercel, red, coste Google ni garantía de facturación.',
  fullMonthPanelMs: await benchmark('panel?shift=TODO', 100),
  attendanceApiMs: await benchmark('attend', 1000, { code: '0000000001', method: 'CARNET' })
};
const projectedPanelGB = projectedPanels * maxPanelBytes / 1e9;
const result = {
  scope: 'SOLO SIMULACIÓN LOCAL Y PROYECCIONES, SIN GOOGLE/VERCEL REALES',
  assumptions,
  actualSimulation: { students: 300, reservations: 900, acceptedAttendance: accepted,
    absences: 0, faultTriggers, monthlyTriggers, googleWebRequests,
    sheets: { ...h.stats }, propertyOps, maxDailyProperties, maxPanelBytes,
    peakMinute: { reads: Math.max(...[...minutes.values()].map(v => v.reads)), writes: Math.max(...[...minutes.values()].map(v => v.writes)) },
    monthlyClose: rollover, exportCount: h.stats.exports - archiveBefore, nextMonthEmpty: true, passwordChanges: 0 },
  projection: { projectedPanels, googleRequests, fastLocalRequests, functions,
    projectedPropertiesMonth, projectedPeakDayProperties,
    panelTransferGBUsingLargestPanelEveryTime: +projectedPanelGB.toFixed(3),
    memorySweep, cpuSweep,
    memoryBreakEvenAverageSeconds: +((360 * 3600 / 2 - fastLocalRequests * 0.02) / googleRequests).toFixed(2),
    cpuBreakEvenAverageMs: +(4 * 3600000 / functions).toFixed(2),
    triggerDailyMinutesIfFaults4sChecks1s: +(96 * 4 / 60 + 24 / 60).toFixed(2),
    triggerFaultAverageBreakEvenSecondsIfChecks1s: +((90 * 60 - 24) / 96).toFixed(2)
  }, cpuLocal
};
console.log('RESULTADO_FINAL\n' + JSON.stringify(result, null, 2));
