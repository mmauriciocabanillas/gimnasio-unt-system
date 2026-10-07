/* Comparación local reproducible con el código anterior; no Google ni .env.local. */
import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { googleHarness } from '../tests/helpers/google-harness.mjs';
import { qaForm } from '../tests/helpers/concurrency-scenario.mjs';
const baseline = '9971254';
const oldSource = ['Domain.js','Code.js'].map(name => execFileSync('git', ['show', `${baseline}:apps-script/${name}`], { encoding: 'utf8' })).join('\n');
function reproduce(source) {
  const h = googleHarness('2026-10-05T07:00:00-05:00', source);
  h.invoke('configure', { actor: 'Administrador', version: 1, days: [1,2,3,4,5], enabled: true, codePattern: '^[0-9]{10}$' });
  h.invoke('register', qaForm('0000000100'));
  const accounts = ['ACCOUNT_ProfesorGYM','ACCOUNT_Administrador'].map(k => h.props.get(k));
  const properties = h.context.PropertiesService.getScriptProperties(), set = properties.setProperty; let failOnce = true;
  properties.setProperty = (key, value) => { if (key === 'ARCHIVED_2026-10' && failOnce) { failOnce = false; throw new Error('QA marcador mensual perdido'); } return set(key, value); };
  h.setTime('2026-11-01T07:00:00-05:00'); assert.throws(() => h.context.procesarCambioMensual(), /QA marcador/);
  assert.equal(h.props.get('CURRENT_PERIOD'), '2026-10');
  h.context.procesarCambioMensual();
  assert.deepEqual(['ACCOUNT_ProfesorGYM','ACCOUNT_Administrador'].map(k => h.props.get(k)), accounts);
  return { revision: h.context.GYM_REVISION, finalCopies: [...h.files.values()].filter(f => f.name === 'GIMNASIO_UNT_OCTUBRE_2026.xlsx').length,
    exports: h.stats.exports, finalPeriod: h.props.get('CURRENT_PERIOD'), accountsUnchanged: true };
}
const before = reproduce(oldSource), after = reproduce();
assert.equal(before.finalCopies, 2); assert.equal(after.finalCopies, 1); assert.equal(after.exports, 1);
const result = { warning: 'QA aislado. Ninguna escritura en Google ni cambio de contraseñas reales.', at: new Date().toISOString(), baseline, before, after };
await mkdir(new URL('../docs/simulacion/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/simulacion/archivo-mensual-antes-despues.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
