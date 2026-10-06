import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyScenario } from './helpers/monthly-scenario.mjs';

test('mes completo: API + Apps Script + tablas persistidas, 120 alumnos y rollover', async () => {
  const { summary } = await monthlyScenario();
  assert.equal(summary.students, 120); assert.ok(summary.attendance > 100);
  assert.equal(summary.reactivationVerified, true); assert.equal(summary.exportScenarios, 4);
  assert.equal(summary.nextMonthStudents, 0);
});
