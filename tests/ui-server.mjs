/* Solo QA local y datos ficticios explícitos. npm run dev nunca usa este servidor. */
import { createServer as httpServer } from 'node:http';
import { createServer as viteServer } from 'vite';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const context = vm.createContext({ console });
vm.runInContext(await readFile('apps-script/Domain.js', 'utf8'), context);
const G = context.GymDomain, state = G.empty('2026-10'); state.config.enabled = true;
const now = new Date('2026-10-05T14:30:00-05:00');
G.register(state, { code: '00000001', names: 'Alumno', surnames: 'De Prueba', faculty: 'Facultad de prueba', career: 'Carrera de prueba', cycle: 3, method: 'CARNET', slots: [{ day: 1, start: '08:00' }, { day: 3, start: '16:00' }] }, new Date('2026-10-01T07:00:00-05:00'));
G.recalculate(state, now);
const vite = await viteServer({ server: { middlewareMode: true, hmr: { port: 24679 } }, appType: 'spa' });
const server = httpServer(async (req, res) => {
  if (!req.url.startsWith('/api/')) return vite.middlewares(req, res);
  const path = new URL(req.url, 'http://localhost'), action = path.pathname.slice(5);
  const shift = path.searchParams.get('shift') || 'TODO';
  const data = {
    status: { connected: true, publicUrl: '' },
    public: { period: state.period, today: G.lima(now).date, enabled: true, days: state.config.days, capacity: 20, slots: G.occupancy(state, null, now) },
    me: { user: 'ProfesorGYM' },
    panel: { dashboard: G.dashboard(state, now, shift), students: state.students.map(s => ({ ...s, slots: state.reservations.filter(r => r.code === s.code && !r.until) })), attendance: state.attendance, absences: state.absences, closures: state.closures, config: state.config, sheetUrl: 'https://docs.google.com/spreadsheets/' }
  };
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' || !Object.hasOwn(data, action)) { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Servidor QA: las escrituras están deshabilitadas.' })); }
  res.end(JSON.stringify(data[action]));
});
server.listen(3181, '127.0.0.1', () => console.log('QA EXCLUSIVO — DATOS FICTICIOS — SIN GOOGLE — http://localhost:3181'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await vite.close(); server.close(); });
