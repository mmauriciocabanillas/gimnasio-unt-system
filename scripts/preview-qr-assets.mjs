// Sustitución mecánica de dos marcadores por QR locales. No toca datos de Google.
import QRCode from 'qrcode';
import { readFile, writeFile } from 'node:fs/promises';
const path = process.argv[2];
if (!path || !path.endsWith('gimnasio-qr-admin.html')) throw new Error('Indica el fragmento de vista previa.');
let fragment = await readFile(path, 'utf8');
for (const route of ['registro', 'asistencia']) {
  const data = await QRCode.toDataURL(`http://localhost:3180/${route}`, { width: 280, margin: 4, color: { dark: '#041d37', light: '#ffffff' } });
  fragment = fragment.replaceAll(`__QR_${route.toUpperCase()}__`, data);
}
await writeFile(path, fragment);
console.log(`Vista previa lista: ${Buffer.byteLength(fragment)} bytes. QR locales, no productivos.`);
