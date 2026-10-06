/* QA con escrituras en memoria, aislado de .env.local/Drive real. */
import { createServer } from 'node:http';
import { createServer as createVite } from 'vite';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { flowSession } from './helpers/flow-session.mjs';

const restored = process.argv.includes('--restore') ? JSON.parse(await readFile(new URL('../docs/simulacion/flujo-interactivo-qa.json', import.meta.url), 'utf8')) : undefined;
const qa = flowSession(restored), streams = new Set();
const vite = await createVite({ resolve: { alias: { '@zxing/browser': fileURLToPath(new URL('./qa-scanner.mjs', import.meta.url)) } }, server: { middlewareMode: true, hmr: { port: 24680 } }, appType: 'spa' });
const controls = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Control QA aislado</title><style>body{font:16px system-ui;background:#041d37;color:white;padding:24px;max-width:700px}label{display:block;margin:20px 0}input,select,button{font:inherit;padding:10px}output{display:block;white-space:pre-wrap;margin-top:20px}</style><h1>QA AISLADO — sin Google real</h1><p>Web original con API y Apps Script reales. Cámara y servicios Google simulados. Contraseñas exclusivas QA: QA_Profesor_1234 y QA_Admin_1234.</p><a style="color:#f5c52b" href="/">Abrir aplicación</a><form data-action="clock"><label>Fecha y hora ficticia (Lima)<input name="value" type="datetime-local" value="2026-10-05T07:00" required></label><button>Aplicar fecha</button></form><form data-action="scan"><label>Código de carnet ficticio<input name="code" value="00000101" required maxlength="40"></label><button>Simular lectura de carnet</button></form><form data-action="scanner-mode"><label>Modo de cámara<select name="mode"><option value="virtual">Virtual</option><option value="denied">Permiso denegado</option></select></label><button>Aplicar modo de cámara</button></form><button data-command="fail-panel">Fallar próxima consulta del panel</button><button data-command="rollover">Ejecutar cambio mensual ficticio</button><button data-command="snapshot">Guardar evidencia de prueba</button><output id="result" role="status"></output><script>async function command(action,data={}){const r=await fetch('/__qa/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});document.querySelector('output').textContent=JSON.stringify(await r.json(),null,2);}document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();command(f.dataset.action,Object.fromEntries(new FormData(f)));}));document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>command(b.dataset.command)));</script></html>`;
async function body(req) { let raw = ''; for await (const part of req) { raw += part; if (raw.length > 2000) throw new Error('Solicitud QA demasiado grande.'); } return JSON.parse(raw || '{}'); }
async function persist() { const path = new URL('../docs/simulacion/flujo-interactivo-qa.json', import.meta.url); await mkdir(new URL('../docs/simulacion/', import.meta.url), { recursive: true }); await writeFile(path, JSON.stringify(qa.snapshot(), null, 2)); }
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1:3182').pathname;
  if (path.startsWith('/api/')) return qa.api(req, res);
  if (!path.startsWith('/__qa')) return vite.middlewares(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (path === '/__qa' && req.method === 'GET') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(controls); }
  if (path === '/__qa/events' && req.method === 'GET') { res.setHeader('Content-Type', 'text/event-stream'); res.write(': QA virtual\n\n'); streams.add(res); req.on('close', () => streams.delete(res)); return; }
  res.setHeader('Content-Type', 'application/json');
  if (path === '/__qa/scanner-mode' && req.method === 'GET') return res.end(JSON.stringify({ mode: qa.getScannerMode() }));
  if (path === '/__qa/snapshot' && req.method === 'GET') return res.end(JSON.stringify(qa.snapshot()));
  if (req.method !== 'POST' || req.headers.origin !== 'http://' + req.headers.host) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'Control QA solo desde su origen local.' })); }
  try {
    const input = await body(req); let result = { ok: true };
    if (path === '/__qa/clock') qa.setTime(input.value);
    else if (path === '/__qa/scan') { if (!/^[A-Za-z0-9-]{1,40}$/.test(input.code || '')) throw new Error('Código ficticio inválido.'); streams.forEach(stream => stream.write('data: ' + JSON.stringify({ code: input.code }) + '\n\n')); result = { readers: streams.size }; }
    else if (path === '/__qa/scanner-mode') qa.setScannerMode(input.mode);
    else if (path === '/__qa/fail-panel') qa.failPanel();
    else if (path === '/__qa/rollover') result = qa.rollover();
    else if (path !== '/__qa/snapshot') throw new Error('Acción QA desconocida.');
    await persist(); res.end(JSON.stringify(result));
  } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
});
server.listen(3182, '127.0.0.1', () => console.log('QA CON ESCRITURAS EN MEMORIA — http://localhost:3182 — control: /__qa'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await persist(); for (const stream of streams) stream.end(); await vite.close(); server.close(); });
