import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { googleHarness } from './helpers/google-harness.mjs';

const probe = readFileSync(new URL('../apps-script/PruebaCierre.js', import.meta.url), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function fixture(source = probe) {
  const h = googleHarness('2026-10-06T16:30:00-05:00');
  const drive = h.context.DriveApp, lookup = drive.getFolderById;
  function wrap(folder) {
    const create = folder.createFolder;
    folder.getUrl = () => `https://drive.google.com/drive/folders/${folder.getId()}`;
    folder.createFolder = name => wrap(create(name));
    folder.getFilesByType = mime => {
      const rows = [...h.files.values()].filter(f => f.mimeType === mime && f.parents?.includes(folder.getId()));
      let i = 0;
      return { hasNext: () => i < rows.length, next: () => { const f = rows[i++]; return { getId: () => f.id }; } };
    };
    return folder;
  }
  const wrapped = new Set();
  drive.getFolderById = id => { const folder = lookup(id); if (!wrapped.has(id)) { wrap(folder); wrapped.add(id); } return folder; };
  drive.createFolder = () => drive.getFolderById('qa-probe-root');
  const fileLookup = drive.getFileById;
  drive.getFileById = id => Object.assign(fileLookup(id), { getBlob: () => ({ id, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    getContentType() { return this.contentType; }, setContentType(type) { this.contentType = type; return this; } }), getUrl: () => `https://drive.google.com/file/d/${id}/view` });
  h.context.LockService.getUserLock = () => ({ tryLock: () => true, releaseLock() {} });
  // ZIP is a stub here. The probe will unzip the actual binary only in Google.
  h.context.Utilities.unzip = blob => {
    if (blob.getContentType() !== 'application/zip') throw new Error('Invalid argument: ContentType. Should be of type: application/zip');
    return [
      { getName: () => 'xl/workbook.xml', getDataAsString: () => 'REGISTRADOS ASISTENCIAS' },
      { getName: () => 'xl/sharedStrings.xml', getDataAsString: () => '9000000001 9000000002' }
    ];
  };
  vm.runInContext(source, h.context);
  return h;
}
const production = h => ({ props: [...h.props].filter(([k]) => !k.startsWith('QA_MONTHLY_')), sheet: plain(h.operational().getSheets().map(s => s.values)), triggers: plain(h.triggers) });
function run(h) {
  // The memory harness checks all writes under its shared script mutex.
  // Google probe uses a distinct user mutex and never locks production.
  return h.context.gymLock_(() => h.context.verificarCierreMensualAislado());
}

test('prueba Google aislada clona funciones vigentes sin cambiar producción ni sus bindings', () => {
  const h = fixture(), before = production(h);
  const bindings = [h.context.gymProperties_, h.context.gymLock_, h.context.gymExport_, h.context.procesarCambioMensual, h.context.GYM_FOLDERS];
  const report = run(h);
  assert.equal(report.ok, true); assert.equal(report.testClosed, '2026-09'); assert.equal(report.testOpened, '2026-10');
  assert.equal(report.archiveCopies, 1); assert.equal(report.exportCount, 1); assert.equal(report.markerFailureRecovered, true);
  assert.equal(report.newMonthEmpty, true); assert.equal(report.productionUnchanged, true); assert.equal(report.passwordChanges, 0);
  assert.deepEqual(production(h), before);
  assert.deepEqual([h.context.gymProperties_, h.context.gymLock_, h.context.gymExport_, h.context.procesarCambioMensual, h.context.GYM_FOLDERS], bindings);
  assert.equal([...h.sheets.values()].filter(s => s.name.startsWith('PRUEBA_')).length, 3);
});

test('fallo real de exportación aborta prueba sin adelantar producción ni fabricar éxito', () => {
  const h = fixture(), before = production(h);
  h.context.UrlFetchApp.fetch = () => ({ getResponseCode: () => 503 });
  assert.throws(() => run(h), /otro motivo.*Google no pudo exportar/);
  assert.deepEqual(production(h), before);
  assert.equal(h.stats.exports, 0);
  assert.equal([...h.props].some(([k]) => k.startsWith('QA_MONTHLY_') && k.endsWith('ARCHIVED_2026-09')), false);
});

test('propiedad QA alterada no permite abrir el libro real de producción', () => {
  const h = fixture(), before = production(h), properties = h.context.PropertiesService.getScriptProperties();
  const originalSet = properties.setProperty, actualBook = h.operational().getId();
  properties.setProperty = (key, value) => originalSet(key, key.startsWith('QA_MONTHLY_') && key.endsWith('_MONTH_2026-10') ? actualBook : value);
  assert.throws(() => run(h), /libro ajeno a la prueba/);
  assert.deepEqual(production(h), before);
});

test('código vigente diferente aborta antes de crear archivos o propiedades QA', () => {
  const h = fixture(), before = production(h), filesBefore = h.files.size;
  h.context.procesarCambioMensual = function () { return { changed: true }; };
  assert.throws(() => run(h), /no coinciden con la prueba/);
  assert.deepEqual(production(h), before);
  assert.equal(h.files.size, filesBefore);
  assert.equal([...h.props].some(([key]) => key.startsWith('QA_MONTHLY_')), false);
});

test('sin normalizar el Blob a ZIP reproduce el error visto en Google sin modificar producción', () => {
  const previousProbe = probe.replace("archive.getBlob().setContentType('application/zip')", 'archive.getBlob()');
  const h = fixture(previousProbe), before = production(h);
  assert.throws(() => run(h), /Invalid argument: ContentType.*application\/zip/);
  assert.deepEqual(production(h), before);
  assert.equal([...h.files.values()].filter(f => f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').length, 1);
});
