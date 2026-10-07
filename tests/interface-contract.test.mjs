import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const theme = await readFile(new URL('../src/template.css', import.meta.url), 'utf8');
const access = await readFile(new URL('../src/access.css', import.meta.url), 'utf8');
const preview = await readFile(new URL('../scripts/preview-interface.mjs', import.meta.url), 'utf8');

test('registro admite cambio de tema sin fecha decorativa ni perder el formulario', () => {
  assert.ok(!main.includes('period-chip'));
  assert.ok(main.includes("currentRoute() === '/registro' ? 'registration'"));
  assert.ok(main.includes("'registration' : 'attendance'"));
  assert.ok(!main.includes("student && currentRoute() !== '/registro'"));
  assert.ok(main.includes("syncScheduleLimit(scheduleForm)"));
  assert.ok(main.includes("closest('#registration-form, #schedule-form')"));
  assert.ok(main.includes('data-full="${Boolean(full)}"'));
});

test('configuración no muestra ni envía un patrón editable del carnet', () => {
  assert.ok(!main.includes('Formato del código leído'));
  assert.ok(!main.includes('Formato provisional'));
  assert.ok(!main.includes('codePattern: input.codePattern'));
  assert.ok(main.includes('dailyCapacity(d)'));
  assert.ok(main.includes('Cupos de hoy por horario'));
});

test('resumen omite las dos notas retiradas y conserva tablas y cupos', () => {
  const summary = main.split('function panelSummary() {')[1].split('function filteredStudents()')[0];
  assert.ok(!summary.includes('Las sesiones pendientes'));
  assert.ok(!summary.includes('Más solicitado:'));
  assert.ok(!summary.includes('Menos solicitado:'));
  assert.ok(summary.includes('Máximo 20 alumnos por horario'));
  assert.ok(summary.includes('b.absencesToday'));
  assert.ok(summary.includes('b.occupied}/${b.capacity}'));
});

test('bienvenida usa el texto solicitado y la cuenta se muestra como Profesor', () => {
  assert.ok(main.includes('<h1>Supervisión activa.<br><em>Control de aforo.</em></h1>'));
  assert.ok(main.includes('Monitorea el ingreso de los estudiantes.<br>Genera registros y estadísticas de asistencia.'));
  assert.ok(main.includes('<option value="ProfesorGYM">Profesor</option><option>Administrador</option>'));
  assert.ok(!main.includes('escape(user)'));
  assert.ok(main.includes('escape(accountLabel(user))'));
  assert.ok(!main.includes('Un espacio.'));
});

test('rediseño conserva siete destinos directos y marca la sección activa', () => {
  const labels = main.match(/const panelSections = \{([^}]+)\}/)[1];
  assert.equal((labels.match(/: '/g) || []).length, 7);
  for (const name of ['Resumen', 'Inscritos', 'Asistencia y faltas', 'Cierres', 'Reportes', 'Códigos QR', 'Configuración']) assert.ok(labels.includes(name));
  assert.ok(main.includes('aria-current="page"'));
});
test('filas móviles conservan estudios, horarios, faltas, estado y cambio de horario', () => {
  for (const name of ['student-identity', 'student-studies', 'student-schedule', 'student-absences', 'student-status', 'student-action']) assert.ok(main.includes(name));
  assert.ok(main.includes('data-action="schedule"'));
  assert.ok(theme.includes('content: attr(data-label)'));
  assert.ok(main.includes('class="table-wrap" tabindex="0"'));
});
test('registro, asistencia, revisión y alternativas no cambian de flujo', () => {
  for (const id of ['registration-form', 'manual-attendance', 'login-form', 'closure-form', 'password-form', 'export-form']) assert.ok(main.includes(id));
  for (const action of ['confirm-registration', 'attend-scan', 'download-qr', 'open-login']) assert.ok(main.includes(action));
  assert.ok(access.includes(':root[data-layout=public]'));
  assert.ok(access.includes('min-height: 52px'));
  assert.ok(!main.includes('welcome-dots'));
});
test('vista de interfaz no carga .env, persiste snapshots ni importa la cámara de producción', () => {
  assert.ok(preview.includes('flowSession()'));
  assert.ok(preview.includes('../tests/qa-scanner.mjs'));
  assert.ok(!preview.includes('dotenv'));
  assert.ok(!preview.includes('writeFile'));
  assert.ok(!preview.includes('process.env'));
});

test('fallo de carga tras login ofrece reintento y no reutiliza consultas de otra sesión', () => {
  assert.ok(main.includes('data-action="refresh">Reintentar</button>'));
  assert.ok(main.includes('++panelRequest; inflight.clear(); panelData = null;'));
  assert.ok(main.includes('if (result.panel) { acceptPanel(result.panel); panel(); }'));
  assert.ok(main.includes('else await refreshPanel();'));
  assert.ok(main.includes('panelLoading ? `<p role="status">'));
  assert.ok(!main.includes("'Panel del personal', 'Consulta los datos del mes para continuar.'"));
  assert.ok(main.includes('inflight.get(path) === request'));
  assert.ok(main.includes('initialPanelRequest !== panelRequest'));
});
