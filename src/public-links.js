const defaultPublicOrigin = 'https://gimnasiount.vercel.app';

// Los QR son accesos públicos, nunca direcciones de desarrollo de esta computadora.
export function publicAppOrigin(configuredUrl, currentOrigin) {
  for (const value of [configuredUrl, currentOrigin]) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      const host = url.hostname.toLowerCase();
      if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '0.0.0.0' || /^127\./.test(host)) continue;
      return url.origin;
    } catch { /* Usar el dominio público conocido, no una URL incompleta. */ }
  }
  return defaultPublicOrigin;
}
