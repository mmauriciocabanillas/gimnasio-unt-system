import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concurrencyScenario } from './helpers/concurrency-scenario.mjs';
test('workers simultáneos: último cupo, altas, asistencias, duplicados y cierre mensual', { timeout: 180000 }, async () => {
  const result = await concurrencyScenario();
  assert.equal(result.cases.length, 8); assert.equal(result.passwordChanges, 0);
});
