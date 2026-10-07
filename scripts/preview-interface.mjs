/* Actual app with fictional data; no .env, persistence, or Google network. */
import { createServer } from 'node:http';
import { createServer as createVite } from 'vite';
import { fileURLToPath } from 'node:url';
import { flowSession } from '../tests/helpers/flow-session.mjs';

const qa = flowSession();
qa.h.invoke('configure', { days: [1, 2, 3, 4, 5], codePattern: '^[0-9]{10}$', enabled: true, actor: 'Administrador', version: 1 });
const people = [
  ['María Fernanda', 'Valverde Alvarado', 'Ingeniería', 'Ingeniería Industrial'],
  ['Diego Andrés', 'Córdova Ruiz', 'Ciencias Económicas', 'Administración'],
  ['Lucía Alejandra', 'Rodríguez de la Cruz', 'Educación y Ciencias de la Comunicación', 'Educación Secundaria: Lengua y Literatura'],
  ['José Luis', 'Vásquez Ríos', 'Ingeniería', 'Ingeniería Informática'],
  ['Ana Sofía', 'Mendoza León', 'Ciencias Biológicas', 'Biología'],
  ['Carlos Eduardo', 'Salazar Flores', 'Ciencias Económicas', 'Contabilidad'],
];
for (const [index, [names, surnames, faculty, career]] of people.entries()) {
  qa.h.invoke('register', { period: '2026-10', code: String(9000000000 + index), names, surnames, faculty, career, cycle: index + 3, method: 'CARNET', slots: [{ day: 1, start: '15:00' }, { day: 3, start: '16:00' }, { day: 5, start: '17:00' }] });
}
qa.setTime('2026-10-05T15:10');
for (let i = 0; i < 4; i++) qa.h.invoke('attend', { code: String(9000000000 + i), method: 'CARNET' });
const vite = await createVite({ resolve: { alias: { '@zxing/browser': fileURLToPath(new URL('../tests/qa-scanner.mjs', import.meta.url)) } }, server: { middlewareMode: true, hmr: { port: 24684 } }, appType: 'spa' });
const streams = new Set();
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost:3184').pathname;
  if (path.startsWith('/api/')) return qa.api(req, res);
  if (path === '/__qa/scanner-mode') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ mode: qa.getScannerMode() })); }
  if (path === '/__qa/events') { res.setHeader('Content-Type', 'text/event-stream'); res.write(': QA\n\n'); streams.add(res); req.on('close', () => streams.delete(res)); return; }
  if (path === '/__qa/scan' && req.method === 'POST') {
    if (req.headers.origin !== 'http://' + req.headers.host) { res.statusCode = 403; return res.end('{}'); }
    for await (const _ of req) { /* No request data is used. */ }
    streams.forEach(stream => stream.write('data: ' + JSON.stringify({ code: '9000000006' }) + '\n\n'));
    return res.end('{"ok":true}');
  }
  if (path === '/__qa') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>QA visual aislado</title><h1>Vista ficticia — no Google real</h1><p>ProfesorGYM: QA_Profesor_1234. Administrador: QA_Admin_1234.</p><a href="/">Abrir sistema</a><button id="scan">Simular carnet 9000000006</button><script>document.querySelector("#scan").onclick=()=>fetch("/__qa/scan",{method:"POST"});</script></html>');
  }
  return vite.middlewares(req, res);
});
server.listen(3184, '127.0.0.1', () => console.log('UI QA AISLADA — http://localhost:3184 — cuentas QA, no datos reales'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { streams.forEach(s => s.end()); await vite.close(); server.close(); });
