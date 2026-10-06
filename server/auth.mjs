import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, hash) {
  if (typeof password !== 'string' || password.length > 128 || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash || '')) return false;
  const [, salt, digest] = hash.split('$');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex'));
}
export function createSession(user, version, secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ user, version, exp: now + 8 * 3600000 })).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
export function readSession(token, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 500) return null;
    const [body, signature, extra] = token.split('.');
    if (extra || !body || !signature) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url'));
    if (!['ProfesorGYM', 'Administrador'].includes(payload.user) || !Number.isInteger(payload.version) || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
    return payload;
  } catch { return null; }
}
export function sessionCookie(token, secure = true) {
  return `gym_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 28800 : 0}${secure ? '; Secure' : ''}`;
}
