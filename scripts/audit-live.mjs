/* Verificación remota: lecturas/login y exportación opcional, sin alumnos ficticios. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'https://gimnasiount.vercel.app', results = [], output = new URL('../docs/simulacion/', import.meta.url);
const source = await readFile(new URL('./setup.mjs', import.meta.url), 'utf8');
const initial = [...source.matchAll(/hashPassword\('([^']+)'\)/g)].map(x => x[1]);
let cookie;
async function request(path, body) {
  const start = performance.now();
  const response = await fetch(base + '/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { Origin: base, 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(55000) });
  const data = await response.json();
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const entry = { action: path, status: response.status, ms: Math.round(performance.now() - start), revision: data.revision, error: data.error };
  results.push(entry); console.log(JSON.stringify(entry));
  if (!response.ok) throw new Error(data.error || 'Verificación remota falló.');
  return data;
}
try {
  await request('public');
  await request('login', { user: 'Administrador', password: initial[1] });
  const before = await request('panel?shift=TODO');
  if (process.argv.includes('--export')) {
    const report = await request('export', { shift: 'TODO', archive: false });
    assert.ok(report.base64 && report.filename.endsWith('.xlsx')); assert.equal(report.driveUrl, null);
    const bytes = Buffer.from(report.base64, 'base64'); assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    await mkdir(output, { recursive: true });
    await writeFile(new URL('exportacion-real-google.xlsx', output), bytes);
    console.log(JSON.stringify({ filename: report.filename, bytes: bytes.length, permanentDriveCopy: false }));
  }
  const after = await request('panel?shift=TODO');
  const stable = panel => ({ period: panel.dashboard.period, students: panel.students, attendance: panel.attendance, closures: panel.closures, config: panel.config });
  assert.deepEqual(stable(after), stable(before));
  await mkdir(output, { recursive: true });
  await writeFile(new URL('verificacion-remota.json', output), JSON.stringify({ at: new Date().toISOString(), base, results, unchangedOperationalData: true, students: after.students.length, attendance: after.attendance.length, period: after.dashboard.period }, null, 2));
  console.log(JSON.stringify({ unchangedOperationalData: true, students: after.students.length, attendance: after.attendance.length, period: after.dashboard.period }));
} finally { if (cookie) await request('logout', {}).catch(() => {}); }
