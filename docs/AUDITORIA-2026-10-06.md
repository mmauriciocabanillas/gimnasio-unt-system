# Auditoría general — Gimnasio UNT

Fecha del informe: 6 de octubre de 2026.

## Dictamen

**No está listo para uso real.** La interfaz local funciona y las verificaciones automáticas pasan, pero la conexión Google y el dominio público no están activados. Hay fallos funcionales y controles insuficientes que deben resolverse antes de publicar.

La auditoría no modifica la lógica de la aplicación ni datos reales. Se ejecutaron comprobaciones locales, una compilación y pruebas con datos ficticios. El servidor QA rechaza todas las escrituras. Las reproducciones del dominio y de la API modificaron únicamente objetos ficticios en memoria.

## Entornos y límites

- Aplicación real local: `http://localhost:3180`.
- Interfaz QA temporal: `http://localhost:3181`, cuenta ficticia ProfesorGYM, un alumno de prueba, sin Google y sin escrituras.
- Los escenarios QA fijan el reloj al 5 de octubre de 2026; no representan movimientos reales del día del informe.
- Pantallas públicas revisadas a 320 y 390 px, y en escritorio. Las siete pestañas del panel se revisaron a 320, 390 y 1280 px.
- El ancho del documento coincidió con su ancho útil en todas las mediciones verificadas. La barra de desplazamiento vertical reduce algunos anchos útiles en 15 px. Las tablas y la navegación pueden conservar desplazamiento interno.
- Los permisos de ambas cuentas se comprobaron con pruebas de API y llamadas simuladas. El navegador QA muestra ProfesorGYM; no se presenta como una sesión real de Administrador.
- No se otorgaron permisos de cámara ni se probaron carnets físicos, smartphones reales, Google Sheets real, Drive real, exportaciones reales o un despliegue Vercel.

## Verificaciones automáticas

| Comprobación | Resultado |
| --- | --- |
| `npm run check` | Sintaxis JavaScript y JSON correcta |
| `npm test` | 43 aprobadas, 0 fallidas |
| `npm run build` | Compilación de producción correcta |
| `npm audit --omit=dev --json` | 0 vulnerabilidades reportadas en dependencias de producción |
| Secretos locales en los archivos JavaScript de producción | No se encontraron los valores de SESSION_SECRET ni APPS_SCRIPT_SECRET |

Las 43 pruebas cubren autenticación y sesiones, igualdad de permisos, firma HMAC y nonce, límite de cupos, validación de horarios, duplicados, asistencia manual, faltas, bloqueo, cierres/reaperturas y recuperación mensual. Google está simulado: estas pruebas no acreditan funcionamiento remoto ni concurrencia real.

## Pantallas y flujos revisados

| Pantalla o pestaña | Verificado | Limitación o hallazgo |
| --- | --- | --- |
| Bienvenida | INGRESAR abre `/#ingresar`; Atrás vuelve a bienvenida; fondo azul y sin navegación privada | Sin bloqueo de interfaz observado |
| Login | ProfesorGYM y Administrador; Turno mañana, Turno tarde y Todo el día | Login real depende de Google; sin limitador de intentos en el código |
| Registro | Carnet, datos, 1–3 días; cuarto día rechazado; revisión sin escaneo rechazada; sin enlaces al panel | Cámara y guardado real pendientes; API no acredita lectura física |
| Asistencia pública | Diseño independiente; escaneo/confirmación; entrada manual desplegable; rechazo sin escaneo; recuperación visible de error QA | Guardado real y carnet físico pendientes; no acredita presencia |
| Resumen | Métricas, tablas y tres filtros; escenario QA: mañana tiene 1 falta, tarde 0, todo el día 1 | Conteo incorrecto con cambio futuro; Actualizar oculto en móvil |
| Inscritos | Lista, búsqueda por código/nombre y apertura/cierre del diálogo de horario | Horarios futuros mostrados antes de tiempo; errores detrás del diálogo; búsqueda vacía sin aviso |
| Asistencia y faltas | Tablas y estados vacíos; falta ficticia visible | Integridad de datos reales no comprobada |
| Cierres | Formulario, estados, turnos, acciones rápidas y listado revisados; lógica de cierre/reapertura cubierta por pruebas | No se ejecutó un cierre real ni se modificaron faltas reales |
| Reportes | Alcance y botones; error de exportación QA visible y botón recuperado | Excel, gráficos y archivo en Drive reales pendientes |
| Códigos QR | Dos canvas listos de 280×280; destinos diferentes; botones de descarga habilitados | Destinos localhost; no se acredita acceso desde otro celular ni descarga final con dominio |
| Configuración | Días, patrón, apertura de inscripciones y formulario de contraseña | Persistencia y cambio real de contraseña no ejecutados |
| Rutas privadas y 404 | `/panel` y `/qr` sin sesión no exponen el panel; ruta inexistente muestra 404 y regreso | La protección HTTP completa se prueba con API simulada; nube no activa |

Registro y asistencia mantuvieron cero enlaces y cero menús privados, incluso al abrirlos desde el servidor QA que ofrece una sesión ficticia en la raíz. El fondo público verificado es `rgb(4, 29, 55)`.

## Hallazgos

### B01 — Bloqueante: Google y publicación no activados

Evidencia actual: `APPS_SCRIPT_URL` y `PUBLIC_APP_URL` vacíos; `/api/status` responde 200 con `connected:false` y `publicUrl:""`. `/api/public`, `/api/me` y `/api/panel` responden 503 por falta de conexión.

Los IDs de las dos carpetas están en `apps-script/Code.js:2`, pero eso no configura una implementación Apps Script ni concede permisos de escritura. Esta auditoría no volvió a comprobar los permisos de las carpetas de Drive.

Impacto: no es posible acreditar login, inscripción, asistencia, cierres, configuración, Excel o archivo mensual reales. Los QR locales no sirven para que otros celulares accedan al servidor de esta computadora.

Acción: activar Apps Script y sus servicios/activadores desde la cuenta autorizada; completar la URL `/exec`; inicializar; publicar el dominio HTTPS; probar los flujos reales antes de distribuir los QR.

### F01 — P1: cambios futuros alteran prematuramente el panel y los horarios mostrados

Ubicaciones: `apps-script/Domain.js:42`, `apps-script/Domain.js:162`, `apps-script/Code.js:121`, `apps-script/Code.js:197`, `src/main.js:99`.

Reproducción en memoria: alumno con lunes 08:00; el 5 de octubre a las 07:30 se programa cambiar a miércoles 16:00 desde el 6. Antes de esa fecha, el horario realmente vigente sigue siendo el lunes 08:00 y su cupo ocupado es 1. Sin embargo, el contador de inscritos de mañana devuelve 0, tarde devuelve 1 y los horarios destinados a la lista ya muestran miércoles 16:00.

Causa: se usa `!r.until` como sinónimo de vigente. Eso elige la nueva reserva aunque `from` aún esté en el futuro y descarta la anterior aunque todavía rija.

Impacto: conteos, filtro de inscritos y horarios visibles pueden contradecir las reservas efectivas; la misma selección se reutiliza para filas visibles de Sheets y reportes.

Acción: distinguir reserva efectiva a la fecha de consulta, reserva futura e historial. Mantener la retención de cupos futuros existente. Añadir pruebas específicas para conteos y visualización antes y después de la fecha efectiva.

### R01 — P1, riesgo de integridad: «CARNET» no acredita lectura ni presencia

Ubicaciones: `server/api.mjs:43`, `apps-script/Domain.js:87`, `apps-script/Domain.js:100`.

Reproducción con la API real y dominio simulado: una inscripción y una asistencia enviadas con un código ficticio y `method:'CARNET'` fueron aceptadas con HTTP 200, sin usar cámara. Las restricciones de cupo, horario y mes siguieron aplicándose. No hubo acceso a Google ni registro real.

La interfaz exige escanear, pero el servidor recibe un código y una etiqueta elegidos por el cliente. La firma HMAC protege el tramo servidor–Google; no demuestra que el cliente leyó un carnet. Un QR fijo abre una URL y tampoco prueba que el alumno esté físicamente en el gimnasio. Código más nombre, en la alternativa manual, tampoco es autenticación fuerte.

Acción: definir qué nivel de control exige el gimnasio. Si se requiere presencia o identidad comprobada, añadir validación supervisada o un mecanismo adicional aprobado. No presentar la lectura actual como verificación oficial de matrícula ni como prueba de presencia.

### R02 — P1, riesgo de seguridad: no hay limitación de intentos en el código revisado

Ubicación: `server/api.mjs:52` y rutas públicas de `server/api.mjs:43`.

Reproducción local: cinco contraseñas incorrectas consecutivas devuelven cinco respuestas 401 y generan cinco consultas de cuenta; no aparece un rechazo por exceso de intentos. La revisión de servidor/API no encontró contador, espera progresiva ni respuesta 429. No se inspeccionó una protección externa de infraestructura; no hay despliegue configurado que permita acreditarla.

Impacto: intentos automatizados de contraseña y consumo de llamadas/cuotas de Google cuando se active la conexión. El control de origen no sustituye este límite.

Acción: incorporar limitación persistente de intentos de login y de solicitudes públicas, con mensajes recuperables. Validarlo antes de publicar.

### F02 — P2: errores del diálogo quedan detrás de la ventana

Ubicaciones: `src/main.js:36`, `src/main.js:181`, `src/main.js:189`, `src/main.js:253`.

Reproducción en navegador QA: abrir Cambiar horario y guardar sin seleccionar días. Se genera «Selecciona entre 1 y 3 días.», pero se escribe en el `#feedback` del panel, fuera del diálogo modal. El diálogo permanece abierto y su árbol accesible no incorpora el error. El aviso aparece al cerrar la ventana.

Impacto: el usuario recibe un bloqueo sin un error visible/accesible en la ventana activa. La misma función de mensajes se utiliza en la confirmación de inscripción.

Acción: mostrar y anunciar errores dentro del diálogo activo, sin ocultar la causa de un fallo detrás de él.

### F03 — P2: Actualizar está oculto en móvil y no hay actualización automática

Ubicaciones: `src/template.css:7`, `src/main.js:188` y manejador de pestañas de `src/main.js`.

Reproducción a 390 px: el botón Actualizar existe, pero su estilo calculado es `display:none`. Cambiar de pestaña vuelve a pintar los datos ya cargados; no hace una nueva consulta del panel. El filtro de turno y una recarga del navegador sí consultan de nuevo.

Impacto: un profesor en móvil puede seguir viendo datos antiguos después de nuevas asistencias/inscripciones de otros usuarios, sin la acción de actualización que existe en escritorio.

Acción: conservar una acción visible de actualizar en móvil, o introducir una estrategia explícita de actualización con indicador de antigüedad. No afirmar que el panel es en tiempo real.

### F04 — P2: el indicador «connected» no comprueba la conexión

Ubicaciones: `server/bridge.mjs:6`, `server/api.mjs:39`.

Reproducción local: con una URL inválida y secretos de longitud suficiente, `configured()` devuelve true. La llamada del puente rechaza esa misma configuración con 503. Tampoco se comprueban disponibilidad de Google, inicialización ni permisos de carpetas.

Impacto: una configuración incompleta o incorrecta puede presentarse como conectada aunque los flujos fallen.

Acción: separar «variables configuradas» de «servicio disponible», validar el formato de URL y no presentar el booleano actual como comprobación de salud remota.

### M01 — P3: búsqueda sin coincidencias deja la tabla sin explicación

Ubicación: `src/main.js`, manejador de `student-search`.

Reproducción QA: buscar `NO_EXISTE` oculta la única fila, pero no muestra «Sin coincidencias». La búsqueda por TEST0001 vuelve a mostrarla correctamente.

Acción: añadir un estado vacío específico de búsqueda. No afecta los datos ni los permisos.

## Controles que sí pasan

- Sesión firmada, expiración, cookie HttpOnly/SameSite y revocación por versión de contraseña comprobadas en pruebas.
- Contraseña incorrecta rechazada y campos de actor del cliente sustituidos por la cuenta autenticada.
- ProfesorGYM y Administrador tienen los mismos permisos, según lo acordado. Las acciones de cierre, horario, configuración y exportación se autorizaron para ambos en simulación.
- Código conservado como texto, cupo 20, 1–3 días, una sesión por día, duplicados y horarios Perú cubiertos por pruebas.
- Faltas finalizadas, bloqueo tras tres faltas, cierre/reapertura e historial cubiertos por pruebas.
- Firma/nonce, lock y escrituras agrupadas cubiertos por simulación de Apps Script.
- Exportación parcial no rota el operativo; fallo de exportación mensual conserva el periodo; reintento tras fallo al crear el nuevo mes reutiliza el archivo mensual en el escenario simulado.
- La interfaz no deja la operación bloqueada después de los errores inducidos de asistencia y exportación en QA.

## Pruebas de aceptación pendientes

1. Login/logout y cambio de contraseña reales de ambas cuentas, sin compartir ni registrar sus claves en el informe.
2. Carnet UNT real en Android/iPhone por HTTPS; permisos, enfoque, lectura, cancelación y ausencia de cámara.
3. Registro, asistencia manual/carnet, duplicado, bloqueo y cierres/reaperturas con persistencia real.
4. Solicitudes concurrentes reales al último cupo y comportamiento con lentitud/cuotas/fallos de Google.
5. Descarga y apertura del Excel real: filas, tipos, filtros de turno, gráficos y archivo en la carpeta correcta.
6. Cierre mensual y recuperación real ante fallos. El activador es horario: no se acredita apertura exacta a medianoche y puede haber indisponibilidad mientras el periodo operativo no coincida con el actual.
7. Sesiones vencidas y revocadas en varios dispositivos; protección efectiva contra abuso antes de publicación.
8. QR finales con dominio HTTPS: comprobar que cada uno abre únicamente su pantalla desde otro celular.

## Orden de trabajo recomendado

Primero corregir F01, F02 y F03; añadir las protecciones de R02; aclarar y resolver el nivel de control requerido por R01; corregir F04. Después activar Google/publicación y ejecutar las pruebas de aceptación. M01 puede resolverse como ajuste de usabilidad.

No se aplicaron esas correcciones durante esta auditoría. Las visualizaciones anteriores son vistas previas, no evidencia de guardado ni conexión remota.

## Actualización posterior — activación de Google, 6 de octubre de 2026

Este apartado actualiza B01 sin reemplazar los resultados históricos anteriores.

- La URL `/exec` está configurada en el servidor local y se comprobaron respuestas reales, firmadas con HMAC. No se incluyen secretos en este informe.
- Las carpetas confirmadas ahora son BASE DE DATOS `1S34HRZq7u6pE6fSX3SfxClpOBNh5561f` y ARCHIVO `1Sb7_aVAIRwzgSx0IWK-LIok9tJPG5qqw`. El usuario actualizó la implementación después de cambiar los destinos.
- La inicialización ejecutada por el propietario terminó correctamente para `2026-10`. Archivo operativo: https://docs.google.com/spreadsheets/d/1ntVn5FVDY2E3PfqgpfHKZKFAV16XIr9dqknyeV0DrkE/edit.
- Una comprobación completa contra `localhost:3180` devolvió 200 para el ingreso y el panel de ProfesorGYM y Administrador. Ambos paneles mostraron el mismo archivo, cero alumnos e inscripciones cerradas. No se crearon alumnos ni asistencias de prueba en Google. En consultas posteriores continuaron apareciendo fallos intermitentes de transporte; el resultado de esa comprobación no acredita estabilidad permanente.
- Durante las comprobaciones también se observaron timeouts, un 405 inesperado y un 404 HTML al seguir la URL temporal de ContentService. Se añadió un único reintento para lecturas, con firma/nonce nuevos y presupuesto de tiempo compartido. Las escrituras y exportaciones nunca se reintentan automáticamente. Los últimos resultados 200 no garantizan ausencia de futuras interrupciones externas.
- El panel ya no hace una consulta duplicada de cuenta: Apps Script comprueba la versión de la sesión dentro de la consulta firmada del panel. Pruebas nuevas verifican que se conserva la revocación de sesiones.
- Verificación local actual: `npm run check`, `npm test` (54 aprobadas) y `npm run build` correctos. Las pruebas automáticas de Google siguen siendo simuladas; las respuestas HTTP indicadas arriba sí proceden del servicio real.
- El usuario confirmó apertura de lunes a viernes, tarde de 15:00 a 20:00 y códigos solo numéricos. Después de actualizar Domain.gs y publicar una nueva versión, una consulta firmada real del panel verificó días `[1,2,3,4,5]`, los cinco bloques de tarde (15:00–16:00 a 19:00–20:00), patrón `^[0-9]{1,40}$` e inscripciones cerradas. La longitud exacta del carnet sigue pendiente; 40 es un límite técnico provisional, no el formato oficial UNT. Se conservan los ceros iniciales.
- PUBLIC_APP_URL continúa vacío: no hay dominio HTTPS verificado ni QR final accesible desde teléfonos externos. Inscripciones permanecen cerradas.

No se dan por corregidos F01, F02, F03, R01, R02, F04 ni M01. Persisten las pruebas de cámara/carnet, escrituras reales, Excel, concurrencia y cambio mensual. El sistema no queda aprobado para uso del alumnado por haber activado Google.
