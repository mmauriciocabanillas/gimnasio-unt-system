import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthEndDate } from '../src/calendar.js';
test('los límites de fecha respetan meses de 28, 29, 30 y 31 días', () => {
  for (const [period, end] of [['2026-02','2026-02-28'],['2028-02','2028-02-29'],['2026-11','2026-11-30'],['2026-10','2026-10-31'],['2026-12','2026-12-31']]) assert.equal(monthEndDate(period), end);
});
