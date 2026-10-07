import { createHmac, randomBytes } from 'node:crypto';

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function configured(env = process.env) {
  return Boolean(/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.APPS_SCRIPT_URL || '') && env.APPS_SCRIPT_SECRET?.length >= 32 && env.SESSION_SECRET?.length >= 32);
}
export function signedEnvelope(action, data, secret) {
  // Firmar un JSON ASCII evita diferencias de decodificación en Apps Script.
  // JSON.parse restaura tildes, ñ, emojis y claves sin alterar los datos originales.
  // No usar /u: cada unidad UTF-16 debe escaparse, incluidos pares de sustitución.
  const payload = JSON.stringify({ action, data }).replace(/[\u007f-\uffff]/g,
    character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  const timestamp = Date.now(), nonce = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${payload}`).digest('hex');
  return { payload, timestamp, nonce, signature };
}
const readActions = new Set(['public.config', 'account.get', 'panel', 'automation.status']);
export async function bridge(action, data = {}, env = process.env, { deadline = Date.now() + (action === 'export' || action === 'initialize' ? 55000 : 50000), fetchImpl = fetch } = {}) {
  if (!configured(env)) throw new HttpError('La conexión con Google aún no está configurada.', 503);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.APPS_SCRIPT_URL)) throw new HttpError('La URL de Apps Script debe ser una implementación /exec.', 503);
  const attempts = readActions.has(action) ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new HttpError('Google no respondió a tiempo. Verifica el resultado antes de repetir la operación.', 504);
    let response, result, transportError;
    try {
      response = await fetchImpl(env.APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        // Cada consulta repetida lleva una firma nueva; no reutiliza el nonce.
        body: JSON.stringify(signedEnvelope(action, data, env.APPS_SCRIPT_SECRET)),
        signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(remaining, action === 'export' || action === 'initialize' ? 55000 : 30000)))), redirect: 'follow'
      });
    } catch { transportError = new HttpError('Google no respondió a tiempo. Verifica el resultado antes de repetir la operación.', 504); }
    if (!transportError) {
      try { result = await response.json(); }
      catch { transportError = new HttpError('Apps Script no devolvió JSON. Revisa la URL /exec y el acceso de la implementación.', 502); }
    }
    // La petición siempre es POST: este doGet puede aparecer tras una redirección de Google.
    if (result?.status === 405 && result.error === 'Este endpoint solo admite solicitudes firmadas del servidor.') {
      transportError = new HttpError(result.error, 502);
    }
    if (transportError) {
      if (attempt + 1 < attempts && Date.now() < deadline) continue;
      throw transportError;
    }
    if (!response.ok || !result?.ok) throw new HttpError(result?.error || 'Google no pudo completar la solicitud.', result?.status || 502);
    return result.data;
  }
}
