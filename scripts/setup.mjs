import { bridge } from '../server/bridge.mjs';
import { hashPassword } from '../server/auth.mjs';

// Contraseñas iniciales solo en una herramienta local; nunca en el bundle web.
try {
  const data = await bridge('initialize', { accounts: { ProfesorGYM: hashPassword('Profunt'), Administrador: hashPassword('Adminunt') } });
  console.log('Google inicializado. Las cuentas existentes conservan sus contraseñas.');
  console.log(`Periodo: ${data.period}\nSheet: ${data.sheetUrl}\nInscripciones: ${data.enabled ? 'abiertas' : 'cerradas; confirma los días y el código en Configuración'}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
