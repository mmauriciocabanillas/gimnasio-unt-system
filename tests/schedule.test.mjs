import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceDayLimit, scheduleAvailability } from '../src/schedule.js';

const select = (value = '') => ({ value, options: [{ value: '', dataset: {} }, { value: '15:00', dataset: { full: 'false' } }, { value: '16:00', dataset: { full: 'true' } }] });
test('ambos formularios bloquean los días sin seleccionar al llegar a tres', () => {
  const controls = [select('15:00'), select('15:00'), select('15:00'), select(), select()];
  assert.deepEqual(enforceDayLimit(controls), { count: 3, rejected: false });
  assert.ok(controls.slice(3).every(s => s.options[1].disabled));
  assert.ok(controls.every(s => !s.options[0].disabled));
  assert.equal(controls[0].options[1].disabled, false);
});
test('intentar un cuarto día lo revierte; quitar un día libera opciones pero nunca cupos completos', () => {
  const controls = [select('15:00'), select('15:00'), select('15:00'), select('15:00')];
  assert.deepEqual(enforceDayLimit(controls, controls[3]), { count: 3, rejected: true });
  assert.equal(controls[3].value, '');
  controls[0].value = '';
  assert.equal(enforceDayLimit(controls).count, 2);
  assert.equal(controls[3].options[1].disabled, false);
  assert.ok(controls.every(s => s.options[2].disabled));
});
test('cambio permite conservar cupo propio completo, sin liberar cupos ajenos ni duplicar el propio', () => {
  const data = { slots: [{ day: 1, start: '15:00', available: 0 }, { day: 2, start: '15:00', available: 0 }] };
  const own = [{ day: 1, start: '15:00' }, { day: 1, start: '15:00' }];
  const adjusted = scheduleAvailability(data, own);
  assert.deepEqual(adjusted.slots.map(s => s.available), [1, 0]);
  assert.equal(data.slots[0].available, 0);
});
