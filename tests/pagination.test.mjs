import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../src/pagination.js';

test('historial grande renderiza como máximo 100 filas sin perder datos', () => {
  const rows = Array.from({ length: 789 }, (_, i) => i);
  const first = paginate(rows), last = paginate(rows, 7);
  assert.equal(first.rows.length, 100); assert.equal(first.pages, 8); assert.equal(first.total, 789);
  assert.equal(last.rows.length, 89); assert.equal(last.rows.at(-1), 788);
});
test('página vacía o fuera de rango no rompe las tablas', () => {
  assert.deepEqual(paginate([]), { rows: [], page: 0, pages: 1, total: 0 });
  assert.equal(paginate([1], 999).page, 0); assert.equal(paginate([1], -1).page, 0);
});
