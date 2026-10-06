# Activación de Google y Vercel

## 1. Cuenta propietaria y carpetas

Usar la cuenta Google exclusiva del gimnasio. Debe poder crear archivos en:

- BASE DE DATOS: https://drive.google.com/drive/folders/1S34HRZq7u6pE6fSX3SfxClpOBNh5561f
- ARCHIVO 2026: https://drive.google.com/drive/folders/1Sb7_aVAIRwzgSx0IWK-LIok9tJPG5qqw

El permiso de lectura del enlace no permite inicializar el sistema. Mantener privados los Sheets con datos de alumnos; la app accede mediante el script propietario.

## 2. Crear el proyecto Apps Script

1. Abrir https://script.google.com con la cuenta exclusiva → **Nuevo proyecto**. Nombre: `Gimnasio UNT`.
2. Reemplazar el contenido de `Código.gs` con `apps-script/Code.js`.
3. Añadir un archivo de secuencia de comandos llamado `Domain` y pegar `apps-script/Domain.js`.
4. En **Configuración del proyecto**, marcar **Mostrar el archivo de manifiesto appsscript.json**. Sustituirlo por `apps-script/appsscript.json`. Zona horaria: `America/Lima`.
5. En **Servicios**, verificar **Google Sheets API v4** (`Sheets`) y **Google Drive API v3** (`Drive`). El manifiesto declara ambos. Con un proyecto Cloud estándar, habilitar ambas API también en la consola de Cloud.

Todavía no ejecutar las funciones de faltas o cambio mensual.

## 3. Configuración privada local

Desde la carpeta del proyecto:

```powershell
npm run config:init
```

Esto crea `.env.local` con secretos aleatorios, sin sobrescribir un archivo existente. Ese archivo está excluido de Git y del frontend.

En **Configuración del proyecto → Propiedades de la secuencia de comandos**, añadir:

| Propiedad | Valor |
| --- | --- |
| `APPS_SCRIPT_SECRET` | El mismo valor de `.env.local` |

No pegar el archivo completo ni `SESSION_SECRET` en una hoja de cálculo.

## 4. Publicar Apps Script

**Implementar → Nueva implementación → Aplicación web**:

- Ejecutar como: **Yo**, la cuenta del gimnasio.
- Quién tiene acceso: **Cualquier persona**.

La aplicación no admite llamadas sin una firma del servidor, aunque la implementación web sea accesible por URL. El endpoint no sirve el frontend ni contiene login de alumnos.

Completar la autorización Google requerida por el propietario. Si Google muestra una advertencia de seguridad que requiere intervención, completar esa revisión personalmente.

Copiar la URL que termina en `/exec` a `APPS_SCRIPT_URL` en `.env.local`. No usar `/dev`.

## 5. Inicializar los archivos y cuentas

```powershell
npm run setup
```

La inicialización:

- Verifica que la cuenta pueda acceder a ambas carpetas.
- Crea el Sheets del mes actual en BASE DE DATOS.
- Inicializa ProfesorGYM y Administrador con las credenciales acordadas, guardando únicamente hashes scrypt.
- Instala el cálculo de faltas cada 15 minutos y el cambio mensual cada hora.
- Mantiene cerradas las inscripciones hasta confirmar días y formato del carnet desde el panel.

Repetir `setup` no restablece contraseñas ya cambiadas ni vacía un mes listo. Si falla, revisar **Ejecuciones** en Apps Script. No crear un segundo proyecto Script sobre los mismos datos: cada script tendría su propio bloqueo.

## 6. Comprobación local con Google

```powershell
npm run dev
```

Abrir http://localhost:3180. Ingresar con una de las dos cuentas. Ir a **Configuración** y confirmar los días reales y el patrón del código leído de un carnet antes de abrir inscripciones.

`localhost` permite revisar pantallas y usar la cámara de esa computadora. Para probar la cámara del celular usar el despliegue HTTPS.

## 7. Desplegar en Vercel

Importar el proyecto desde un repositorio propio o desplegar esta carpeta con la herramienta oficial de Vercel. Configuración:

- Framework: Vite.
- Build: `npm run build`.
- Output: `dist`.
- Node: 22 o 24.
- Aplicar `vercel.json`; los endpoints privados están en `api/index.js`.

Añadir como variables del servidor, sin prefijo `VITE_`:

```text
APPS_SCRIPT_URL
APPS_SCRIPT_SECRET
SESSION_SECRET
PUBLIC_APP_URL
```

En `PUBLIC_APP_URL`, usar el dominio HTTPS final sin barra final. Reimplementar al cambiar variables.

La raíz del dominio es el acceso del personal. Desde **Códigos QR**, cualquiera de las dos cuentas puede mostrar y descargar los QR fijos de `/registro` y `/asistencia`. No publicar un QR apuntando a localhost: desde un teléfono esa dirección no lleva a esta computadora. El ejemplo `XXXXX.COM` no acredita propiedad ni disponibilidad de un dominio.

Antes de usar un plan gratuito como servicio institucional, comprobar su elegibilidad y cuotas. No se ha contratado ni instalado ningún servicio pagado.

## 8. Pruebas reales antes de abrir al alumnado

1. Escanear un carnet real desde Android y iPhone disponibles; verificar tipo de barcode y código exacto, incluidos ceros iniciales.
2. Inscribir un código una vez; el segundo intento debe rechazarse.
3. Llenar 19 cupos de un bloque en un entorno de prueba y confirmar simultáneamente desde dos teléfonos: solo una inscripción debe tomar el cupo 20.
4. Marcar asistencia válida y repetirla; verificar una sola fila. Probar horario incorrecto y datos manuales diferentes.
5. Generar tres faltas en el periodo de prueba; declarar el cierre de la tercera sesión; verificar dos faltas y reactivación. Reabrir y comprobar el recálculo.
6. Cambiar contraseña desde el panel; abrir otro navegador y comprobar que persiste. No resetear la cuenta mediante propiedades manualmente.
7. Descargar un corte y abrirlo en Excel: comprobar tablas, cifras y gráficos. Comprobar que no cambian los datos operativos.
8. Probar el cambio mensual en un proyecto de prueba. Una exportación fallida debe conservar el periodo anterior; un cierre correcto debe archivar el Excel y abrir un mes vacío.
9. Comprobar en móvil la raíz (login y panel), `/registro` y `/asistencia`, ambos temas y los dos QR finales. Sin sesión, `/qr` debe llevar al login y no mostrar QR; cada página de estudiantes debe permanecer sin navegación al personal ni a la otra acción.

## Operación mensual

- No editar directamente `JSON_INTERNO` ni las hojas técnicas. El panel es el canal de modificación; el Sheet sirve para consulta.
- Faltas: cada 15 minutos; el marcado vuelve a calcular antes de validar el bloqueo.
- Cambio mensual: primer activador horario posterior al cambio de mes, no se garantiza ejecución exacta a las 00:00. Hasta archivar y abrir el nuevo mes, las peticiones operativas rechazan con un mensaje explícito.
- Si falla la exportación, revisar **Ejecuciones**, resolver el permiso/cuota y ejecutar `procesarCambioMensual`. No borrar datos ni modificar `CURRENT_PERIOD` manualmente.
- ARCHIVO 2026 recibe subcarpetas por mes para 2026. Para otros años, el script crea una subcarpeta de año dentro del destino entregado; no cambia permisos ni mueve la carpeta original.
- Solo los archivos TEMP_REPORTE creados por esta app se envían a la papelera al finalizar una exportación. Las hojas operativas y los Excel archivados se conservan.
- Exportaciones superiores a 2,8 MB se guardan en Drive cuando el personal lo elige; se descargan desde allí. La exportación de Google está sujeta a sus límites.

Fuentes de implementación: [Web apps de Apps Script](https://developers.google.com/apps-script/guides/web), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [escritura atómica de Sheets](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate), [servicios avanzados](https://developers.google.com/apps-script/guides/services/advanced), [Vercel Hobby](https://vercel.com/docs/plans/hobby).
