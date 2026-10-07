import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCapacity } from '../src/capacity.js';

test('gráfico diario muestra el aforo 20 y no suma los cinco días como 100', () => {
  const dashboard = { today: '2026-10-05', byBlock: [{ start: '15:00', occupied: 35, capacity: 100 }], slots: [1, 2, 3, 4, 5].map(day => ({ day, start: '15:00', occupied: day === 1 ? 7 : 6 })) };
  assert.deepEqual(dailyCapacity(dashboard), [{ start: '15:00', occupied: 7, capacity: 20 }]);
  dashboard.today = '2026-10-06';
  assert.deepEqual(dailyCapacity(dashboard), [{ start: '15:00', occupied: 6, capacity: 20 }]);
});

test('día sin reservas muestra cero; el bloque completo muestra 20/20', () => {
  const dashboard = { today: '2026-10-05', byBlock: [{ start: '15:00' }, { start: '16:00' }], slots: [{ day: 1, start: '15:00', occupied: 20 }] };
  assert.deepEqual(dailyCapacity(dashboard), [{ start: '15:00', occupied: 20, capacity: 20 }, { start: '16:00', occupied: 0, capacity: 20 }]);
  dashboard.today = '2026-10-10';
  assert.ok(dailyCapacity(dashboard).every(row => row.occupied === 0 && row.capacity === 20));
});
