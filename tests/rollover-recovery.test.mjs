import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qaOpened, qaForm } from './helpers/concurrency-scenario.mjs';

const accountSnapshot = h => ['ACCOUNT_ProfesorGYM', 'ACCOUNT_Administrador'].map(k => h.props.get(k));
function fixture() { const h = qaOpened(); h.invoke('register', qaForm('0000000100')); return h; }
function assertFinished(h, accounts, expectedExports = 1) {
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-11'); assert.ok(h.props.get('ARCHIVED_2026-10'));
  const state = h.context.gymRead_(h.operational());
  for (const key of ['students', 'attendance', 'reservations', 'absences', 'closures']) assert.equal(state[key].length, 0);
  assert.deepEqual(accountSnapshot(h), accounts); assert.equal(state.config.enabled, true);
  assert.equal(h.stats.exports, expectedExports);
  assert.equal([...h.files.values()].filter(f => f.name === 'GIMNASIO_UNT_OCTUBRE_2026.xlsx').length, 1);
  for (const f of h.files.values()) if (f.name.startsWith('TEMP_REPORTE_')) assert.equal(f.trashed, true);
  h.context.procesarCambioMensual(); assert.equal(h.stats.exports, expectedExports);
}
test('cierre ocurre en medianoche de Lima, no cinco horas antes; conserva cuentas y operativo antiguo', () => {
  const h = fixture(), accounts = accountSnapshot(h), oldId = h.props.get('MONTH_2026-10');
  h.setTime('2026-11-01T04:59:59Z'); assert.equal(h.context.procesarCambioMensual(), undefined);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.stats.exports, 0);
  h.setTime('2026-11-01T05:00:00Z'); h.context.procesarCambioMensual(); assertFinished(h, accounts);
  assert.equal(h.sheets.get(oldId).getSheetByName('REGISTRADOS').values.length, 2);
});
test('Google rechaza exportación: conserva octubre, limpia temporal y permite recuperación', () => {
  const h = fixture(), accounts = accountSnapshot(h), fetchOriginal = h.context.UrlFetchApp.fetch;
  h.setTime('2026-11-01T07:00:00-05:00');
  h.context.UrlFetchApp.fetch = () => ({ getResponseCode: () => 503 });
  assert.throws(() => h.context.procesarCambioMensual(), /Google no pudo exportar/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.props.get('ARCHIVED_2026-10'), undefined);
  assert.equal(h.props.get('MONTH_2026-11'), undefined); assert.deepEqual(accountSnapshot(h), accounts);
  assert.equal(h.context.gymRead_(h.operational()).students.length, 1);
  h.context.UrlFetchApp.fetch = fetchOriginal; h.context.procesarCambioMensual(); assertFinished(h, accounts);
});
test('Drive falla antes de crear archivo: no avanza el mes; reintento archiva una sola copia', () => {
  const h = fixture(), accounts = accountSnapshot(h), original = h.context.DriveApp.getFolderById;
  h.setTime('2026-11-01T07:00:00-05:00');
  h.context.DriveApp.getFolderById = id => { if (id === h.context.GYM_FOLDERS.reports) throw new Error('QA Drive sin permiso'); return original(id); };
  assert.throws(() => h.context.procesarCambioMensual(), /QA Drive/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.props.get('ARCHIVED_2026-10'), undefined);
  assert.deepEqual(accountSnapshot(h), accounts);
  h.context.DriveApp.getFolderById = original;
  const exportsBefore = h.stats.exports;
  h.context.procesarCambioMensual();
  // Primer intento obtuvo el binario, pero Drive falló antes del archivo final.
  assert.equal(h.stats.exports, exportsBefore + 1);
  assertFinished(h, accounts, exportsBefore + 1);
});
test('falla escritura del mes nuevo: conserva archivo final y repara el mismo libro sin duplicarlo', () => {
  const h = fixture(), accounts = accountSnapshot(h), original = h.context.Sheets.Spreadsheets.batchUpdate;
  const oldId = h.props.get('MONTH_2026-10'); h.setTime('2026-11-01T07:00:00-05:00');
  h.context.Sheets.Spreadsheets.batchUpdate = (body, id) => { if (id !== oldId) throw new Error('QA nuevo libro no disponible'); return original(body, id); };
  assert.throws(() => h.context.procesarCambioMensual(), /No se pudo confirmar/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.ok(h.props.get('ARCHIVED_2026-10'));
  const newId = h.props.get('MONTH_2026-11'); assert.ok(newId); assert.equal(h.props.get('MONTH_READY_2026-11'), undefined);
  assert.deepEqual(accountSnapshot(h), accounts);
  h.context.Sheets.Spreadsheets.batchUpdate = original; h.context.procesarCambioMensual(); assertFinished(h, accounts);
  assert.equal(h.props.get('MONTH_2026-11'), newId);
});
test('recupera meses omitidos de uno en uno sin saltar archivos ni resetear cuentas', () => {
  const h = fixture(), accounts = accountSnapshot(h); h.setTime('2027-01-01T07:00:00-05:00');
  const expected = [['2026-10','2026-11'],['2026-11','2026-12'],['2026-12','2027-01']];
  for (const [closed, opened] of expected) {
    const result = h.context.procesarCambioMensual(); assert.equal(result.closed, closed); assert.equal(result.opened, opened);
    assert.ok(h.props.get('ARCHIVED_' + closed)); assert.deepEqual(accountSnapshot(h), accounts);
  }
  assert.equal(h.stats.exports, 3); h.context.procesarCambioMensual(); assert.equal(h.stats.exports, 3);
});
test('si falla el marcador después de crear Excel, recupera su ID sin duplicar archivo ni exportar otra vez', () => {
  const h = fixture(), accounts = accountSnapshot(h), properties = h.context.PropertiesService.getScriptProperties();
  const original = properties.setProperty; let failOnce = true;
  properties.setProperty = (key, value) => {
    if (key === 'ARCHIVED_2026-10' && failOnce) { failOnce = false; throw new Error('QA fallo de Properties tras crear archivo'); }
    return original(key, value);
  };
  h.setTime('2026-11-01T07:00:00-05:00');
  assert.throws(() => h.context.procesarCambioMensual(), /QA fallo de Properties/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.props.get('ARCHIVED_2026-10'), undefined);
  assert.equal([...h.files.values()].filter(f => f.name === 'GIMNASIO_UNT_OCTUBRE_2026.xlsx').length, 1);
  h.context.procesarCambioMensual();
  assertFinished(h, accounts);
  assert.equal(h.props.get('ARCHIVED_2026-10'), h.props.get('ARCHIVE_PENDING_ID_2026-10'));
});
test('Drive crea archivo y se pierde respuesta: se recupera por ID, incluso tras fallar su comprobación', () => {
  const h = fixture(), accounts = accountSnapshot(h), get = h.context.Drive.Files.get, create = h.context.Drive.Files.create;
  let uploaded = false;
  h.context.Drive.Files.create = (...args) => { create(...args); uploaded = true; throw new Error('QA respuesta upload perdida'); };
  h.context.Drive.Files.get = id => { if (uploaded) throw new Error('QA comprobación temporalmente caída'); return get(id); };
  h.setTime('2026-11-01T07:00:00-05:00');
  assert.throws(() => h.context.procesarCambioMensual(), /QA respuesta/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.ok(h.props.get('ARCHIVE_PENDING_ID_2026-10'));
  h.context.Drive.Files.get = get; h.context.Drive.Files.create = create;
  h.context.procesarCambioMensual(); assertFinished(h, accounts);
});
test('409 de ID existente con comprobación caída mantiene octubre y nunca crea otra copia', () => {
  const h = fixture(), accounts = accountSnapshot(h), properties = h.context.PropertiesService.getScriptProperties();
  const set = properties.setProperty, get = h.context.Drive.Files.get; let failOnce = true;
  properties.setProperty = (key, value) => { if (key === 'ARCHIVED_2026-10' && failOnce) { failOnce = false; throw new Error('QA marcador perdido'); } return set(key, value); };
  h.setTime('2026-11-01T07:00:00-05:00'); assert.throws(() => h.context.procesarCambioMensual(), /QA marcador/);
  const id = h.props.get('ARCHIVE_PENDING_ID_2026-10');
  h.context.Drive.Files.get = () => { throw new Error('QA get inaccesible'); };
  assert.throws(() => h.context.procesarCambioMensual(), /QA Drive 409/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.props.get('ARCHIVE_PENDING_ID_2026-10'), id);
  assert.equal([...h.files.values()].filter(f => f.name === 'GIMNASIO_UNT_OCTUBRE_2026.xlsx').length, 1);
  h.context.Drive.Files.get = get; h.context.procesarCambioMensual(); assertFinished(h, accounts, 2);
});
test('si falla guardar ID reservado, no se crea el archivo final ni se avanza el mes', () => {
  const h = fixture(), accounts = accountSnapshot(h), properties = h.context.PropertiesService.getScriptProperties();
  const set = properties.setProperty; let failOnce = true;
  properties.setProperty = (key, value) => { if (key === 'ARCHIVE_PENDING_ID_2026-10' && failOnce) { failOnce = false; throw new Error('QA no guardó ID'); } return set(key, value); };
  h.setTime('2026-11-01T07:00:00-05:00'); assert.throws(() => h.context.procesarCambioMensual(), /QA no guardó ID/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.props.get('ARCHIVE_PENDING_ID_2026-10'), undefined);
  assert.equal([...h.files.values()].filter(f => f.name === 'GIMNASIO_UNT_OCTUBRE_2026.xlsx').length, 0);
  h.context.procesarCambioMensual(); assertFinished(h, accounts, 2);
});
test('archivo reservado alterado o en papelera no cuenta como archivo mensual válido', () => {
  const h = fixture(), properties = h.context.PropertiesService.getScriptProperties(), set = properties.setProperty;
  let failOnce = true;
  properties.setProperty = (key, value) => { if (key === 'ARCHIVED_2026-10' && failOnce) { failOnce = false; throw new Error('QA marcador perdido'); } return set(key, value); };
  h.setTime('2026-11-01T07:00:00-05:00'); assert.throws(() => h.context.procesarCambioMensual(), /QA marcador/);
  const file = h.files.get(h.props.get('ARCHIVE_PENDING_ID_2026-10'));
  const valid = JSON.parse(JSON.stringify(file));
  for (const invalid of [{ trashed: true }, { size: undefined }, { size: '0' }, { appProperties: { gymKind: 'MONTH_FINAL', gymPeriod: '2026-09' } }, { mimeType: 'text/plain' }]) {
    Object.assign(file, valid, invalid);
    assert.throws(() => h.context.procesarCambioMensual(), /archivo mensual reservado no es válido/);
    assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10'); assert.equal(h.props.get('ARCHIVED_2026-10'), undefined);
  }
  Object.assign(file, valid); h.context.procesarCambioMensual(); assert.equal(h.props.get('CURRENT_PERIOD'), '2026-11');
});
