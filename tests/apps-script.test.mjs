import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { signedEnvelope } from '../server/bridge.mjs';

const source = await readFile(new URL('../apps-script/Domain.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../apps-script/Code.js', import.meta.url), 'utf8');
const secret = 'test-secret-only-for-mocked-google'.padEnd(64, 'x');
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-05T12:00:00Z'])); } }
function harness(period = '2026-10') {
  const props = new Map([['APPS_SCRIPT_SECRET', secret], ['CURRENT_PERIOD', period], ['MONTH_' + period, 'sheet-id']]);
  const properties = { getProperty: key => props.get(key) ?? null, setProperty(key, value) { props.set(key, value); return this; }, deleteProperty: key => props.delete(key) };
  let held = false, acquisitions = 0, releases = 0;
  const cache = new Map();
  const context = vm.createContext({
    console, Date: FixedDate,
    PropertiesService: { getScriptProperties: () => properties },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    Utilities: { computeHmacSha256Signature: (message, key) => [...createHmac('sha256', key).update(message).digest()].map(x => x > 127 ? x - 256 : x) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (held) return false; held = true; acquisitions++; return true; }, releaseLock: () => { held = false; releases++; } }) }
  });
  vm.runInContext(source, context);
  return { context, props, properties, locked: () => held, counts: () => ({ acquisitions, releases }) };
}
function request(h, action, data) { return h.context.doPost({ postData: { contents: JSON.stringify(signedEnvelope(action, data, secret)) } }); }

test('Apps Script rechaza llamadas sin firma y siempre libera el lock', () => {
  const h = harness(); const result = h.context.doPost({ postData: { contents: '{}' } });
  assert.equal(result.ok, false); assert.equal(result.status, 401); assert.equal(h.locked(), false); assert.deepEqual(h.counts(), { acquisitions: 1, releases: 1 });
});
test('Apps Script no acepta el replay de una solicitud firmada', () => {
  const h = harness(); h.context.gymDispatch_ = () => ({ fine: true });
  const e = { postData: { contents: JSON.stringify(signedEnvelope('public.config', {}, secret)) } };
  assert.equal(h.context.doPost(e).ok, true); assert.equal(h.context.doPost(e).status, 409);
});

test('Apps Script comprueba la versión revocada antes de devolver el panel', () => {
  const h = harness();
  h.props.set('ACCOUNT_Administrador', JSON.stringify({ hash: 'no-se-devuelve', version: 2 }));
  h.context.gymOperational_ = () => ({ state: h.context.GymDomain.empty('2026-10'), sheet: { getUrl: () => 'https://docs.google.com/spreadsheets/d/mock' } });
  const expired = request(h, 'panel', { actor: 'Administrador', version: 1, shift: 'TODO' });
  assert.equal(expired.ok, false); assert.equal(expired.status, 401);
  const current = request(h, 'panel', { actor: 'Administrador', version: 2, shift: 'TODO' });
  assert.equal(current.ok, true); assert.equal(current.data.students.length, 0);
  assert.ok(!JSON.stringify(current).includes('no-se-devuelve'));
});
test('operaciones de reserva toman el lock antes de leer y guardar; dos candidatos no superan 20', () => {
  const h = harness(), G = h.context.GymDomain;
  let state = G.empty('2026-10'); state.config.enabled = true;
  const input = code => ({ code, names: 'Nombre', surnames: 'Apellido', faculty: 'Facultad', career: 'Carrera', cycle: 2, method: 'CARNET', slots: [{ day: 1, start: '08:00' }] });
  for (let i = 0; i < 19; i++) G.register(state, input(String(i).padStart(8, '0')), new Date('2026-10-01T12:00:00Z'));
  h.context.gymOperational_ = () => { assert.equal(h.locked(), true); return { state: JSON.parse(JSON.stringify(state)), sheet: {} }; };
  h.context.gymSave_ = next => { assert.equal(h.locked(), true); state = JSON.parse(JSON.stringify(next)); };
  const first = request(h, 'register', input('00000100')), second = request(h, 'register', input('00000101'));
  assert.equal(first.ok, true); assert.equal(second.status, 409); assert.equal(state.students.length, 20); assert.equal(h.locked(), false);
});
test('guardado operativo usa una única escritura atómica de todas las tablas', () => {
  const h = harness(); let called = 0;
  h.context.Sheets = { Spreadsheets: { get: () => ({ sheets: [1, 2].map(id => ({ properties: { sheetId: id, gridProperties: { rowCount: 100, columnCount: 20 } } })) }), batchUpdate: (body, id) => { called++; assert.equal(id, 'sheet-id'); assert.equal(body.requests.length, 2); for (const r of body.requests) assert.ok(r.updateCells); } } };
  const sheet = id => ({ getSheetId: () => id, getLastRow: () => 1, getMaxRows: () => 100, getMaxColumns: () => 20 });
  h.context.gymAtomicWrite_({ getId: () => 'sheet-id' }, [{ sheet: sheet(1), headers: ['Código', 'Dato'], rows: [['00000001', '=NO_ES_FORMULA']] }, { sheet: sheet(2), headers: ['Inicio'], rows: [['08:00']] }]);
  assert.equal(called, 1);
});
test('fallo del Excel mensual conserva el periodo, el operativo y las cuentas', () => {
  const h = harness('2026-09'), G = h.context.GymDomain;
  h.props.set('ACCOUNT_ProfesorGYM', 'hash-persistente');
  h.context.SpreadsheetApp = { openById: () => ({}) };
  h.context.gymRead_ = () => G.empty('2026-09'); h.context.gymSave_ = () => {};
  h.context.gymExport_ = () => { throw new Error('Export falló'); };
  let created = false; h.context.gymCreateMonth_ = () => { created = true; };
  assert.throws(() => h.context.procesarCambioMensual(), /Export falló/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-09'); assert.equal(h.props.has('ARCHIVED_2026-09'), false); assert.equal(created, false);
  assert.equal(h.props.get('ACCOUNT_ProfesorGYM'), 'hash-persistente'); assert.equal(h.locked(), false);
});
test('rollover guarda el ID del archivo antes de activar el nuevo mes y respeta reintentos', () => {
  const h = harness('2026-09'), G = h.context.GymDomain;
  h.context.SpreadsheetApp = { openById: () => ({}) };
  h.context.gymRead_ = () => G.empty('2026-09'); h.context.gymSave_ = () => {};
  let exports = 0; h.context.gymExport_ = () => { exports++; return { fileId: 'xlsx-final' }; };
  let first = true;
  h.context.gymCreateMonth_ = period => {
    assert.equal(h.props.get('ARCHIVED_2026-09'), 'xlsx-final'); assert.equal(h.props.get('CURRENT_PERIOD'), '2026-09'); assert.equal(period, '2026-10');
    if (first) { first = false; throw new Error('Crear mes falló'); }
  };
  assert.throws(() => h.context.procesarCambioMensual(), /Crear mes falló/);
  h.context.procesarCambioMensual(); assert.equal(exports, 1); assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10');
});
test('exportación parcial no ejecuta guardado ni rotación del operativo', () => {
  const h = harness(), G = h.context.GymDomain;
  h.props.set('ACCOUNT_Administrador', JSON.stringify({ hash: 'private-hash', version: 1 }));
  h.context.gymOperational_ = () => ({ state: G.empty('2026-10'), sheet: {} });
  h.context.gymExport_ = () => ({ filename: 'corte.xlsx' });
  h.context.gymSave_ = () => { throw new Error('No debe guardar'); };
  assert.equal(request(h, 'export', { actor: 'Administrador', version: 1, shift: 'TODO' }).ok, true);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10');
});

test('lecturas liberan el lock antes de consultar Sheets; escrituras siguen protegidas', () => {
  const h = harness(); h.context.gymDispatch_ = () => { assert.equal(h.locked(), false); return {}; };
  assert.equal(request(h, 'public.config', {}).ok, true);
});

test('rate limit de login persiste entre ejecuciones y no almacena IP ni contraseña', () => {
  const h = harness(); h.context.gymDispatch_ = () => ({});
  const data = { user: 'ProfesorGYM', _rate: 'a'.repeat(64) };
  for (let i = 0; i < 12; i++) assert.equal(request(h, 'account.get', data).ok, true);
  assert.equal(request(h, 'account.get', data).status, 429);
  assert.ok(h.props.get('RATE_V1_a')); assert.ok(!h.props.get('RATE_V1_a').includes('password'));
});

test('escritura incremental conserva filas previas y omite tablas sin cambios', () => {
  const h = harness(); let body;
  h.context.Sheets = { Spreadsheets: { get: () => ({ sheets: [1, 2].map(id => ({ properties: { sheetId: id, gridProperties: { rowCount: 100, columnCount: 20 } } })) }), batchUpdate: value => { body = value; } } };
  const sheet = id => ({ getSheetId: () => id });
  h.context.gymAtomicWrite_({ getId: () => 'sheet-id' }, [
    { sheet: sheet(1), headers: ['Código'], rows: [['0001'], ['0002']], previousRows: [['Código'], ['0001']] },
    { sheet: sheet(2), headers: ['Inicio'], rows: [['08:00']], previousRows: [['Inicio'], ['08:00']] }
  ]);
  assert.equal(body.requests.length, 1); assert.equal(body.requests[0].updateCells.range.startRowIndex, 2);
  assert.equal(body.requests[0].updateCells.rows.length, 1);
});
