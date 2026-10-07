import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { googleHarness } from './helpers/google-harness.mjs';
import { qaForm } from './helpers/concurrency-scenario.mjs';

function fixture() {
  const h = googleHarness();
  vm.runInContext(readFileSync(new URL('../apps-script/Reinicio.js', import.meta.url), 'utf8'), h.context);
  return h;
}
const protectedState = h => JSON.stringify({ accounts: [...h.props].filter(([k]) => /^(ACCOUNT_|ACCOUNTS_READY|APPS_SCRIPT_SECRET)/.test(k)), triggers: h.triggers });
function empty(h) {
  const state = h.context.gymRead_(h.operational());
  for (const name of Object.keys(h.context.GYM_TABLES)) assert.equal(state[name].length, 0, name);
  assert.equal(state.config.enabled, true);
  assert.equal(state.config.capacity, 20);
  assert.equal(state.config.maxAbsences, 3);
  assert.equal(state.config.codePattern, '^[0-9]{10}$');
  assert.equal(h.stats.exports, 0);
}
test('inicio limpio tras eliminación conserva cuentas y activadores, limpia referencias y no duplica al reintentar', () => {
  const h = fixture(), oldId = h.operational().getId(), protectedBefore = protectedState(h);
  h.files.get(oldId).trashed = true;
  for (const key of ['QA_MONTHLY_old_CURRENT_PERIOD', 'MONTH_2026-09', 'MONTH_READY_2026-09', 'ARCHIVED_2026-10', 'ARCHIVE_PENDING_ID_2026-10', 'LAST_ROLLOVER_ERROR', 'RATE_V1_a']) h.props.set(key, 'old');
  h.props.set('GENERAL_CONFIG', JSON.stringify({ ...h.context.gymConfig_(), enabled: false }));
  const result = h.context.prepararInicioLimpioDesdeEditor();
  assert.equal(result.ok, true); assert.notEqual(h.operational().getId(), oldId);
  assert.equal(protectedState(h), protectedBefore); empty(h);
  assert.ok(h.files.get(oldId).trashed);
  assert.equal([...h.props].some(([k]) => /^(QA_MONTHLY_|RATE_V1_|ARCHIVED_|ARCHIVE_PENDING_ID_)/.test(k)), false);
  const fileCount = h.files.size, currentId = h.operational().getId();
  h.context.prepararInicioLimpioDesdeEditor();
  assert.equal(h.files.size, fileCount); assert.equal(h.operational().getId(), currentId); empty(h);
});
test('archivo inexistente 404 permite reconstruir, sin tocar otros archivos', () => {
  const h = fixture(), id = h.operational().getId();
  h.files.delete(id); h.sheets.delete(id);
  h.files.set('unrelated', { name: 'Otro documento', trashed: false });
  h.context.prepararInicioLimpioDesdeEditor(); empty(h);
  assert.deepEqual(h.files.get('unrelated'), { name: 'Otro documento', trashed: false });
});
test('rechaza un operativo con alumnos y no cambia ninguna propiedad ni fila', () => {
  const h = fixture(); h.invoke('register', qaForm('0000000001'));
  const before = JSON.stringify(h.dump());
  assert.throws(() => h.context.prepararInicioLimpioDesdeEditor(), /todavía contiene registros/);
  assert.equal(JSON.stringify(h.dump()), before);
});
test('permisos, cuotas, red y carpetas equivocadas no se interpretan como borrado', () => {
  for (const status of [403, 429, 500]) {
    const h = fixture(), before = JSON.stringify(h.dump());
    h.context.Drive.Files.get = () => { throw Object.assign(new Error('Sin acceso'), { status }); };
    assert.throws(() => h.context.prepararInicioLimpioDesdeEditor(), /Sin acceso/);
    assert.equal(JSON.stringify(h.dump()), before);
  }
  const h = fixture(); h.files.get(h.operational().getId()).parents = ['otra-carpeta'];
  const before = JSON.stringify(h.dump());
  assert.throws(() => h.context.prepararInicioLimpioDesdeEditor(), /no pertenece/);
  assert.equal(JSON.stringify(h.dump()), before);
});
test('fallo de guardado al crear: el siguiente intento reutiliza el ID del operativo', () => {
  const h = fixture(); h.files.get(h.operational().getId()).trashed = true;
  const original = h.context.Sheets.Spreadsheets.batchUpdate;
  h.context.Sheets.Spreadsheets.batchUpdate = () => { throw new Error('Fallo simulado'); };
  assert.throws(() => h.context.prepararInicioLimpioDesdeEditor(), /confirmar el guardado/);
  const id = h.props.get('MONTH_2026-10'), count = h.files.size;
  h.context.Sheets.Spreadsheets.batchUpdate = original;
  h.context.prepararInicioLimpioDesdeEditor(); empty(h);
  assert.equal(h.props.get('MONTH_2026-10'), id); assert.equal(h.files.size, count);
});
test('reinicio no se expone por HTTP ni por la API pública', () => {
  const h = fixture(), before = [...h.props];
  const result = h.request('prepararInicioLimpioDesdeEditor');
  assert.equal(result.ok, false); assert.equal(result.status, 404);
  assert.deepEqual([...h.props], before);
});
