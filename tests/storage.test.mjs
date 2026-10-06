import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleHarness } from './helpers/google-harness.mjs';

test('consulta pública lee exclusivamente horarios en una petición por lote', () => {
  const h = googleHarness(); let ranges;
  const original = h.context.Sheets.Spreadsheets.Values.batchGet;
  h.context.Sheets.Spreadsheets.Values.batchGet = (id, options) => { ranges = options.ranges; return original(id, options); };
  const config = h.invoke('public.config');
  assert.equal(ranges.length, 1); assert.equal(ranges[0], "'HORARIOS'!A1:H");
  assert.equal(config.slots.length, 45); assert.equal(config.revision, '2026-10-06-flow-2');
});

test('gráficos incluyen 19–20 y ambos turnos, reparación no borra gráficos ajenos', () => {
  const h = googleHarness(), sheet = h.operational().getSheetByName('DASHBOARD');
  assert.deepEqual(sheet.charts.map(c => c.ranges[0]), [[9, 1, 10, 3], [20, 1, 8, 2], [29, 1, 3, 2]]);
  sheet.insertChart(sheet.newChart().setOption('title', 'Gráfico personal').build());
  h.context.actualizarGraficosDesdeEditor(); h.context.actualizarGraficosDesdeEditor();
  assert.equal(sheet.charts.length, 4); assert.ok(sheet.charts.some(c => c.options.title === 'Gráfico personal'));
});

test('guardado sin cambios no envía metadata ni batchUpdate a Google', () => {
  const h = googleHarness(), state = h.context.gymRead_(h.operational());
  const before = { ...h.stats };
  h.context.gymLock_(() => h.context.gymSave_(state, h.operational()));
  assert.equal(h.stats.metadataReads, before.metadataReads); assert.equal(h.stats.batchWrites, before.batchWrites);
});

test('segunda inscripción no vuelve a enviar filas del primer alumno', () => {
  const h = googleHarness(); h.invoke('configure', { actor: 'Administrador', version: 1, days: [1, 2, 3, 4, 5], codePattern: '^[0-9]{8}$', enabled: true });
  const form = code => ({ code, names: 'Ficticio', surnames: 'Prueba', faculty: 'QA', career: 'QA', cycle: 1, method: 'CARNET', slots: [{ day: 1, start: '08:00' }] });
  h.invoke('register', form('00000001'));
  const original = h.context.Sheets.Spreadsheets.batchUpdate; let requests;
  h.context.Sheets.Spreadsheets.batchUpdate = (body, id) => { requests = body.requests; return original(body, id); };
  h.invoke('register', form('00000002'));
  const id = h.operational().getSheetByName('REGISTRADOS').getSheetId();
  const change = requests.find(r => r.updateCells?.range.sheetId === id).updateCells;
  assert.equal(change.range.startRowIndex, 2); assert.equal(change.rows.length, 1);
  assert.equal(h.context.gymRead_(h.operational()).students.length, 2);
});

test('los límites persistentes vencen y admiten actividad legítima posterior', () => {
  const h = googleHarness(), data = { user: 'ProfesorGYM', _rate: 'a'.repeat(64) };
  for (let i = 0; i < 12; i++) assert.equal(h.request('account.get', data).ok, true);
  assert.equal(h.request('account.get', data).status, 429);
  h.setTime('2026-10-01T07:11:00-05:00');
  assert.equal(h.request('account.get', data).ok, true);
});

test('versión revocada rechaza toda escritura privada antes de leer o guardar Sheets', () => {
  const h = googleHarness();
  h.props.set('ACCOUNT_Administrador', JSON.stringify({ hash: 'QA-no-usado', version: 2 }));
  for (const action of ['closure', 'schedule', 'configure', 'export']) {
    const before = { ...h.stats };
    assert.equal(h.request(action, { actor: 'Administrador', version: 1 }).status, 401);
    assert.equal(h.stats.batchReads, before.batchReads); assert.equal(h.stats.batchWrites, before.batchWrites);
  }
});

test('borrar filas obsoletas no conserva restos de un cálculo anterior', () => {
  const h = googleHarness(), sheet = h.operational().getSheetByName('FALTAS'), headers = h.context.GYM_TABLES.absences.headers;
  h.context.gymLock_(() => h.context.gymAtomicWrite_(h.operational(), [{ name: 'FALTAS', headers, rows: [['2026-10-01', '00000001', 'QA', '08:00', 'MANANA', 'CONTABILIZADA', '{}']] }]));
  const previous = JSON.parse(JSON.stringify(sheet.values));
  h.context.gymLock_(() => h.context.gymAtomicWrite_(h.operational(), [{ name: 'FALTAS', headers, rows: [], previousRows: previous }]));
  assert.equal(sheet.values.length, 1);
});
