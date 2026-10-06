import { HttpError, bridge, configured } from './bridge.mjs';
import { createSession, hashPassword, readSession, sessionCookie, verifyPassword } from './auth.mjs';
import { createHmac } from 'node:crypto';

async function requestBody(req) {
  function object(raw) {
    let value; try { value = JSON.parse(raw); } catch { throw new HttpError('Solicitud inválida.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError('Solicitud inválida.');
    return value;
  }
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 16000) throw new HttpError('Solicitud demasiado grande.', 413);
    return object(raw);
  }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16000) throw new HttpError('Solicitud demasiado grande.', 413); }
  return raw ? object(raw) : {};
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || (process.env.VERCEL ? 'https' : 'http');
  if (!origin || origin !== `${protocol}://${host}`) throw new HttpError('Abre el formulario desde la web del gimnasio.', 403);
}
function tokenFrom(req) {
  return String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('gym_session='))?.slice(12);
}
export async function handleApi(req, res, { invoke = bridge, env = process.env } = {}) {
  if (invoke === bridge) {
    // Cuenta y panel comparten un presupuesto; no suman sus tiempos de reintento.
    const deadline = Date.now() + 50000;
    invoke = (action, data) => bridge(action, data, env, { deadline });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    // En Vercel las reescrituras conservan la ruta original en req.url.
    const parsed = new URL(req.url, 'http://localhost');
    const path = ['/api', '/api/index'].includes(parsed.pathname) && parsed.searchParams.has('route')
      ? `/api/${parsed.searchParams.get('route')}` : parsed.pathname.replace(/\/$/, '');
    const method = req.method;
    if (path === '/api/status' && method === 'GET') return send(200, { connected: configured(env), configured: configured(env), health: 'not_checked', publicUrl: env.PUBLIC_APP_URL || '' });
    if (!configured(env)) throw new HttpError('El sistema aún no está conectado a Google. El personal debe completar la configuración.', 503);
    if (method === 'POST') sameOrigin(req);
    const ip = env.VERCEL ? String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'local';
    // Solo el servidor crea esta identidad; no guardar IP ni contraseñas en Google.
    const rateKey = createHmac('sha256', env.SESSION_SECRET).update(ip).digest('hex');
    if (path === '/api/public' && method === 'GET') return send(200, await invoke('public.config', { _rate: rateKey }));
    if (['/api/register', '/api/attend'].includes(path) && method === 'POST') {
      const input = await requestBody(req);
      // No reenviar campos de cuenta/versión recibidos desde el público.
      const data = path === '/api/register'
        ? { period: input.period, code: input.code, method: input.method, names: input.names, surnames: input.surnames, faculty: input.faculty, career: input.career, cycle: input.cycle, slots: input.slots }
        : { code: input.code, method: input.method, fullName: input.fullName };
      return send(200, await invoke(path.endsWith('register') ? 'register' : 'attend', { ...data, _rate: rateKey }));
    }
    const secure = Boolean(env.VERCEL || req.headers['x-forwarded-proto'] === 'https');
    if (path === '/api/login' && method === 'POST') {
      const input = await requestBody(req);
      if (!['ProfesorGYM', 'Administrador'].includes(input.user) || typeof input.password !== 'string' || input.password.length > 128) throw new HttpError('Usuario o contraseña incorrectos.', 401);
      const account = await invoke('account.get', { user: input.user, _rate: rateKey });
      if (!verifyPassword(input.password, account.hash)) throw new HttpError('Usuario o contraseña incorrectos.', 401);
      res.setHeader('Set-Cookie', sessionCookie(createSession(input.user, account.version, env.SESSION_SECRET), secure));
      return send(200, { user: input.user });
    }
    if (path === '/api/logout' && method === 'POST') { res.setHeader('Set-Cookie', sessionCookie('', secure)); return send(200, { ok: true }); }
    const session = readSession(tokenFrom(req), env.SESSION_SECRET);
    if (!session) throw new HttpError('Inicia sesión para acceder al panel.', 401);
    const actor = { actor: session.user, version: session.version };
    if (path === '/api/automation' && method === 'GET') return send(200, await invoke('automation.status', actor));
    if (path === '/api/panel' && method === 'GET') {
      const shift = parsed.searchParams.get('shift') || 'TODO';
      if (!['TODO', 'MANANA', 'TARDE'].includes(shift)) throw new HttpError('Turno inválido.');
      // gymActor_ verifica la version persistente dentro de esta misma llamada.
      // No duplicar account.get reduce redirecciones y conserva la revocacion.
      return send(200, { ...await invoke('panel', { ...actor, shift }), user: session.user });
    }
    const actions = { '/api/closure': 'closure', '/api/schedule': 'schedule', '/api/configure': 'configure', '/api/export': 'export' };
    if (actions[path] && method === 'POST') {
      const input = await requestBody(req);
      if (input.shift !== undefined && !['TODO', 'MANANA', 'TARDE'].includes(input.shift)) throw new HttpError('Turno inválido.');
      if (input.panelShift !== undefined && !['TODO', 'MANANA', 'TARDE'].includes(input.panelShift)) throw new HttpError('Turno inválido.');
      // Cada acción ya ejecuta gymActor_: misma revocación, una sola ida a Google.
      return send(200, await invoke(actions[path], { ...input, ...actor }));
    }
    // Consultar versión persistente revoca sesiones al cambiar la contraseña.
    const account = await invoke('account.get', { user: session.user });
    if (account.version !== session.version) throw new HttpError('Tu sesión venció. Vuelve a ingresar.', 401);
    if (path === '/api/me' && method === 'GET') return send(200, { user: session.user });
    if (path === '/api/password' && method === 'POST') {
      const input = await requestBody(req);
      if (!verifyPassword(input.currentPassword, account.hash)) throw new HttpError('La contraseña actual es incorrecta.', 403);
      if (typeof input.newPassword !== 'string' || input.newPassword.length < 6 || input.newPassword.length > 128 || input.newPassword !== input.confirmPassword) throw new HttpError('Las nuevas contraseñas deben coincidir y tener entre 6 y 128 caracteres.');
      const result = await invoke('account.change', { ...actor, hash: hashPassword(input.newPassword) });
      res.setHeader('Set-Cookie', sessionCookie(createSession(session.user, result.version, env.SESSION_SECRET), secure));
      return send(200, { message: 'Contraseña actualizada.' });
    }
    throw new HttpError('Ruta no encontrada.', 404);
  } catch (error) { send(error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación.' }); }
}
