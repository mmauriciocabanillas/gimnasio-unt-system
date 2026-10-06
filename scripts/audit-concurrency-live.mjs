/* Producción: lecturas concurrentes y rechazos de alumnos ficticios inexistentes.
 * No registra alumnos, modifica cuentas/configuración ni adelanta el mes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'https://gimnasiount.vercel.app', results = [];
const source = await readFile(new URL('./setup.mjs', import.meta.url), 'utf8');
const initial = [...source.matchAll(/hashPassword\('([^']+)'\)/g)].map(m => m[1]);
let cookie;
async function request(path, body) {
  const start = performance.now();
  const response = await fetch(base + '/api/' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { Origin: base, 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(55000) });
  const data = await response.json();
  if (path === 'login' && response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const evidence = { path, status: response.status, ms: Math.round(performance.now() - start), revision: data.revision, error: data.error };
  results.push(evidence); console.log(JSON.stringify(evidence));
  return { status: response.status, data };
}
let report;
try {
  const login = await request('login', { user: 'Administrador', password: initial[1] }); assert.equal(login.status, 200);
  const first = await request('panel?shift=TODO'); assert.equal(first.status, 200);
  const before = first.data, codes = Array.from({ length: 4 }, (_, i) => String(99000001 + i));
  let automation;
  if (process.argv.includes('--automation')) { const check = await request('automation'); assert.equal(check.status, 200); automation = check.data; }
  assert.ok(codes.every(code => new RegExp(before.config.codePattern).test(code) && !before.students.some(s => s.code === code)), 'Los códigos QA deben ser válidos y no pertenecer a alumnos.');
  const startReads = performance.now();
  const parallelReads = await Promise.all(Array.from({ length: 4 }, () => request('public')));
  const readsWallMs = Math.round(performance.now() - startReads);
  assert.ok(parallelReads.every(r => r.status === 200));
  const startRejected = performance.now();
  const parallelRejected = await Promise.all(codes.map(code => request('attend', { code, method: 'CARNET' })));
  const rejectedWallMs = Math.round(performance.now() - startRejected);
  assert.ok(parallelRejected.every(r => r.status === 404 && /No estás inscrito/.test(r.data.error)));
  const last = await request('panel?shift=TODO'); assert.equal(last.status, 200);
  const stable = p => ({ period: p.dashboard.period, students: p.students, attendance: p.attendance, absences: p.absences, closures: p.closures, config: p.config });
  assert.deepEqual(stable(last.data), stable(before));
  report = { at: new Date().toISOString(), base, revision: before.revision, period: before.dashboard.period,
    registrationEnabled: before.config.enabled, automation, parallelReads: { requests: 4, wallMs: readsWallMs, statuses: parallelReads.map(r => r.status) },
    parallelFictitiousAttendance: { requests: 4, wallMs: rejectedWallMs, statuses: parallelRejected.map(r => r.status), studentsDidNotExist: true },
    unchangedOperationalData: true, passwordChanges: 0, results,
    limitation: 'En Google real se verificaron lecturas y rechazos sin escritura. No acredita carreras al último cupo, asistencia aceptada simultánea ni el activador mensual real.' };
} finally { if (cookie) await request('logout', {}).catch(() => {}); }
await mkdir(new URL('../docs/simulacion/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/simulacion/concurrencia-remota-2026-10-06.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ unchangedOperationalData: report.unchangedOperationalData, revision: report.revision, passwordChanges: report.passwordChanges }));
