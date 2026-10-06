import './style.css';
import './template.css';
import './access.css';
import './interaction.css';
import { paginate } from './pagination.js';
import { normalizeRoute } from './routes.js';
import { monthEndDate } from './calendar.js';

const root = document.querySelector('#app');
const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const hours = [8, 9, 10, 11, 15, 16, 17, 18, 19];
let status = null, publicData = null, panelData = null, user = null, loadError = '';
let scannedCode = '', scanControls = null, scannerGeneration = 0, shift = 'TODO', tab = 'resumen';
let registrationDraft = null, pending = false;
let panelUpdatedAt = '', panelRequest = 0;
const inflight = new Map();
const currentRoute = () => normalizeRoute(location.pathname);
const historyPages = { attendance: 0, absences: 0 };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const periodLabel = value => value ? new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`)) : 'Inscripción mensual';
const shiftLabel = value => ({ TODO: 'Todo el día', MANANA: 'Turno mañana', TARDE: 'Turno tarde' })[value];
const field = (label, name, options = '') => `<label>${label}<input name="${name}" ${options} required></label>`;
const spinner = '<span class="loader" aria-hidden="true"></span>';
const iconPaths = {
  resumen: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  inscritos: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  asistencia: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-12 5 2 2 4-4"/>',
  cierres: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.1"/>',
  reportes: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8M9 17v-4m4 4V9m4 8v-6"/>',
  qr: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3v3h-6v-3m6-3v-3M3 12h6m3-9v6m0 6v6"/>',
  configuracion: '<path d="m9 3-.8 3-2.8 1-2.7-.8L1 11l2.2 2-.1 3L1.8 18l3 3 2.8-1 2.8 1 .8 2h4l.8-2 2.8-1 2.8 1 3-3-1.3-2 .1-3 2.2-2-1.7-4.8-2.7.8-2.8-1-.8-3Z"/><circle cx="12" cy="13" r="3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>'
};
const icon = name => `<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.resumen}</svg>`;

async function api(path, body) {
  const get = body === undefined;
  if (get && inflight.has(path)) return inflight.get(path);
  const request = (async () => {
    let response, data;
    try {
      response = await fetch(`/api/${path}`, { method: get ? 'GET' : 'POST', headers: get ? {} : { 'Content-Type': 'application/json' }, body: get ? undefined : JSON.stringify(body), credentials: 'same-origin', signal: AbortSignal.timeout(65000) });
      data = await response.json();
    } catch { throw new Error(get ? 'No se pudo consultar el sistema. Intenta actualizar.' : 'No se pudo confirmar la respuesta. Verifica si se guardó antes de repetir la operación.'); }
    if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la operación.'); error.status = response.status; throw error; }
    return data;
  })();
  if (get) inflight.set(path, request);
  try { return await request; } finally { if (get) inflight.delete(path); }
}
function feedback(message, kind = 'error') {
  if (root.dataset.screen === 'welcome') { loadError = message; return; }
  const dialog = document.querySelector('dialog[open]');
  let box = dialog ? dialog.querySelector('.dialog-feedback') : document.querySelector('#feedback');
  if (dialog && !box) { box = document.createElement('div'); box.className = 'dialog-feedback'; dialog.prepend(box); }
  if (!box) { box = document.createElement('div'); box.id = 'feedback'; document.querySelector('main').prepend(box); }
  box.className = `${dialog ? 'dialog-feedback ' : ''}notice ${kind}`; box.setAttribute('role', kind === 'error' ? 'alert' : 'status'); box.textContent = message;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function stopCamera() { scannerGeneration++; if (scanControls) scanControls.stop(); scanControls = null; }
function navigate(path) { stopCamera(); scannedCode = ''; registrationDraft = null; history.pushState({}, '', path); render(); window.scrollTo(0, 0); if (currentRoute() === '/registro' && !publicData) loadRegistration(); }
function shell(content, audience = 'staff') {
  const student = audience === 'student';
  document.documentElement.dataset.layout = student ? 'public' : 'staff';
  root.dataset.audience = student ? 'student' : 'staff';
  root.dataset.screen = student ? 'student' : user ? 'panel' : 'login';
  const brand = `<img src="/logo.webp" alt="Logo del Gimnasio UNT"><span>GIMNASIO <b>UNT</b><small>Universidad Nacional de Trujillo</small></span>`;
  const notice = status && !status.connected ? `<div class="notice setup" role="status">${student ? 'Este servicio todavía no está disponible. Intenta más tarde.' : 'Sistema pendiente de activación. Completa la conexión para habilitar el acceso.'}</div>` : '';
  const themeButton = student ? '' : `<button class="theme icon-button" data-action="theme" aria-label="Cambiar modo claro u oscuro">${document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'}</button>`;
  root.innerHTML = `<header class="topbar"><div class="brand">${brand}</div><div class="header-actions">${student ? '<span class="header-label">ESTUDIANTES</span>' : `<span class="header-label">${user ? escape(user) : 'ACCESO DEL PERSONAL'}</span>`}${themeButton}</div></header><main>${notice}${content}</main><footer><span>Gimnasio UNT</span><span>Universidad Nacional de Trujillo</span></footer>`;
}
function backLink() { return '<a class="back" href="/" data-nav>← Volver al inicio</a>'; }
function pageTitle(kicker, title, description) { return `<div class="page-heading"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>`; }
function scannerMarkup() {
  return `<section class="scan-box"><div class="scan-title"><span class="step-dot">1</span><div><h2>Escanea tu carnet UNT</h2><p>Apunta la cámara al código de barras de tu carnet.</p></div></div><div id="camera-area" class="camera-area" hidden><video id="camera" autoplay muted playsinline></video><div class="scan-guide"></div></div><div class="scan-bottom"><button class="button secondary" type="button" data-action="scan">Abrir cámara</button><button class="button quiet" type="button" data-action="stop-scan" hidden>Cerrar cámara</button><output id="scan-result" aria-live="polite">Carnet pendiente de lectura</output></div><p class="micro">La lectura obtiene tu código. No consulta una base oficial de matrícula.</p></section>`;
}
function slotPicker(data = publicData, prefix = '') {
  const selectedDays = data?.days || [1, 2, 3, 4, 5];
  return `<div class="schedule-grid">${selectedDays.map(day => `<label class="slot-day"><span>${days[day]}</span><select name="${prefix}day-${day}" ${!data ? 'disabled' : ''}><option value="">No asistiré</option>${hours.map(h => { const start = `${String(h).padStart(2, '0')}:00`, item = data?.slots?.find(s => s.day === day && s.start === start); const full = item && item.available === 0; return `<option value="${start}" ${full ? 'disabled' : ''}>${start}–${String(h + 1).padStart(2, '0')}:00${item ? full ? ' · Completo' : ` · ${item.available} libres` : ''}</option>`; }).join('')}</select></label>`).join('')}</div>`;
}
function registration() {
  shell(`${pageTitle('INSCRIPCIÓN MENSUAL', 'Un mes. Tus horarios.', 'Elige entre uno y tres días por semana. Cada día tendrás una sesión de una hora.')}<div id="feedback" aria-live="polite"></div><div class="registration-layout"><form id="registration-form" class="surface">${scannerMarkup()}<section class="form-section"><div class="section-label"><span class="step-dot">2</span><h2>Tus datos</h2></div><div class="form-grid">${field('Nombres', 'names', 'autocomplete="given-name" maxlength="120"')}${field('Apellidos', 'surnames', 'autocomplete="family-name" maxlength="120"')}${field('Facultad', 'faculty', 'maxlength="120"')}${field('Carrera / escuela', 'career', 'maxlength="120"')}${field('Ciclo de estudios', 'cycle', 'type="number" min="1" max="20" inputmode="numeric"')}</div></section><section class="form-section"><div class="section-label"><span class="step-dot">3</span><h2>Elige tus horarios</h2></div><p class="muted">Los horarios se repiten cada semana y quedan fijos durante el mes.</p>${slotPicker()}<p class="micro" id="selection-summary">Selecciona 1, 2 o 3 días.</p></section><button class="button primary full" ${!publicData?.enabled ? 'disabled' : ''}>Revisar inscripción →</button>${publicData && !publicData.enabled ? '<p class="micro">El personal todavía no ha abierto las inscripciones de este mes.</p>' : ''}</form><aside class="registration-aside"><span class="eyebrow">TU COMPROMISO DEL MES</span><h2>Reserva con<br>responsabilidad.</h2><ul><li>Una sesión por día.</li><li>Máximo tres días por semana.</li><li>Con tres faltas se bloquea el acceso hasta terminar el mes.</li><li>Los días o turnos cerrados no generan faltas.</li></ul><div class="period-chip">${escape(periodLabel(publicData?.period))}</div></aside></div>`, 'student');
}
function attendance() {
  shell(`<div class="attendance-checkin"><div class="checkin-heading"><span class="eyebrow">ASISTENCIA DEL DÍA</span><div class="checkin-symbol">${icon('asistencia')}</div><h1>Marca tu llegada.</h1><p>Ya estás inscrito. Solo confirma tu asistencia dentro de tu sesión reservada.</p></div><div id="feedback" aria-live="polite"></div><section class="checkin-reader" aria-label="Marcar asistencia con carnet"><div id="camera-area" class="camera-area" hidden><video id="camera" autoplay muted playsinline></video><div class="scan-guide"></div></div><button class="button primary full" type="button" data-action="scan">Escanear carnet UNT</button><button class="button quiet full" type="button" data-action="stop-scan" hidden>Cerrar cámara</button><output id="scan-result" aria-live="polite">Carnet pendiente de lectura</output><button class="button secondary full" type="button" data-action="attend-scan" ${!status?.connected ? 'disabled' : ''}>Confirmar asistencia</button><p class="micro">Escanea primero, confirma después.</p></section><details class="checkin-manual"><summary>¿Sin carnet? Marcar con mis datos</summary><p>Usa el código y nombre completo de tu inscripción del mes.</p><form id="manual-attendance">${field('Código de estudiante', 'code', 'maxlength="40" autocomplete="off"')}${field('Nombres y apellidos completos', 'fullName', 'maxlength="241" autocomplete="name"')}<button class="button primary full" ${!status?.connected ? 'disabled' : ''}>Confirmar asistencia manual</button></form></details><p class="micro checkin-note">Solo asistencia. No necesitas volver a inscribirte ni elegir horarios. Un segundo marcado no duplica tu asistencia.</p></div>`, 'student');
  root.dataset.screen = 'attendance';
}
function accessScreen(content, screen) {
  document.documentElement.dataset.layout = 'public';
  root.dataset.audience = 'staff';
  root.dataset.screen = screen;
  root.innerHTML = `<main class="access-main">${content}</main>`;
}
function welcome() {
  accessScreen(`<section class="access-screen login-intro"><span class="eyebrow">GIMNASIO UNT</span><img src="/logo.webp" alt="Gimnasio UNT"><h1>Un espacio.<br><em>Todo tu gimnasio.</em></h1><p>Organiza cada mes.<br>Acompaña cada entrenamiento.</p><button class="button welcome-enter" type="button" data-action="open-login">INGRESAR</button><div class="welcome-dots" aria-hidden="true"><span></span><span></span></div><span class="welcome-bottom">UNIVERSIDAD NACIONAL DE TRUJILLO</span></section>`, 'welcome');
}
function login() {
  if (location.hash !== '#ingresar') return welcome();
  const notice = status && !status.connected ? '<div class="notice setup" role="status">Sistema pendiente de activación. Completa la conexión para habilitar el acceso.</div>' : '';
  accessScreen(`<section class="access-screen surface login-card"><div class="login-symbol">${icon('user')}</div><span class="eyebrow">BIENVENIDO</span><h1>Ingresa a tu cuenta</h1><p class="muted">Acceso para profesores y administración.</p>${notice}<div id="feedback" aria-live="polite"></div><form id="login-form"><label>Usuario<select name="user" autocomplete="username"><option>ProfesorGYM</option><option>Administrador</option></select></label>${field('Contraseña', 'password', 'type="password" autocomplete="current-password" maxlength="128" placeholder="Tu contraseña"')}<label>Turno<select name="shift"><option value="MANANA">Turno mañana</option><option value="TARDE">Turno tarde</option><option value="TODO">Todo el día</option></select></label><button class="button primary full">Ingresar ${icon('arrow')}</button></form><p class="login-footnote">Dos cuentas. Un mismo panel.</p></section>`, 'login');
}
function metric(label, value, note) { return `<div class="metric"><span>${label}</span><strong>${escape(value)}</strong><small>${note}</small></div>`; }
function trendsView() {
  const d = panelData.dashboard;
  const most = [...d.byBlock].sort((a, b) => b.attendance - a.attendance)[0];
  const least = [...d.byBlock].sort((a, b) => a.attendance - b.attendance)[0];
  const day = [...d.byDay].sort((a, b) => b.attendance - a.attendance)[0];
  return `<div class="dashboard-columns trends"><section class="surface"><h2>Asistencia por turno</h2><div class="day-chart">${d.byShift.map(s => `<div><strong>${s.attendance}</strong><span>${shiftLabel(s.shift)}</span></div>`).join('')}</div><p class="micro">Marcados reales del alcance seleccionado.</p></section><section class="surface"><h2>Patrones del mes</h2>${d.attendance ? `<p class="muted">Más asistencias: ${most?.start || '—'} (${most?.attendance || 0}).<br>Menos asistencias: ${least?.start || '—'} (${least?.attendance || 0}).<br>Día más concurrido: ${escape(day?.label || '—')} (${day?.attendance || 0}).</p><p class="micro">En empates se muestra el primer bloque o día.</p>` : '<p class="muted">Aún no hay asistencias para comparar.</p>'}</section></div>`;
}
function panelSummary() {
  const d = panelData.dashboard;
  const ranked = [...d.byBlock].sort((a, b) => b.occupied - a.occupied);
  const leastRequested = [...d.byBlock].sort((a, b) => a.occupied - b.occupied)[0];
  return `<div class="metrics">${metric('Inscritos', d.registered, 'Con reserva en el turno')}${metric('Asistencias', d.attendance, 'Marcados del mes')}${metric('Faltas', d.absences, 'Sesiones contabilizadas')}${metric('Bloqueados', d.blocked, 'Por tres faltas')}${metric('Asistencia', `${d.attendanceRate}%`, `${d.finishedApplicable} sesiones finalizadas aplicables`)}</div><div class="dashboard-columns"><section class="surface"><div class="section-top"><h2>Así va tu día</h2><span class="tag">${escape(d.today)}</span></div><div class="table-wrap"><table><thead><tr><th>Horario</th><th>Programados</th><th>Asistencias</th><th>Faltas</th></tr></thead><tbody>${d.byBlock.map(b => `<tr><td>${b.start}–${b.end}</td><td>${b.scheduledToday}</td><td>${b.attendanceToday}</td><td>${b.absencesToday}</td></tr>`).join('')}</tbody></table></div><p class="micro">Las sesiones pendientes aún no son faltas. Los cierres se excluyen del cálculo.</p></section><section class="surface"><h2>Reservas por horario</h2><div class="bar-chart">${d.byBlock.map(b => `<div class="bar-row"><span>${b.start}</span><div class="bar-track"><div class="bar-fill" style="width:${b.capacity ? Math.min(100, b.occupied / b.capacity * 100) : 0}%"></div></div><b>${b.occupied}/${b.capacity}</b></div>`).join('')}</div><p class="micro">Más solicitado: ${ranked.length ? ranked[0].start : '—'} · Menos solicitado: ${ranked.length ? leastRequested.start : '—'}. En empates se muestra el primer bloque.</p><h3>Asistencia por día</h3><div class="day-chart">${d.byDay.map(day => `<div><strong>${day.attendance}</strong><span>${escape(day.label.slice(0, 3))}</span></div>`).join('')}</div></section></div>`;
}
function filteredStudents() { return panelData.students.filter(s => shift === 'TODO' || s.slots.some(r => (Number(r.start.slice(0, 2)) < 12 ? 'MANANA' : 'TARDE') === shift)); }
function studentsView() {
  return `<section class="surface"><div class="section-top"><h2>Inscritos del mes</h2><label class="search-label">Buscar alumno<input type="search" id="student-search" placeholder="Código o nombre"></label></div><div class="table-wrap"><table><thead><tr><th>Alumno</th><th>Facultad / carrera</th><th>Horario vigente</th><th>Faltas</th><th>Estado</th><th></th></tr></thead><tbody id="student-rows">${filteredStudents().map(s => `<tr data-search="${escape(`${s.code} ${s.fullName}`.toLowerCase())}"><td><b>${escape(s.fullName)}</b><small>${escape(s.code)} · Ciclo ${s.cycle}</small></td><td>${escape(s.faculty)}<small>${escape(s.career)}</small></td><td>${s.slots.map(r => `${days[r.day]} ${r.start}`).join('<br>')}${s.futureSlots?.length ? `<small>Pendiente desde ${escape(s.futureSlots[0].from.slice(0, 10))}: ${s.futureSlots.map(r => `${days[r.day]} ${r.start}`).join(', ')}</small>` : ''}</td><td>${s.absences}/3</td><td><span class="badge ${s.status === 'BLOQUEADO' ? 'blocked' : ''}">${escape(s.status)}</span></td><td><button class="button quiet" data-action="schedule" data-code="${escape(s.code)}">Cambiar horario</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No hay inscritos en este turno.</td></tr>'}<tr id="search-empty" hidden><td colspan="6" class="empty">Sin coincidencias.</td></tr></tbody></table></div></section>`;
}
function attendanceView() {
  const records = panelData.attendance.filter(a => shift === 'TODO' || a.shift === shift);
  const absences = panelData.absences.filter(a => a.status === 'CONTABILIZADA' && (shift === 'TODO' || a.shift === shift));
  const lookup = code => panelData.students.find(s => s.code === code)?.fullName || code;
  const recordsPage = paginate(records.slice().reverse(), historyPages.attendance);
  const absencesPage = paginate(absences.slice().reverse(), historyPages.absences);
  return `<div class="dashboard-columns"><section class="surface"><h2>Asistencias registradas</h2><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Alumno</th><th>Sesión</th><th>Método</th></tr></thead><tbody>${recordsPage.rows.map(a => `<tr><td>${escape(a.date)}</td><td>${escape(lookup(a.code))}<small>${escape(a.code)}</small></td><td>${a.start}–${a.end}</td><td>${escape(a.method)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sin asistencias.</td></tr>'}</tbody></table></div>${historyPager(recordsPage, 'attendance')}</section><section class="surface"><h2>Faltas contabilizadas</h2><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Alumno</th><th>Sesión</th></tr></thead><tbody>${absencesPage.rows.map(a => `<tr><td>${a.date}</td><td>${escape(lookup(a.code))}</td><td>${a.start}–${a.end}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin faltas.</td></tr>'}</tbody></table></div>${historyPager(absencesPage, 'absences')}</section></div>`;
}
function historyPager(page, kind) {
  return `<div class="history-pager"><span>${page.total} registros · Página ${page.page + 1}/${page.pages}</span><button class="button quiet" data-action="history-page" data-kind="${kind}" data-page="${page.page - 1}" ${page.page === 0 ? 'disabled' : ''}>Anterior</button><button class="button quiet" data-action="history-page" data-kind="${kind}" data-page="${page.page + 1}" ${page.page + 1 === page.pages ? 'disabled' : ''}>Siguiente</button></div>`;
}
function closuresView() {
  return `<div class="dashboard-columns"><section class="surface"><h2>Gestionar un cierre</h2><p class="muted">Cerrar o reabrir recalcula las faltas de las sesiones afectadas.</p><form id="closure-form">${field('Fecha', 'date', `type="date" value="${panelData.dashboard.today}" min="${panelData.dashboard.period}-01" max="${monthEndDate(panelData.dashboard.period)}"`)}<label>Turno<select name="shift"><option value="MANANA">Turno mañana</option><option value="TARDE">Turno tarde</option><option value="TODO">Todo el día</option></select></label><label>Estado<select name="closed"><option value="true">Cerrado</option><option value="false">Reabrir / corregir cierre</option></select></label>${field('Motivo', 'reason', 'maxlength="300" placeholder="Feriado, mantenimiento, suspensión…"')}<button class="button primary full">Confirmar estado</button></form><div class="quick-actions"><button class="button secondary" data-action="close-today" data-shift="MANANA">Hoy no abrió · mañana</button><button class="button secondary" data-action="close-today" data-shift="TARDE">Hoy no abrió · tarde</button></div><p class="micro">Reabrir un turno no revierte un cierre de «Todo el día»: corrige también ese registro si corresponde.</p></section><section class="surface"><h2>Cierres del mes</h2><div class="closure-list">${panelData.closures.map(c => `<article><div><b>${c.date} · ${shiftLabel(c.shift)}</b><span class="badge ${c.closed ? 'blocked' : ''}">${c.closed ? 'CERRADO' : 'ABIERTO'}</span></div><p>${escape(c.reason)}</p><small>${escape(c.actor)} · ${escape(c.timestamp)}</small></article>`).join('') || '<p class="empty">Sin cierres declarados.</p>'}</div></section></div>`;
}
function reportsView() {
  return `<section class="surface report-card"><span class="eyebrow">CORTE DEL MES</span><h2>Tu reporte, cuando lo necesites.</h2><p>Excel con inscritos, asistencias, faltas, historial de horarios, estadísticas y gráficos.</p><form id="export-form"><label>Alcance<select name="shift"><option value="TODO">Todo el día</option><option value="MANANA">Turno mañana</option><option value="TARDE">Turno tarde</option></select></label><div class="report-actions"><button class="button primary" name="export-action" value="download">Descargar Excel ↓</button><button class="button secondary" name="export-action" value="archive">Guardar copia en Drive</button></div></form><p class="micro">Una descarga no reinicia el mes. Solo se guarda en Drive cuando eliges esa acción. El cierre mensual archiva automáticamente el reporte definitivo.</p><a href="${escape(panelData.sheetUrl)}" target="_blank" rel="noopener" class="text-link">Abrir Sheet operativo ↗</a></section>`;
}
function settingsView() {
  const c = panelData.config;
  return `<div class="dashboard-columns"><section class="surface"><h2>Reglas del gimnasio</h2><form id="config-form"><fieldset><legend>Días de apertura</legend><div class="day-checkboxes">${days.map((name, d) => `<label><input type="checkbox" name="day" value="${d}" ${c.days.includes(d) ? 'checked' : ''}>${name}</label>`).join('')}</div></fieldset>${field('Formato del código leído', 'codePattern', `value="${escape(c.codePattern)}" maxlength="160"`)}<p class="micro">Formato provisional. Confirmar con un carnet real antes de abrir las inscripciones. Ejemplo numérico: ^[0-9]{10}$.</p><label class="checkbox-label"><input type="checkbox" name="enabled" ${c.enabled ? 'checked' : ''}>Abrir inscripciones del mes</label><p class="micro">Aforo fijo: 20 · Bloqueo: 3 faltas · Zona: America/Lima.</p><button class="button primary full">Guardar configuración</button></form></section><section class="surface"><h2>Cambiar contraseña</h2><p class="muted">Cambias únicamente la contraseña de ${escape(user)}.</p><form id="password-form">${field('Contraseña actual', 'currentPassword', 'type="password" autocomplete="current-password" maxlength="128"')}${field('Nueva contraseña', 'newPassword', 'type="password" autocomplete="new-password" minlength="6" maxlength="128"')}${field('Confirmar nueva contraseña', 'confirmPassword', 'type="password" autocomplete="new-password" minlength="6" maxlength="128"')}<button class="button primary full">Guardar cambio</button></form></section></div>`;
}
function panel() {
  if (!user) return login();
  if (!panelData) { shell(`${pageTitle('PANEL DEL GIMNASIO', 'Cargando tu mes…', 'Consultando los datos operativos.')}${spinner}<div id="feedback"></div>`, 'panel'); return; }
  const views = { resumen: panelSummary, inscritos: studentsView, asistencia: attendanceView, cierres: closuresView, reportes: reportsView, qr: qrView, configuracion: settingsView };
  views.resumen = () => panelSummary() + trendsView();
  if (!views[tab]) tab = 'resumen';
  shell(`<div class="staff-layout"><aside class="staff-sidebar"><div class="sidebar-brand"><img src="/logo.webp" alt=""><div>GIMNASIO UNT<small>Panel del personal</small></div></div><nav class="panel-tabs" aria-label="Secciones del panel">${Object.entries({ resumen: 'Resumen', inscritos: 'Inscritos', asistencia: 'Asistencia y faltas', cierres: 'Cierres', reportes: 'Reportes', qr: 'Códigos QR', configuracion: 'Configuración' }).map(([key, label]) => `<button class="${tab === key ? 'selected' : ''}" data-action="tab" data-tab="${key}">${icon(key)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><span>${escape(user)}</span><button class="sidebar-logout" data-action="logout">${icon('logout')} Cerrar sesión</button></div></aside><div class="staff-content"><div class="panel-heading"><div><span class="eyebrow">${escape(periodLabel(panelData.dashboard.period))}</span><h1>${tab === 'qr' ? 'Accesos para estudiantes' : 'Tu gimnasio, al día.'}</h1><p>${shiftLabel(shift)}</p><small class="updated-label">Última consulta: ${panelUpdatedAt ? new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' }).format(new Date(panelUpdatedAt)) : '—'}. Pulsa Actualizar para nuevos registros.</small></div><div class="panel-controls"><label class="sr-only" for="shift-filter">Turno del panel</label><select id="shift-filter"><option value="TODO" ${shift === 'TODO' ? 'selected' : ''}>Todo el día</option><option value="MANANA" ${shift === 'MANANA' ? 'selected' : ''}>Turno mañana</option><option value="TARDE" ${shift === 'TARDE' ? 'selected' : ''}>Turno tarde</option></select><button class="button quiet" data-action="refresh">Actualizar ↻</button></div></div><div id="feedback" aria-live="polite"></div>${views[tab]()}</div></div>`, 'panel');
  if (tab === 'qr') drawQrs().catch(e => feedback(e.message));
}
function qrView() {
  return `<p class="qr-intro">Muestra el QR que necesita el estudiante. Cada uno abre una página dedicada a una sola acción.</p><div class="qr-grid">${[['registro', 'Inscripción mensual', 'Completar datos y reservar horarios.'], ['asistencia', 'Marcar asistencia', 'Registrar la llegada a una sesión.']].map(([route, label, description], index) => `<section class="surface qr-card"><span class="eyebrow">ACCESO ${String(index + 1).padStart(2, '0')}</span><h2>${label}</h2><p>${description}</p><div class="qr-frame"><canvas id="qr-${route}" aria-label="QR de ${label}"></canvas></div><a class="qr-destination" href="/${route}" target="_blank" rel="noopener">${escape(location.origin)}/${route}</a><button class="button secondary full" disabled data-action="download-qr" data-route="${route}">Descargar QR ↓</button></section>`).join('')}</div><p class="micro">Estos son los dos accesos fijos del gimnasio.${location.hostname === 'localhost' ? ' Los QR definitivos usarán el dominio HTTPS de la web una vez publicada.' : ''}</p>`;
}
async function drawQrs() {
  const { default: QRCode } = await import('qrcode');
  const base = (status?.publicUrl || location.origin).replace(/\/$/, '');
  for (const route of ['registro', 'asistencia']) {
    const canvas = document.querySelector(`#qr-${route}`);
    if (canvas) {
      await QRCode.toCanvas(canvas, `${base}/${route}`, { width: 280, margin: 2, color: { dark: '#041d37', light: '#ffffff' } });
      const link = canvas.closest('.qr-card').querySelector('.qr-destination');
      link.textContent = `${base}/${route}`; link.href = `${base}/${route}`;
      canvas.dataset.ready = 'true';
      canvas.closest('.qr-card').querySelector('[data-action="download-qr"]').disabled = false;
    }
  }
}
function render() {
  stopCamera();
  const route = currentRoute();
  if (route === '/') panel();
  else if (route === '/registro') registration();
  else if (route === '/asistencia') attendance();
  else if (route === '/panel' || route === '/qr') { if (route === '/qr') tab = 'qr'; history.replaceState({}, '', '/'); panel(); }
  else shell(`${pageTitle('404', 'Esta página no existe.', 'Vuelve al inicio para continuar.')}${backLink()}`);
}
async function scan() {
  const generation = ++scannerGeneration;
  const video = document.querySelector('#camera');
  if (!video) return;
  document.querySelector('#camera-area').hidden = false;
  document.querySelector('[data-action="stop-scan"]').hidden = false;
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    if (generation !== scannerGeneration) return;
    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, video, (result, error, control) => {
      if (generation !== scannerGeneration) { control.stop(); return; }
      if (result) {
        scannedCode = result.getText().trim();
        document.querySelector('#scan-result').textContent = `Código leído: ${scannedCode}`;
        document.querySelector('#scan-result').classList.add('read');
        control.stop(); scanControls = null;
        document.querySelector('#camera-area').hidden = true;
        document.querySelector('[data-action="stop-scan"]').hidden = true;
      }
    });
    if (generation !== scannerGeneration) controls.stop(); else scanControls = controls;
  } catch (error) { if (generation !== scannerGeneration) return; stopCamera(); document.querySelector('#camera-area').hidden = true; document.querySelector('[data-action="stop-scan"]').hidden = true; feedback(error.name === 'NotAllowedError' ? 'Permite el acceso a la cámara para escanear el carnet.' : 'No se pudo abrir la cámara. Usa un celular con HTTPS y revisa los permisos del navegador.'); }
}
function slotsFrom(form, prefix = '') {
  return [...form.querySelectorAll(`select[name^="${prefix}day-"]`)].filter(el => el.value).map(el => ({ day: Number(el.name.split('-').at(-1)), start: el.value }));
}
function showDialog(content) {
  const dialog = document.createElement('dialog'); dialog.innerHTML = content; root.append(dialog); dialog.showModal();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
}
function confirmation(draft) {
  showDialog(`<div class="dialog-header"><span class="eyebrow">REVISA ANTES DE CONFIRMAR</span><button class="icon-button" type="button" data-action="dialog-close" aria-label="Cerrar">×</button></div><h2>Tu inscripción del mes</h2><dl><dt>Alumno</dt><dd>${escape(draft.names)} ${escape(draft.surnames)}</dd><dt>Código</dt><dd>${escape(draft.code)}</dd><dt>Estudios</dt><dd>${escape(draft.faculty)} · ${escape(draft.career)} · Ciclo ${draft.cycle}</dd><dt>Horario</dt><dd>${draft.slots.map(s => `${days[s.day]} · ${s.start}–${String(Number(s.start.slice(0, 2)) + 1).padStart(2, '0')}:00`).join('<br>')}</dd></dl><p class="micro">Después de confirmar, los cambios de horario los gestiona el personal.</p><div class="dialog-actions"><button class="button secondary" data-action="dialog-close">Corregir</button><button class="button primary" data-action="confirm-registration">Confirmar inscripción</button></div>`);
}
function acceptPanel(data) {
  panelData = data; panelUpdatedAt = data.updatedAt || new Date().toISOString();
  if (data.dashboards?.[shift]) panelData.dashboard = data.dashboards[shift];
}
async function refreshPanel() {
  const sequence = ++panelRequest;
  const data = await api('panel?shift=TODO');
  if (sequence !== panelRequest || !user) return;
  acceptPanel(data); panel();
}
async function mutatePanel(action, input, message) {
  const result = await api(action, { ...input, includePanel: true, panelShift: shift });
  document.querySelector('dialog[open]')?.close();
  if (result.panel) { acceptPanel(result.panel); panel(); }
  else {
    try { await refreshPanel(); }
    catch { feedback(`${message || result.message || 'Cambio guardado'}. No se pudo actualizar la vista; pulsa Actualizar.`, 'success'); return; }
  }
  feedback(message || result.message || 'Cambio guardado.', 'success');
}
async function loadRegistration() {
  try {
    publicData = await api('public');
    if (currentRoute() === '/registro' && !pending) {
      const form = document.querySelector('#registration-form');
      if (!form) registration();
      else {
        const chosen = slotsFrom(form), grid = form.querySelector('.schedule-grid');
        grid.outerHTML = slotPicker();
        for (const slot of chosen) { const select = form.elements[`day-${slot.day}`]; if (select && [...select.options].some(o => o.value === slot.start && !o.disabled)) select.value = slot.start; }
        form.querySelector('button:not([type])').disabled = !publicData.enabled;
        document.querySelector('.period-chip').textContent = periodLabel(publicData.period);
      }
      if (!publicData.enabled) feedback('Las inscripciones del mes están cerradas.', 'info');
    }
  }
  catch (error) { if (currentRoute() === '/registro') feedback(error.message); }
}
async function execute(button, fn) {
  if (pending) return;
  pending = true; const original = button?.innerHTML;
  if (button) { button.disabled = true; button.innerHTML = `${spinner} Procesando…`; }
  try { await fn(); } catch (error) { if (error.status === 401 && user) { user = null; panelData = null; panel(); } feedback(error.message); }
  finally { pending = false; if (button?.isConnected) { button.disabled = false; button.innerHTML = original; } }
}
root.addEventListener('click', async event => {
  const nav = event.target.closest('a[data-nav]');
  if (nav && !event.ctrlKey && !event.metaKey) { event.preventDefault(); navigate(new URL(nav.href).pathname); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'theme') { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('gym-theme', dark ? 'dark' : 'light'); button.textContent = dark ? '☀' : '☾'; }
  else if (action === 'open-login') navigate('/#ingresar');
  else if (action === 'scan') { stopCamera(); await scan(); }
  else if (action === 'stop-scan') { stopCamera(); document.querySelector('#camera-area').hidden = true; button.hidden = true; }
  else if (action === 'dialog-close') button.closest('dialog').close();
  else if (action === 'tab') { tab = button.dataset.tab; panel(); }
  else if (action === 'history-page') { historyPages[button.dataset.kind] = Number(button.dataset.page); panel(); }
  else if (action === 'refresh') await execute(button, refreshPanel);
  else if (action === 'logout') await execute(button, async () => { await api('logout', {}); ++panelRequest; user = null; panelData = null; tab = 'resumen'; navigate('/'); });
  else if (action === 'download-qr') {
    const canvas = document.querySelector(`#qr-${button.dataset.route}`);
    if (canvas?.dataset.ready !== 'true' || !user) return;
    const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = `GIMNASIO_UNT_QR_${button.dataset.route.toUpperCase()}.png`; link.click();
  }
  else if (action === 'attend-scan') await execute(button, async () => { if (!scannedCode) throw new Error('Primero escanea tu carnet.'); const result = await api('attend', { code: scannedCode, method: 'CARNET' }); feedback(`${result.fullName}: ${result.message}`, 'success'); });
  else if (action === 'confirm-registration') await execute(button, async () => {
    const result = await api('register', registrationDraft);
    button.closest('dialog').close(); registrationDraft = null; scannedCode = '';
    registration(); feedback(`${result.fullName}: ${result.message}`, 'success');
    void loadRegistration();
  });
  else if (action === 'close-today') {
    const form = document.querySelector('#closure-form'); form.elements.date.value = panelData.dashboard.today; form.elements.shift.value = button.dataset.shift; form.elements.closed.value = 'true'; form.elements.reason.value = 'Hoy no abrió este turno'; form.requestSubmit();
  } else if (action === 'schedule') {
    const student = panelData.students.find(s => s.code === button.dataset.code);
    const tomorrow = new Date(`${panelData.dashboard.today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (tomorrow.toISOString().slice(0, 10) > monthEndDate(panelData.dashboard.period)) { feedback('El mes termina hoy. Los horarios nuevos se eligen al inscribirse en el siguiente mes.', 'info'); return; }
    showDialog(`<div class="dialog-header"><span class="eyebrow">CAMBIO DE HORARIO</span><button class="icon-button" data-action="dialog-close" aria-label="Cerrar">×</button></div><h2>${escape(student.fullName)}</h2><form id="schedule-form"><input type="hidden" name="code" value="${escape(student.code)}">${field('Aplicar desde', 'effectiveDate', `type="date" min="${tomorrow.toISOString().slice(0, 10)}" value="${tomorrow.toISOString().slice(0, 10)}"`)}${slotPicker({ days: panelData.config.days, slots: [] }, 'edit-')}<p class="micro">Selecciona entre 1 y 3 días. Se conserva la asistencia y las faltas anteriores. El cambio debe empezar desde mañana.</p><button class="button primary full">Guardar horario</button></form>`);
  }
});
root.addEventListener('input', event => {
  if (event.target.id === 'student-search') { const query = event.target.value.toLowerCase(); let matches = 0; document.querySelectorAll('#student-rows tr[data-search]').forEach(row => { row.hidden = !row.dataset.search.includes(query); if (!row.hidden) matches++; }); const empty = document.querySelector('#search-empty'); if (empty) empty.hidden = !query || matches > 0; }
});
root.addEventListener('change', async event => {
  if (event.target.id === 'shift-filter') { shift = event.target.value; if (panelData?.dashboards?.[shift]) { panelData.dashboard = panelData.dashboards[shift]; panel(); } else try { await refreshPanel(); } catch (error) { feedback(error.message); } }
  if (event.target.closest('#registration-form') && event.target.name?.startsWith('day-')) {
    const count = slotsFrom(event.target.form).length;
    if (count > 3) { event.target.value = ''; feedback('Puedes elegir como máximo tres días.'); }
    document.querySelector('#selection-summary').textContent = `${Math.min(count, 3)} de 3 días seleccionados.`;
  }
});
root.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, input = Object.fromEntries(new FormData(form));
  const button = event.submitter || form.querySelector('button[type="submit"], button:not([type])');
  await execute(button, async () => {
    if (form.id === 'registration-form') {
      if (!scannedCode) throw new Error('Escanea el código de barras del carnet antes de continuar.');
      const slots = slotsFrom(form); if (slots.length < 1 || slots.length > 3) throw new Error('Selecciona entre uno y tres días.');
      registrationDraft = { ...input, period: publicData.period, code: scannedCode, method: 'CARNET', cycle: Number(input.cycle), slots };
      confirmation(registrationDraft);
    } else if (form.id === 'manual-attendance') { const result = await api('attend', { ...input, method: 'MANUAL' }); feedback(`${result.fullName}: ${result.message}`, 'success'); }
    else if (form.id === 'login-form') { const result = await api('login', { user: input.user, password: input.password }); user = result.user; shift = input.shift; await refreshPanel(); }
    else if (form.id === 'closure-form') {
      if (!window.confirm(`${input.closed === 'true' ? 'Cerrar' : 'Reabrir'} ${shiftLabel(input.shift)} el ${input.date}. Se recalcularán las faltas. ¿Confirmar?`)) return;
      tab = 'cierres'; await mutatePanel('closure', { ...input, closed: input.closed === 'true' }, 'Estado actualizado y faltas recalculadas.');
    } else if (form.id === 'schedule-form') { const slots = slotsFrom(form, 'edit-'); if (!slots.length || slots.length > 3) throw new Error('Selecciona entre 1 y 3 días.'); await mutatePanel('schedule', { code: input.code, effectiveDate: input.effectiveDate, slots }); }
    else if (form.id === 'config-form') { await mutatePanel('configure', { days: new FormData(form).getAll('day').map(Number), codePattern: input.codePattern, enabled: Boolean(input.enabled) }, 'Configuración guardada.'); publicData = null; }
    else if (form.id === 'password-form') { const result = await api('password', input); form.reset(); feedback(result.message, 'success'); }
    else if (form.id === 'export-form') {
      const archive = button.value === 'archive'; const result = await api('export', { shift: input.shift, archive });
      if (result.base64) {
        const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      feedback(archive ? 'Copia guardada en Drive.' : 'Excel preparado para descargar.', 'success');
      if (result.driveUrl && /^https:\/\/(drive|docs)\.google\.com\//.test(result.driveUrl)) { const link = document.createElement('a'); link.href = result.driveUrl; link.textContent = ' Abrir reporte en Drive ↗'; link.target = '_blank'; link.rel = 'noopener'; document.querySelector('#feedback').append(link); }
    }
  });
});
window.addEventListener('popstate', () => { scannedCode = ''; registrationDraft = null; render(); });
window.addEventListener('pagehide', stopCamera);
try { document.documentElement.dataset.theme = localStorage.getItem('gym-theme') === 'dark' ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
render();
const studentRoute = ['/registro', '/asistencia'].includes(currentRoute());
await Promise.all([
  api('status').then(data => { status = data; if (currentRoute() === '/asistencia') { root.querySelectorAll('[data-action="attend-scan"], #manual-attendance button').forEach(button => { button.disabled = !status.connected; }); } }).catch(error => { status = { connected: false }; feedback(error.message); }),
  studentRoute ? (currentRoute() === '/registro' ? loadRegistration() : Promise.resolve()) :
    api('panel?shift=TODO').then(data => { if (pending) return; user = data.user; acceptPanel(data); render(); }).catch(error => { if (error.status !== 401 && error.status !== 503) feedback(error.message); })
]);
