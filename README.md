# Gimnasio UNT

Aplicación móvil de inscripciones, reservas, asistencia y administración.
Web y API en Vercel → Google Apps Script → Google Sheets y Drive.

## Uso

Web publicada: [gimnasiount.vercel.app](https://gimnasiount.vercel.app).
Profesor y Administrador conservan las mismas funciones.
Los dos QR son distintos y usan el dominio público HTTPS: `/registro` y `/asistencia`.
Registro, asistencia y panel permiten alternar entre tema claro y oscuro.

Reglas del servidor:

- Carnet: exactamente 10 dígitos numéricos.
- Entre 1 y 3 días, una sesión por día; 20 alumnos por horario.
- Sin cupo no se permite inscribir ni cambiar a ese horario.
- Asistencia solo en el día y horario reservado, sin cierre y sin bloqueo por 3 faltas.
- Inscripciones activas por defecto; el personal puede desactivarlas.
- El cierre mensual confirma el Excel archivado antes de abrir el siguiente mes.
- Las contraseñas persisten entre meses y se guardan como hashes privados, no en las hojas.

## Ejecutar localmente

Desde esta carpeta, con `.env.local` configurado:

```powershell
npm install
npm run dev
```

Abrir `http://localhost:3180`. Este servidor usa Google real: no contiene alumnos de demostración ni reemplaza la cámara.
`PUBLIC_APP_URL` debe ser `https://gimnasiount.vercel.app` para mantener los QR públicos también al trabajar localmente.
No subir `.env.local`, claves ni contraseñas al repositorio.

El puente firma un JSON con escapes Unicode en ASCII y declara UTF-8 en el transporte.
Esto evita diferencias de decodificación con Apps Script sin quitar tildes, ñ ni otros caracteres de los datos.
La corrección es compatible con el Apps Script actual; requiere desplegar la API web, no reiniciar los datos ni cambiar las claves.

## Inicio limpio después de borrar los archivos de Drive

La limpieza de Drive es manual. Conservar las dos carpetas configuradas, el proyecto Apps Script, sus propiedades privadas y sus activadores.
No borrar todas las propiedades ni ejecutar setup para cambiar contraseñas.

Después de borrar el Excel operativo anterior y los archivos de prueba:

1. En Apps Script, crear **Reinicio.gs** y copiar el contenido de `apps-script/Reinicio.js`.
2. Guardar y ejecutar **prepararInicioLimpioDesdeEditor** desde el editor.
3. Comprobar que devuelve `ok: true`, el mes actual y los contadores en cero.
4. Cerrar sesión en la web, volver a ingresar y actualizar el panel.

La función reconstruye un operativo vacío con cabeceras y gráficos, activa inscripciones y retira referencias mensuales/de prueba obsoletas.
Conserva cuentas, contraseñas, clave de conexión y activadores.
No borra ningún archivo de Drive. Si el operativo actual aún contiene registros, se detiene sin vaciarlo.
Los reintentos reutilizan el ID creado para evitar duplicados.
Solo se ejecuta manualmente desde el editor: no es una ruta pública ni requiere nueva implementación web por sí sola.

## Verificación y pruebas

```powershell
npm run check
npm test
npm run build
```

Se conservan las pruebas automáticas aisladas para detectar regresiones; no forman parte de la aplicación publicada ni escriben en Google real.
Los archivos generados en `docs/simulacion/` están excluidos de Git. La vista de demostración fue retirada.
Las simulaciones de desarrollador (`simulate:month`, `simulate:concurrency`, `qa:flow`) son opcionales y no deben usarse como servidor del gimnasio.

La activación inicial está en [docs/ACTIVACION.md](docs/ACTIVACION.md).
El contexto aprobado se conserva en [docs/CONTEXTO_APROBADO.md](docs/CONTEXTO_APROBADO.md).
