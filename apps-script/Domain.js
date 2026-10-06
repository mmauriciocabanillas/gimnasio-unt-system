/* Lógica compartida: se ejecuta en Apps Script y en las pruebas locales. */
var GymDomain = (function () {
  'use strict';
  var DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var BLOCKS = [8, 9, 10, 11, 15, 16, 17, 18, 19].map(function (hour) {
    return { start: String(hour).padStart(2, '0') + ':00', end: String(hour + 1).padStart(2, '0') + ':00', shift: hour < 12 ? 'MANANA' : 'TARDE' };
  });
  function fail(message, status) { var error = new Error(message); error.status = status || 400; throw error; }
  function norm(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function text(value, label, max) {
    var result = String(value || '').trim().replace(/\s+/g, ' ');
    if (!result || result.length > (max || 120) || /[\x00-\x1f]/.test(result)) fail('Revisa ' + label + '.');
    return result;
  }
  function lima(now) {
    var date = new Date(new Date(now).getTime() - 5 * 3600000);
    if (!Number.isFinite(date.getTime())) fail('Fecha inválida.');
    return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 16), day: date.getUTCDay(), period: date.toISOString().slice(0, 7) };
  }
  function instant(date, time) { return new Date(date + 'T' + time + ':00-05:00').getTime(); }
  function nextPeriod(period) { var d = new Date(period + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); }
  function empty(period, config) {
    // Solo digitos confirmado por el personal; longitud exacta del carnet pendiente.
    return { period: period, config: config || { days: [1, 2, 3, 4, 5], capacity: 20, maxAbsences: 3, enabled: false, codePattern: '^[0-9]{1,40}$' }, students: [], reservations: [], attendance: [], absences: [], closures: [], audit: [] };
  }
  function code(value, state) {
    var result = text(value, 'el código', 40);
    var pattern;
    try { pattern = new RegExp(state.config.codePattern); } catch (_) { fail('El formato del código no está configurado correctamente.', 503); }
    if (!pattern.test(result)) fail('El código leído no coincide con el formato configurado.');
    return result;
  }
  function checkSlots(slots, state) {
    if (!Array.isArray(slots) || slots.length < 1 || slots.length > 3) fail('Selecciona entre uno y tres días.');
    var seen = {};
    return slots.map(function (slot) {
      var day = Number(slot.day), start = String(slot.start);
      if (!state.config.days.includes(day) || !BLOCKS.some(function (b) { return b.start === start; }) || seen[day]) fail('Selecciona una sola sesión por día habilitado.');
      seen[day] = true;
      return { day: day, start: start };
    }).sort(function (a, b) { return a.day - b.day; });
  }
  function liveReservations(state) { return state.reservations.filter(function (r) { return !r.until; }); }
  function activeReservations(state, now) {
    var time = new Date(now || Date.now()).getTime();
    return state.reservations.filter(function (r) { return new Date(r.from).getTime() <= time && (!r.until || time < new Date(r.until).getTime()); });
  }
  function occupancy(state, excluding, now) {
    var counts = {}, seen = {}, cutoff = new Date(now || Date.now()).getTime();
    // Reservar también el horario anterior mientras el cambio futuro no rige.
    state.reservations.filter(function (r) { return !r.until || new Date(r.until).getTime() > cutoff; }).forEach(function (r) {
      var identity = r.code + '|' + r.day + '|' + r.start;
      if (r.code !== excluding && !seen[identity]) { seen[identity] = true; var key = r.day + '|' + r.start; counts[key] = (counts[key] || 0) + 1; }
    });
    return state.config.days.flatMap(function (day) { return BLOCKS.map(function (block) { var occupied = counts[day + '|' + block.start] || 0; return Object.assign({ day: day, dayName: DAYS[day], occupied: occupied, available: Math.max(0, state.config.capacity - occupied) }, block); }); });
  }
  function checkCapacity(slots, state, excluding, now) {
    var counts = occupancy(state, excluding, now);
    slots.forEach(function (slot) { var item = counts.find(function (c) { return c.day === slot.day && c.start === slot.start; }); if (!item || item.available < 1) fail('El cupo de ' + DAYS[slot.day] + ' ' + slot.start + ' se completó. Elige otro horario.', 409); });
  }
  function closed(state, date, shift) { return state.closures.some(function (c) { return c.date === date && c.closed && (c.shift === 'TODO' || c.shift === shift); }); }
  function blockFor(start) { return BLOCKS.find(function (b) { return b.start === start; }); }
  function sessionKey(codeValue, date, start) { return codeValue + '|' + date + '|' + start; }
  function sessions(state, now) {
    var endDate = Math.min(new Date(now).getTime(), instant(nextPeriod(state.period) + '-01', '00:00'));
    var date = new Date(state.period + '-01T12:00:00Z'), rows = [];
    while (date.toISOString().slice(0, 7) === state.period) {
      var dateText = date.toISOString().slice(0, 10), day = date.getUTCDay();
      state.reservations.forEach(function (r) {
        var block = blockFor(r.start), start = instant(dateText, r.start);
        if (r.day !== day || start < new Date(r.from).getTime() || (r.until && start >= new Date(r.until).getTime()) || start >= endDate) return;
        rows.push({ key: sessionKey(r.code, dateText, r.start), code: r.code, date: dateText, start: r.start, end: block.end, shift: block.shift, day: day, finished: instant(dateText, block.end) <= endDate, closed: closed(state, dateText, block.shift) });
      });
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return rows.sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
  }
  function recalculate(state, now) {
    var marked = new Set(state.attendance.map(function (a) { return a.key; })), counts = {}, result = [];
    sessions(state, now).forEach(function (s) {
      if (!s.finished || marked.has(s.key)) return;
      var status = s.closed ? 'ANULADA_CIERRE' : (counts[s.code] || 0) >= state.config.maxAbsences ? 'NO_APLICA_BLOQUEO' : 'CONTABILIZADA';
      if (status === 'CONTABILIZADA') counts[s.code] = (counts[s.code] || 0) + 1;
      result.push(Object.assign({}, s, { status: status }));
    });
    state.absences = result;
    state.students.forEach(function (s) { s.absences = counts[s.code] || 0; s.status = s.absences >= state.config.maxAbsences ? 'BLOQUEADO' : 'ACTIVO'; });
    return state;
  }
  function requirePeriod(state, now) { if (state.period !== lima(now).period) fail('El cambio mensual está pendiente. El personal debe revisar la automatización.', 503); }
  function register(state, input, now) {
    requirePeriod(state, now);
    if (!state.config.enabled) fail('Las inscripciones aún no están habilitadas.', 503);
    if (input.period !== undefined && input.period !== state.period) fail('El mes cambió. Actualiza la página y revisa tus horarios antes de inscribirte.', 409);
    if (input.method !== 'CARNET') fail('La inscripción requiere leer el carnet.');
    var value = code(input.code, state);
    if (state.students.some(function (s) { return s.code === value; })) fail('Este código ya está inscrito en el mes.', 409);
    var slots = checkSlots(input.slots, state); checkCapacity(slots, state, null, now);
    var cycle = Number(input.cycle); if (!Number.isInteger(cycle) || cycle < 1 || cycle > 20) fail('Revisa el ciclo de estudios.');
    var student = { code: value, names: text(input.names, 'los nombres'), surnames: text(input.surnames, 'los apellidos'), faculty: text(input.faculty, 'la facultad'), career: text(input.career, 'la carrera'), cycle: cycle, createdAt: new Date(now).toISOString(), absences: 0, status: 'ACTIVO' };
    student.fullName = student.names + ' ' + student.surnames;
    state.students.push(student);
    slots.forEach(function (s) { state.reservations.push(Object.assign({ code: value, from: student.createdAt, until: '' }, s)); });
    return { fullName: student.fullName, period: state.period, slots: slots, message: 'Inscripción confirmada. Tus reservas se aplican desde la próxima sesión que aún no haya comenzado.' };
  }
  function attend(state, input, now) {
    requirePeriod(state, now); recalculate(state, now);
    var value = code(input.code, state), student = state.students.find(function (s) { return s.code === value; });
    if (!student) fail('No estás inscrito en este mes.', 404);
    if (!['CARNET', 'MANUAL'].includes(input.method)) fail('Método de asistencia inválido.');
    if (input.method === 'MANUAL' && norm(input.fullName) !== norm(student.fullName)) fail('El código y el nombre completo no coinciden.');
    if (student.status === 'BLOQUEADO') fail('Tienes tres faltas. Estás bloqueado hasta terminar el mes.', 403);
    var local = lima(now), today = state.reservations.filter(function (r) { return r.code === value && r.day === local.day && instant(local.date, r.start) >= new Date(r.from).getTime() && (!r.until || instant(local.date, r.start) < new Date(r.until).getTime()); });
    if (!today.length) fail('No tienes una sesión programada para hoy.');
    var reservation = today.find(function (r) { var b = blockFor(r.start); return local.time >= b.start && local.time < b.end; });
    if (!reservation) fail('Tu horario de hoy es ' + today.map(function (r) { return r.start + '–' + blockFor(r.start).end; }).join(', ') + '.');
    var block = blockFor(reservation.start);
    if (closed(state, local.date, block.shift)) fail('El gimnasio está cerrado en este turno.');
    var key = sessionKey(value, local.date, reservation.start);
    if (state.attendance.some(function (a) { return a.key === key; })) return { duplicate: true, fullName: student.fullName, message: 'Tu asistencia ya está registrada para esta sesión.' };
    state.attendance.push({ key: key, code: value, date: local.date, start: reservation.start, end: block.end, shift: block.shift, method: input.method, timestamp: new Date(now).toISOString() });
    return { fullName: student.fullName, message: 'Asistencia registrada: ' + reservation.start + '–' + block.end + '.' };
  }
  function closure(state, input, actor, now) {
    var date = String(input.date), shift = String(input.shift);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== state.period || lima(instant(date, '12:00')).date !== date) fail('Selecciona una fecha válida del mes operativo.');
    if (!['MANANA', 'TARDE', 'TODO'].includes(shift) || typeof input.closed !== 'boolean') fail('Revisa el turno y el estado.');
    var item = { date: date, shift: shift, closed: input.closed, reason: text(input.reason, 'el motivo', 300), actor: actor, timestamp: new Date(now).toISOString() };
    var index = state.closures.findIndex(function (c) { return c.date === date && c.shift === shift; });
    if (index < 0) state.closures.push(item); else state.closures[index] = item;
    state.audit.push({ action: 'CIERRE', actor: actor, timestamp: item.timestamp, detail: JSON.stringify(item) });
    recalculate(state, now); return item;
  }
  function changeSchedule(state, input, actor, now) {
    var value = code(input.code, state), student = state.students.find(function (s) { return s.code === value; });
    if (!student) fail('Alumno no encontrado.', 404);
    var date = String(input.effectiveDate), local = lima(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= local.date || date.slice(0, 7) !== state.period || lima(instant(date, '12:00')).date !== date) fail('El cambio debe empezar mañana o después, dentro del mes.');
    if (state.reservations.some(function (r) { return r.code === value && new Date(r.from).getTime() > new Date(now).getTime(); })) fail('Este alumno ya tiene un cambio futuro. Espera a su fecha de aplicación.');
    var slots = checkSlots(input.slots, state); checkCapacity(slots, state, value, now);
    var from = new Date(instant(date, '00:00')).toISOString();
    liveReservations(state).filter(function (r) { return r.code === value; }).forEach(function (r) { r.until = from; });
    slots.forEach(function (s) { state.reservations.push(Object.assign({ code: value, from: from, until: '' }, s)); });
    state.audit.push({ action: 'HORARIO', actor: actor, timestamp: new Date(now).toISOString(), detail: JSON.stringify({ code: value, effectiveDate: date, slots: slots }) });
    return { message: 'Horario actualizado desde ' + date + '. Se conserva el historial anterior.' };
  }
  function configure(state, input, actor, now) {
    var days = Array.from(new Set((input.days || []).map(Number))).sort();
    if (!days.length || days.some(function (d) { return !Number.isInteger(d) || d < 0 || d > 6; })) fail('Selecciona días válidos.');
    if (state.students.length && state.config.days.some(function (d) { return !days.includes(d); })) fail('Con inscritos, usa Cierres para suspender un día. No elimines días ya reservados.');
    var pattern = text(input.codePattern, 'el formato del código', 160);
    // Limitar a formatos simples evita regex con repeticiones anidadas.
    if (!/^\^\[[A-Za-z0-9\\\-]+\]\{\d+(,\d+)?\}\$$/.test(pattern)) fail('Usa un formato simple como ^[0-9]{10}$ o ^[A-Za-z0-9-]{4,30}$.');
    try { new RegExp(pattern); } catch (_) { fail('Formato de código inválido.'); }
    if (state.students.some(function (s) { return !new RegExp(pattern).test(s.code); })) fail('El formato debe admitir los códigos ya inscritos.');
    state.config = Object.assign({}, state.config, { days: days, codePattern: pattern, enabled: Boolean(input.enabled), capacity: 20, maxAbsences: 3 });
    state.audit.push({ action: 'CONFIGURACION', actor: actor, timestamp: new Date(now).toISOString(), detail: JSON.stringify(state.config) });
    return state.config;
  }
  function dashboard(state, now, shift, alreadyCalculated) {
    if (!alreadyCalculated) recalculate(state, now);
    var matches = function (s) { return !shift || shift === 'TODO' || s.shift === shift; };
    var absenceByKey = new Map(state.absences.map(function (a) { return [a.key, a]; }));
    var expected = sessions(state, now).filter(matches), eligible = expected.filter(function (s) { var a = absenceByKey.get(s.key); return !s.closed && (!a || a.status !== 'NO_APLICA_BLOQUEO'); });
    var eligibleKeys = new Set(eligible.map(function (s) { return s.key; }));
    var attendance = state.attendance.filter(matches), absences = state.absences.filter(function (a) { return matches(a) && a.status === 'CONTABILIZADA'; });
    var finished = eligible.filter(function (s) { return s.finished; }), finishedKeys = new Set(finished.map(function (s) { return s.key; }));
    var received = attendance.filter(function (a) { return finishedKeys.has(a.key); }).length;
    var slots = occupancy(state, null, now).filter(matches), codes = new Set(activeReservations(state, now).filter(function (r) { return matches(blockFor(r.start)); }).map(function (r) { return r.code; }));
    var local = lima(now), today = sessions(state, new Date(instant(local.date, '23:59')).toISOString()).filter(function (s) { return s.date === local.date && matches(s); });
    var byBlock = BLOCKS.filter(matches).map(function (b) { var bs = slots.filter(function (s) { return s.start === b.start; }), ts = today.filter(function (s) { return s.start === b.start; }); return Object.assign({ occupied: bs.reduce(function (n, s) { return n + s.occupied; }, 0), capacity: bs.length * state.config.capacity, attendance: attendance.filter(function (a) { return a.start === b.start; }).length, scheduledToday: ts.filter(function (s) { return !s.closed; }).length, attendanceToday: attendance.filter(function (a) { return a.date === local.date && a.start === b.start; }).length, absencesToday: absences.filter(function (a) { return a.date === local.date && a.start === b.start; }).length }, b); });
    var byDay = state.config.days.map(function (day) { return { day: day, label: DAYS[day], attendance: attendance.filter(function (a) { return lima(instant(a.date, '12:00')).day === day; }).length }; });
    var byShift = ['MANANA', 'TARDE'].map(function (sh) { return { shift: sh, attendance: attendance.filter(function (a) { return a.shift === sh; }).length }; });
    return { period: state.period, today: local.date, shift: shift || 'TODO', registered: codes.size, attendance: attendance.length, absences: absences.length, blocked: state.students.filter(function (s) { return codes.has(s.code) && s.status === 'BLOQUEADO'; }).length, attendanceRate: finished.length ? Math.round(received / finished.length * 100) : 0, finishedApplicable: finished.length, byBlock: byBlock, byDay: byDay, byShift: byShift, slots: slots, attendanceApplicable: attendance.filter(function (a) { return eligibleKeys.has(a.key); }).length };
  }
  return { DAYS: DAYS, BLOCKS: BLOCKS, empty: empty, lima: lima, instant: instant, nextPeriod: nextPeriod, norm: norm, fail: fail, occupancy: occupancy, sessions: sessions, recalculate: recalculate, register: register, attend: attend, closure: closure, changeSchedule: changeSchedule, configure: configure, dashboard: dashboard, blockFor: blockFor, activeReservations: activeReservations };
})();
