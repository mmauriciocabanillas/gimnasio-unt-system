import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';

try {
  await access('.env.local');
  console.log('.env.local ya existe; se conserva sin cambios.');
} catch {
  await writeFile('.env.local', [
    '# Archivo privado. No subir a Git, no copiar a public/.',
    'APPS_SCRIPT_URL=',
    `APPS_SCRIPT_SECRET=${randomBytes(32).toString('hex')}`,
    `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
    'PUBLIC_APP_URL=',
    'PORT=3180',
    ''
  ].join('\n'), { flag: 'wx' });
  console.log('Creado .env.local con secretos aleatorios. Completa solo APPS_SCRIPT_URL y PUBLIC_APP_URL cuando publiques los servicios.');
}
