import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleHarness } from './helpers/google-harness.mjs';
import { handleApi } from '../server/api.mjs';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function panelUiHarness(api) {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const panel = source.slice(source.indexOf('function panel() {'), source.indexOf('function qrView() {'));
  const refresh = source.slice(source.indexOf('async function refreshPanel() {'), source.indexOf('async function mutatePanel('));
  const section = source.slice(source.indexOf('const panelSections = '), source.indexOf('function panel() {'));
  const context = vm.createContext({
    user: 'ProfesorGYM', tab: 'resumen', shift: 'TODO', panelData: null, panelLoading: false, panelError: '', panelRequest: 0, panelUpdatedAt: '',
    api, escape: String, icon: () => '', accountLabel: String, shiftLabel: String, periodLabel: String,
    panelSummary: () => '<p>Datos listos</p>', trendsView: () => '',
    studentsView: () => '', attendanceView: () => '', closuresView: () => '', reportsView: () => '', qrView: () => '', settingsView: () => '',
    spinner: '<span class="loader"></span>', shell(html) { context.html = html; },
    acceptPanel(data) { context.panelData = data; }
  });
  vm.runInContext(section + panel + refresh, context);
  return context;
}

test('consulta lenta mantiene navegación y estado de carga, sin simular un fallo', async () => {
  let resolve;
  const context = panelUiHarness(() => new Promise(done => { resolve = done; }));
  const pending = context.refreshPanel();
  assert.equal(context.panelLoading, true);
  assert.match(context.html, /Cargando datos del mes/);
  assert.match(context.html, /Secciones del panel/);
  assert.ok(!context.html.includes('>Reintentar</button>'));
  assert.ok(!context.html.includes('role="alert"'));
  resolve({ dashboard: { period: '2026-10' } });
  await pending;
  assert.equal(context.panelLoading, false);
  assert.match(context.html, /Datos listos/);
});

test('fallo real ofrece reintento; recuperar datos no solicita otra contraseña', async () => {
  let failed = true;
  const context = panelUiHarness(async () => { if (failed) throw new Error('Google no respondió.'); return { dashboard: { period: '2026-10' } }; });
  await assert.rejects(context.refreshPanel(), /Google no respondió/);
  assert.equal(context.panelLoading, false);
  assert.match(context.html, />Reintentar<\/button>/);
  assert.match(context.html, /Google no respondió/);
  assert.equal(context.user, 'ProfesorGYM');
  failed = false;
  await context.refreshPanel();
  assert.match(context.html, /Datos listos/);
  assert.ok(!context.html.includes('>Reintentar</button>'));
});

test('ingreso completo con Google simulado: una invocación, una lectura por lote, cero escrituras', async () => {
  const h = googleHarness(), before = { ...h.stats }, calls = [];
  const req = { url: '/api/login', method: 'POST', headers: { host: 'localhost:3186', origin: 'http://localhost:3186' }, body: { user: 'Profesor', password: h.passwords.ProfesorGYM, shift: 'MANANA' } };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(raw) { this.body = JSON.parse(raw); } };
  await handleApi(req, res, { env: h.env, invoke: async (action, data) => { calls.push(action); return h.invoke(action, data); } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, ['account.get']);
  assert.equal(res.body.panel.dashboard.shift, 'MANANA');
  assert.equal(res.body.panel.config.enabled, true);
  assert.equal(res.body.panel.revision, '2026-10-07-access-4');
  assert.equal(res.body.hash, undefined);
  assert.equal(h.stats.batchReads - before.batchReads, 1);
  assert.equal(h.stats.batchWrites, before.batchWrites);
});

test('prefetch fallido no cambia cuentas ni deja entrar sin contraseña correcta', async () => {
  const h = googleHarness(), before = h.props.get('ACCOUNT_ProfesorGYM');
  h.context.gymOperational_ = () => { throw new Error('interno sensible'); };
  const result = h.invoke('account.get', { user: 'ProfesorGYM', includeLoginPanel: true });
  assert.equal(result.version, 1); assert.equal(result.panel, undefined);
  assert.equal(result.panelError.status, 503);
  assert.ok(!result.panelError.message.includes('interno sensible'));
  assert.equal(h.props.get('ACCOUNT_ProfesorGYM'), before);
});
