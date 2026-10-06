import assert from 'node:assert/strict';
import { handleApi } from '../../server/api.mjs';
import { googleHarness } from './google-harness.mjs';

export async function monthlyScenario() {
  const h = googleHarness(), events = [], cookies = new Map();
  const clock = (date, time = '07:00') => h.setTime(`${date}T${time}:00-05:00`);
  async function call(path, body, user, expected = 200, client = 'qa-staff') {
    const req = { url: `/api/${path}`, method: body === undefined ? 'GET' : 'POST', body, socket: { remoteAddress: client }, headers: { host: 'qa.local', origin: 'http://qa.local', ...(user && cookies.has(user) ? { cookie: cookies.get(user) } : {}) } };
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(raw) { this.body = JSON.parse(raw); } };
    await handleApi(req, res, { env: h.env, invoke: async (action, data) => h.invoke(action, data) });
    if (res.headers['Set-Cookie']) cookies.set(user || body.user, res.headers['Set-Cookie'].split(';')[0]);
    assert.equal(res.statusCode, expected, `${path}: ${JSON.stringify(res.body)}`);
    if (path !== 'attend' || expected !== 200 || res.body.duplicate) events.push({ at: h.now().toISOString(), action: path, status: res.statusCode, message: res.body.error || res.body.message || (res.body.duplicate ? 'Duplicado' : 'Correcto') });
    return res.body;
  }
  for (const user of Object.keys(h.passwords)) await call('login', { user, password: h.passwords[user] }, user);
  await call('login', { user: 'ProfesorGYM', password: 'QA_INCORRECTA' }, undefined, 401);
  await call('panel', undefined, undefined, 401);
  await call('configure', { days: [1, 2, 3, 4, 5], codePattern: '^[0-9]{8}$', enabled: true, includePanel: true }, 'Administrador');
  const inputs = [];
  for (let i = 1; i <= 120; i++) {
    let slots = i <= 20 ? [{ day: 1, start: '08:00' }] : [{ day: (i - 21) % 5 + 1, start: ['09:00', '10:00', '15:00', '16:00', '19:00'][Math.floor((i - 21) / 5) % 5] }, { day: (i - 19) % 5 + 1, start: ['11:00', '15:00', '16:00', '17:00', '18:00'][Math.floor((i - 21) / 5) % 5] }];
    if (i === 3) slots = [{ day: 1, start: '08:00' }, { day: 3, start: '09:00' }, { day: 5, start: '10:00' }];
    const input = { code: String(i).padStart(8, '0'), names: `Alumno ficticio ${String(i).padStart(3, '0')}`, surnames: 'Simulación UNT', faculty: ['Ingeniería (QA)', 'Educación (QA)', 'Ciencias (QA)'][i % 3], career: 'Carrera ficticia', cycle: i % 10 + 1, method: 'CARNET', slots };
    inputs.push(input); await call('register', input, undefined, 200, 'qa-student-' + i);
  }
  await call('register', inputs[0], undefined, 409);
  await call('register', { ...inputs[0], code: '99999999' }, undefined, 409);
  await call('register', { ...inputs[0], code: 'ABC' }, undefined, 400);
  await call('closure', { date: '2026-10-08', shift: 'TODO', closed: true, reason: 'Cierre ficticio de prueba', includePanel: true }, 'ProfesorGYM');
  await call('closure', { date: '2026-10-12', shift: 'MANANA', closed: true, reason: 'Mantenimiento ficticio', includePanel: true }, 'Administrador');
  let accepted = 0, duplicates = 0, reactivationVerified = false;
  for (let day = 1; day <= 31; day++) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday < 1 || weekday > 5) continue;
    for (const block of h.context.GymDomain.BLOCKS) {
      if (date === '2026-10-05' && block.start === '08:00') {
        clock(date);
        const changed = await call('schedule', { code: '00000002', effectiveDate: '2026-10-07', slots: [{ day: 3, start: '19:00' }], includePanel: true }, 'Administrador');
        assert.equal(changed.panel.students.find(s => s.code === '00000002').slots[0].start, '08:00');
        assert.equal(changed.panel.students.find(s => s.code === '00000002').futureSlots[0].start, '19:00');
      }
      clock(date, block.start);
      const state = h.context.gymRead_(h.operational());
      const scheduled = h.context.GymDomain.activeReservations(state, h.now()).filter(r => r.day === weekday && r.start === block.start);
      for (const r of scheduled) {
        const i = Number(r.code), student = state.students.find(s => s.code === r.code);
        if (i === 3 || i % 10 === 0 && day < 15 || i % 7 === 0 && day % 11 === 0 || state.closures.some(c => c.date === date && c.closed && (c.shift === 'TODO' || c.shift === block.shift))) continue;
        const result = await call('attend', { code: r.code, method: i % 3 === 0 ? 'MANUAL' : 'CARNET', ...(i % 3 === 0 ? { fullName: student.fullName } : {}) }, undefined, student.status === 'BLOQUEADO' ? 403 : 200, 'qa-student-' + i);
        if (result.fullName) accepted++;
        if (!duplicates) { const before = h.stats.batchWrites; const duplicate = await call('attend', { code: r.code, method: 'CARNET' }, undefined, 200, 'qa-student-' + i); assert.equal(duplicate.duplicate, true); assert.equal(h.stats.batchWrites, before); duplicates++; }
      }
      clock(date, block.end); h.context.procesarFaltas();
      if (date === '2026-10-07' && block.start === '09:00') {
        let state = h.context.gymRead_(h.operational()); assert.equal(state.students.find(s => s.code === '00000003').status, 'BLOQUEADO');
        await call('closure', { date, shift: 'MANANA', closed: true, reason: 'Corrección ficticia retroactiva', includePanel: true }, 'Administrador');
        state = h.context.gymRead_(h.operational()); assert.equal(state.students.find(s => s.code === '00000003').status, 'ACTIVO');
        await call('closure', { date, shift: 'MANANA', closed: false, reason: 'Reapertura ficticia de control' }, 'ProfesorGYM');
        assert.equal(h.context.gymRead_(h.operational()).students.find(s => s.code === '00000003').status, 'BLOQUEADO'); reactivationVerified = true;
      }
    }
  }
  clock('2026-10-30', '20:00');
  await call('attend', { code: '00000001', method: 'CARNET' }, undefined, 400);
  await call('attend', { code: '00000001', method: 'MANUAL', fullName: 'Nombre que no coincide' }, undefined, 400);
  await call('attend', { code: '99999998', method: 'CARNET' }, undefined, 404);
  const panel = await call('panel?shift=TODO', undefined, 'Administrador');
  assert.equal(panel.students.length, 120); assert.equal(panel.attendance.length, accepted);
  assert.ok(panel.dashboard.slots.every(s => s.occupied <= 20));
  for (const shift of ['TODO', 'MANANA', 'TARDE']) {
    const before = h.props.get('CURRENT_PERIOD');
    const report = await call('export', { shift, archive: shift === 'TODO' }, 'Administrador');
    assert.ok(report.filename.endsWith('.xlsx')); assert.equal(h.props.get('CURRENT_PERIOD'), before);
    assert.equal(h.exports.at(-1).sheets.find(s => s.name === 'GRÁFICOS').charts.length, 3);
  }
  const october = JSON.parse(JSON.stringify(h.context.gymRead_(h.operational())));
  const oldCookie = cookies.get('Administrador');
  await call('password', { currentPassword: h.passwords.Administrador, newPassword: 'QA_NEW_ADMIN_5678', confirmPassword: 'QA_NEW_ADMIN_5678' }, 'Administrador');
  const newCookie = cookies.get('Administrador'); cookies.set('Administrador', oldCookie);
  await call('panel', undefined, 'Administrador', 401); cookies.set('Administrador', newCookie);
  await call('panel', undefined, 'Administrador');
  clock('2026-11-01'); const rollover = h.context.procesarCambioMensual();
  assert.equal(rollover.closed, '2026-10'); assert.equal(rollover.opened, '2026-11');
  const november = h.context.gymRead_(h.operational()); assert.equal(november.students.length, 0); assert.equal(november.attendance.length, 0);
  const exportCount = h.stats.exports; h.context.procesarCambioMensual(); assert.equal(h.stats.exports, exportCount);
  assert.equal(JSON.parse(h.props.get('ACCOUNT_Administrador')).version, 2);
  for (const f of h.files.values()) if (f.name?.startsWith('TEMP_REPORTE_')) assert.equal(f.trashed, true);
  await call('logout', {}, 'ProfesorGYM'); await call('panel', undefined, 'ProfesorGYM', 401);
  return { h, inputs, october, november: JSON.parse(JSON.stringify(november)), panel, events, summary: { period: '2026-10', students: 120, reservations: october.reservations.length, attendance: accepted, countedAbsences: panel.dashboard.absences, blocked: panel.dashboard.blocked, attendanceRate: panel.dashboard.attendanceRate, duplicatesPrevented: duplicates, reactivationVerified, exportScenarios: h.stats.exports, nextMonth: november.period, nextMonthStudents: 0 } };
}
