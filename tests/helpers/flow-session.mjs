/* Entorno de auditoría: API/Apps Script reales, servicios Google en memoria. */
import { handleApi } from '../../server/api.mjs';
import { googleHarness } from './google-harness.mjs';

export function flowSession(restored) {
  const h = googleHarness(restored?.now || '2026-10-05T07:00:00-05:00'), events = [...(restored?.events || [])];
  if (restored) {
    if (restored.warning !== 'QA AISLADO. NO GOOGLE REAL.' || restored.state.period !== h.props.get('CURRENT_PERIOD')) throw new Error('Snapshot QA incompatible.');
    h.props.set('GENERAL_CONFIG', JSON.stringify(restored.state.config));
    h.context.gymLock_(() => h.context.gymSave_(restored.state, h.operational()));
    h.exports.push(...restored.exports);
    events.push({ at: h.now().toISOString(), action: 'QA_RESTAURAR_ENTORNO', message: 'Mismos datos ficticios, código actualizado.' });
  }
  let panelFault = false, scannerMode = 'virtual';
  async function api(req, res) {
    const end = res.end.bind(res), started = performance.now();
    res.end = raw => {
      const body = JSON.parse(String(raw));
      events.push({ at: h.now().toISOString(), path: req.url, method: req.method, status: res.statusCode, ms: Math.round(performance.now() - started), message: body.error || body.message || 'Correcto', duplicate: body.duplicate || false });
      end(raw);
    };
    await handleApi(req, res, { env: h.env, invoke: async (action, data) => {
      if (action === 'panel' && panelFault) { panelFault = false; const error = new Error('Fallo de consulta simulado para auditoría.'); error.status = 503; throw error; }
      return h.invoke(action, data);
    } });
  }
  function snapshot() {
    const state = h.context.gymRead_(h.operational());
    return { warning: 'QA AISLADO. NO GOOGLE REAL.', now: h.now().toISOString(), scannerMode, events, stats: h.stats, state: JSON.parse(JSON.stringify(state)), exports: h.exports };
  }
  function setTime(value) {
    if (!/^2026-(10|11)-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + ':00-05:00'))) throw new Error('Fecha QA inválida.');
    h.setTime(value + ':00-05:00');
    if (h.context.GymDomain.lima(h.now()).period === h.props.get('CURRENT_PERIOD')) h.context.procesarFaltas();
    events.push({ at: h.now().toISOString(), action: 'QA_RELOJ', message: value });
  }
  function rollover() {
    const result = h.context.procesarCambioMensual();
    events.push({ at: h.now().toISOString(), action: 'QA_CAMBIO_MENSUAL', result });
    return result;
  }
  return { h, api, snapshot, setTime, rollover, setScannerMode: mode => { scannerMode = mode === 'denied' ? 'denied' : 'virtual'; }, getScannerMode: () => scannerMode, failPanel: () => { panelFault = true; } };
}
