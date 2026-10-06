# Auditoría integral y optimización — 6 de octubre de 2026

## Dictamen

La lógica y el mes completo pasan en un entorno aislado. No se certifica todavía estabilidad ni funcionamiento completo de producción: se midieron demoras y un timeout reales de Google, y las correcciones de Apps Script requieren actualizar su implementación. No se cambiaron contraseñas reales, inscripciones, asistencias, cierres, periodos ni archivos de alumnos en Google.

Dominio existente: https://gimnasiount.vercel.app. Arquitectura conservada: Vite/Node/Vercel → Apps Script → Sheets/Drive. No se contrató ningún servicio.

## Evidencia de producción antes de optimizar

| Petición | Resultado | Tiempo de una muestra |
|---|---|---:|
| GET /api/status | 200, variables configuradas; PUBLIC_APP_URL vacío | 973 ms |
| GET /api/public | 200 | 10.448 ms |
| POST /api/login | 504, Google no respondió | 50.790 ms |
| GET /api/panel sin sesión | 401 | 790 ms |

El ingreso de ambas cuentas había dado 200 en comprobaciones anteriores. La muestra posterior demuestra intermitencia, no contraseñas necesariamente incorrectas. Una muestra no es una mediana ni un percentil de rendimiento.

## Causas y cambios aplicados al código

| Flujo | Antes | Después de desplegar ambos componentes |
|---|---|---|
| Bienvenida/login sin sesión | Se consultaban horarios públicos antes de comprobar sesión | No consulta Google; status y panel sin sesión se resuelven sin leer Sheets |
| Recuperar sesión | public → me → panel, en cadena | Una consulta de panel con identidad autenticada |
| Asistencia pública | Esperaba una lectura de todas las hojas para habilitar los botones | No consulta horarios; al marcar, el servidor valida mes, horario, alumno, cierre y bloqueo |
| Filtro de turno | Una nueva consulta a Google | Los tres resúmenes llegan juntos; cambio local inmediato |
| Cierre/cambio de horario | account.get + mutación + panel | Una mutación autorizada que devuelve el panel actualizado |
| Configuración | account.get + configure + public + panel | Una operación con panel actualizado |
| Lectura del mes | Varias llamadas por cada hoja | Un batchGet; consulta pública exclusivamente HORARIOS, panel cinco tablas |
| Guardado | Reescribía todas las tablas y consultaba metadata por hoja | Solo filas/tablas cambiadas; un get de metadata y un batchUpdate atómico |
| Asistencia duplicada | Volvía a guardar todo | Devuelve el resultado sin escritura nueva |
| Guardado sin cambios | Escritura y flush redundantes | Cero peticiones de metadata/escritura |
| Lock | Lecturas lentas bloqueaban login y operaciones | Verificación/limitador breves; mutaciones conservan todo el ciclo bajo lock |
| Historial | Todas las filas renderizadas | 100 filas por página, sin consultas al pasar de página |
| Logo | PNG 1.162.478 bytes | WebP 882.908 bytes; mismos 1.254×1.254 píxeles RGBA, comprobados exactamente; PNG conservado |
| Runtime/install | Node sin límite de major y esbuild sin decisión válida | Node 24.x y pnpm 10.28.0; esbuild permitido explícitamente |

No se cachean hashes ni sesiones para aparentar rapidez. Cada operación privada conserva la revocación por versión. No se reintentan automáticamente escrituras ni exportaciones con resultado ambiguo. La mejora del número de llamadas es comprobada en código/pruebas; no se presenta como un porcentaje de velocidad real sin medir la nueva implementación de Google.

Comparación reproducible con node scripts/benchmark-storage.mjs contra adeff29: una asistencia tras 120 inscripciones y cálculo previo de faltas envía 4.520 celdas antes y 94 después (98% menos), en ambos casos una escritura atómica y exactamente los mismos estudiantes/asistencias/faltas persistidos. Sin cálculo previo, la misma muestra envió 4.520 frente a 2.313 celdas (49% menos), porque también debían actualizarse las faltas acumuladas. Son tamaños de peticiones locales, no tiempos remotos.

## Hallazgos funcionales corregidos

- F01: horarios futuros ya no sustituyen prematuramente los vigentes. Se muestran por separado; los cupos futuros siguen reservados.
- F02: errores dentro del diálogo activo, con role=alert y visibilidad comprobada.
- F03: Actualizar visible a 390 px; fecha de última consulta explícita. No se promete tiempo real.
- F04: formato /exec validado; status distingue configured de health=not_checked. Una configuración válida no acredita salud remota.
- M01: búsqueda sin resultados muestra Sin coincidencias.
- F05 nuevo: selector no ofrecía 19:00–20:00 pese a existir en Google; corregido.
- F06 nuevo: los gráficos de la hoja operativa omitían el último bloque y el turno tarde; rangos corregidos y reparación idempotente de los tres gráficos propios, sin borrar gráficos ajenos.
- Confirmación de escritura separada de la actualización de vista: si el cambio ya se guardó y falla la lectura posterior, se informa que el guardado ocurrió y no se induce a repetirlo.
- Registro conserva los campos y la cámara al terminar la carga asíncrona de cupos.

## Seguridad

Firma HMAC, nonce, origen, cookies HttpOnly/SameSite/Secure en HTTPS, caducidad y versión revocable comprobados. Ambas cuentas mantienen los mismos permisos. Los campos actor/version y la identidad del limitador los determina el servidor, no el alumnado. Valores de secretos locales no encontrados en fuentes ni build.

Se añadió un límite persistente en propiedades de Apps Script, protegido por lock, identificado por un HMAC de la IP; no se guarda IP en claro. Por identidad: 12 consultas de login/10 minutos, 60 registros/10 minutos, 120 marcados/minuto y 120 consultas públicas/minuto. Devuelve 429 y permite nuevos intentos al vencer la ventana. No es un WAF ni protección completa contra ataques distribuidos; la limitación se activa solo al desplegar el nuevo servidor y Code.gs. Mantiene compatibilidad con el servidor anterior durante la actualización.

Riesgos no resueltos automáticamente:

- R01: el campo CARNET y un QR fijo no prueban presencia ni identidad oficial. Código + nombre tampoco es autenticación fuerte. Requiere una decisión del gimnasio sobre supervisión/control; no se cambió el flujo autorizado.
- Las contraseñas iniciales conocidas/publicadas deben cambiarse desde Configuración antes de operación real. No se resetearon cuentas.
- Longitud oficial y simbología del carnet pendientes; los ocho dígitos de la simulación son ficticios, no un formato UNT confirmado.
- Elegibilidad institucional/cuotas del alojamiento gratuito no certificadas; ningún plan pagado activado.

## Simulación reproducible

Ejecutar npm run simulate:month. No carga .env.local ni hace peticiones de red. Usa handleApi real, Code.js real y Domain.js real con servicios Google en memoria y un reloj controlado en America/Lima.

120 alumnos ficticios, 223 reservas incluyendo historial, 789 asistencias, 41 faltas contabilizadas, 11 bloqueados y 95% de asistencia sobre 830 sesiones finalizadas aplicables. Tres cortes por turno/total y un reporte definitivo; noviembre vacío. El cambio de contraseña revoca la cookie anterior y persiste tras el cambio mensual. Detalle y datos: [RESULTADO-MENSUAL.md](simulacion/RESULTADO-MENSUAL.md), [JSON completo](simulacion/octubre-2026-datos-ficticios.json).

Se comprobaron rechazo de duplicados, aforo, horarios, códigos inválidos, ausencia de sesión, asistencia manual, cierre total/turno, tres faltas, reactivación retroactiva, reapertura, cambio futuro, exportación sin reinicio, recuperación de fallos mensuales, versión revocada antes de leer Sheets, logout y limpieza de temporales propios.

## Verificación de interfaz

Navegador local aislado, sin Google: Resumen, Inscritos (120 filas ficticias), Asistencia y faltas (100/789 filas por página), Cierres, Reportes, dos QR y Configuración. Búsqueda sin resultados; error dentro del diálogo; filtro tarde; actualización móvil; paginación. Cero errores de consola observados. Registro y asistencia a 390/360 px, fondo rgb(4,29,55), sin menú privado ni desbordamiento horizontal observado. El selector incluye 19–20. Ambos QR se dibujan en canvas de 280 px y tienen destinos distintos. No se leyó un carnet físico.

## Verificaciones automáticas

- npm test: 71 aprobadas, 0 fallidas.
- npm run check: sintaxis JavaScript y JSON correcta.
- npm run build: correcto; scanner y QR siguen siendo imports bajo demanda.
- npm audit --omit=dev --json: 0 vulnerabilidades reportadas.
- Prueba exacta RGBA del PNG y WebP: mismos píxeles.
- .env.local sigue excluido. La eliminación preexistente de .env.example no se incorporó a los cambios de esta tarea.

## Activar las mejoras de Google

1. Sustituir TODO Código.gs por [apps-script/Code.js](../apps-script/Code.js), y TODO Domain.gs por [apps-script/Domain.js](../apps-script/Domain.js). No añadir un segundo helper ni un segundo proyecto.
2. Guardar. Ejecutar una vez actualizarGraficosDesdeEditor para reparar los gráficos ya existentes. No inicializar de nuevo ni editar las propiedades de cuentas/mes.
3. Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar. Conservar la implementación /exec existente, propietario y permisos.
4. Publicar los archivos de la web en el mismo repositorio/rama; Vercel necesita el nuevo despliegue. PUBLIC_APP_URL recomendado: https://gimnasiount.vercel.app, sin barra final. Con el campo vacío, los QR usan correctamente el origen de la página, pero no se fija una URL canónica.
5. Verificar /api/public: revision debe ser 2026-10-06-performance-1. Medir nuevamente login/panel/guardado después de ambos despliegues.

## Aceptación remota todavía pendiente

Cámara/carnet físico Android/iPhone; persistencia real de registro/asistencia/cierres; dos clientes simultáneos al último cupo; archivo XLSX real y apertura en Excel; activadores reales y cierre mensual ante errores; límites/NAT con la red del gimnasio; tiempos repetidos de la nueva implementación. El XLSX de la simulación tiene servicio/binario ficticios: se validaron sus tablas y gráficos, no un archivo Excel real.

## Entrega y comprobación posterior

Cambios publicados en GitHub, rama main, commit ac64d2a. Vercel ya devuelve el cliente index-CtXMPNV0.js y la API nueva (configured=true, health=not_checked); PUBLIC_APP_URL ya coincide con https://gimnasiount.vercel.app.

Una lectura pública posterior respondió 200 en 10.997 ms, periodo 2026-10, sin revision. Por tanto, Google todavía no devuelve la revisión 2026-10-06-performance-1. La lentitud de Google sigue observada; falta actualizar/publicar Apps Script y volver a medir. No se declara resuelto el rendimiento de producción.

## Fuentes técnicas

[Buenas prácticas de Apps Script](https://developers.google.com/apps-script/guides/support/best-practices), [batchGet de Sheets](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet), [batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate), [versiones Node en Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [allowBuilds de pnpm](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md), [cabeceras de Vercel](https://vercel.com/docs/headers/request-headers).
