# Límites de Gimnasio UNT

Investigación: 6 de octubre de 2026. Fuentes oficiales consultadas y código local `2026-10-06-flow-3` inspeccionado. No se modificó la aplicación, contraseñas, alumnos, activadores ni despliegues.

## 1. Conclusión y alcance

El pico indicado de 4–10 asistencias por minuto está por debajo de la cuota estándar de Sheets considerando las llamadas explícitas actuales. Eso no garantiza tiempos de respuesta: las escrituras comparten un bloqueo, existen plazos de espera y otros accesos consumen recursos.

No existe un único «máximo de alumnos» impuesto por Google. Hay límites independientes de solicitudes, ejecución, almacenamiento y tamaño. Vercel también tiene cuotas mensuales: «no hay límite mensual» no describe correctamente todo el sistema.

No se verificaron el plan contratado de Vercel, sus contadores Usage, la capacidad disponible de Drive ni las cuotas particulares del proyecto de Google Cloud. No hay evidencia, en lo revisado, de que una cuota agotada explique actualmente la lentitud.

## 2. Qué servicios intervienen

Recorrido: navegador → API de Vercel → Apps Script → Sheets/Drive.

- Sheets contiene la base operativa mensual.
- Drive conserva libros y archivos XLSX.
- Apps Script valida, reserva cupos, registra asistencias y ejecuta tareas programadas.
- Vercel sirve la interfaz y transmite solicitudes firmadas.
- GitHub guarda el código y participa en los despliegues, no en cada asistencia.
- Los QR se generan localmente; el lector usa `@zxing/browser`. No hay un servicio de QR que cobre por escaneo.
- No se encontró una base SQL, Redis, Vercel Blob ni envío de correos en el recorrido actual. Tener Gmail añadido a Apps Script no implica consumir cuotas de correo.

La implementación mostrada por el usuario ejecuta como su propietario: no se multiplican cuotas por cada alumno que escanea. [Permisos de aplicaciones web](https://developers.google.com/apps-script/guides/web#permissions).

## 3. Google Sheets API

| Métrica estándar | Usuario/proyecto/minuto | Proyecto/minuto |
| --- | ---: | ---: |
| Lecturas | 60 | 300 |
| Escrituras | 60 | 300 |

Lecturas y escrituras tienen contadores separados. Una petición por lotes cuenta como una solicitud, no como una por celda. No hay otro cupo diario de solicitudes si se respetan las cuotas por minuto. Google recomienda cargas de hasta 2 MB; no lo presenta como un límite duro. El procesamiento de una petición tiene un máximo de 180 segundos. Los excesos generan errores y requieren espera; las cuotas efectivas pueden diferir entre proyectos. [Límites oficiales de Sheets](https://developers.google.com/workspace/sheets/api/limits).

Medición reproducida en el simulador local, con el código actual:

| Acción | Lecturas API explícitas | Escrituras API explícitas | Operaciones de propiedades |
| --- | ---: | ---: | ---: |
| Consultar cupos públicos | 1 | 0 | 7 |
| Consultar panel | 1 | 0 | 6 |
| Registro nuevo | 2 | 1 | 7 |
| Asistencia nueva | 2 | 1 | 7 |
| Asistencia duplicada | 1 | 0 | 7 |

Dos lecturas = `Values.batchGet` + lectura de metadatos previa al guardado; una escritura = `Spreadsheets.batchUpdate`. Son llamadas instrumentadas, no contadores medidos en Google Cloud ni todas las operaciones internas de `SpreadsheetApp`.

| Asistencias nuevas/minuto | Lecturas calculadas | Escrituras calculadas | Margen teórico de lecturas hasta 60 |
| --- | ---: | ---: | ---: |
| 4 | 8 | 4 | 52 |
| 10 | 20 | 10 | 40 |
| 20 | 40 | 20 | 20 |
| 30 | 60 | 30 | 0 |

No tomar 30/minuto como capacidad garantizada. Cupos públicos, panel, tareas programadas, errores/reintentos y otros usos de la cuenta también intervienen.

## 4. Apps Script

| Recurso | Cuenta personal | Workspace |
| --- | ---: | ---: |
| Leer/escribir propiedades | 50.000/día | 500.000/día |
| Tiempo total de activadores | 90 min/día | 6 h/día |
| `UrlFetchApp` | 20.000/día | 100.000/día |
| Hojas de cálculo creadas | 250/día | 3.200/día |
| Duración de ejecución | 6 min | 6 min |
| Ejecuciones simultáneas por usuario | 30 | 30 |
| Ejecuciones simultáneas por script | 1.000 | 1.000 |
| Activadores por usuario/script | 20 | 20 |
| Propiedad individual / almacén | 9 KB / 500 KB | Igual |
| Versiones por script | 200 | 200 |

Las cuotas diarias se restablecen 24 horas después de la primera solicitud; no necesariamente a medianoche. Las cuotas son compartidas con otros scripts del propietario. [Cuotas oficiales](https://developers.google.com/apps-script/guides/services/quotas).

Aplicación al código:

- Una solicitud recibida desde Vercel NO equivale a una llamada `UrlFetchApp`. Esta última se usa aquí para exportar XLSX.
- Cada exportación crea un libro temporal. Generar muchos informes consume la cuota de creación aunque luego se manden a la papelera.
- Las propiedades contienen configuración, cuentas, identificadores mensuales y protección de frecuencia; no la tabla completa de alumnos. No se vio una política de limpieza de los identificadores históricos ni de propiedades de las pruebas aisladas.
- 180 asistencias × 7 operaciones instrumentadas = 1.260 operaciones de propiedades. No es el consumo diario total.
- Las 30 ejecuciones concurrentes incluyen solicitudes en espera: NO significan 30 asistencias por minuto.
- Subir archivos de código no es publicar una nueva versión de aplicación web. El límite de versiones afecta al mantenimiento, no a cada asistencia.

## 5. Automatizaciones y cambio de mes

El instalador configura faltas cada 15 minutos (96 ejecuciones/día) y revisión mensual cada hora (24/día), también de noche y fines de semana. Las capturas aportadas muestran ejecuciones completadas; no constituyen una medición de todo un día.

Ejemplo, no medición: si cada revisión de faltas durase 4 s y cada comprobación mensual sin cierre 1 s, consumirían unos 6,8 minutos diarios. Un cierre, otros scripts y aumentos de duración se suman. Con 96 revisiones, 56,25 s de promedio ya consumirían 90 minutos, incluso sin los demás activadores.

Los activadores temporales no ofrecen una ejecución exacta a medianoche. [Comportamiento oficial](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers).

En nuestro código:

- Mientras `CURRENT_PERIOD` no coincida con el mes actual, las operaciones del mes devuelven cierre pendiente.
- El siguiente activador horario intenta avanzar; no se garantiza apertura instantánea el día 1.
- Se recupera un mes atrasado por ejecución. Varios meses pendientes necesitan varias ejecuciones.
- El cierre mantiene el bloqueo durante el trabajo. Solicitudes concurrentes pueden agotar la espera.
- La prueba aislada de Google aportada por el usuario confirmó un XLSX, recuperación del fallo de marcador y mes nuevo vacío. No elimina cuotas, fallos de permisos o cortes futuros.

## 6. Google Drive, espacio y exportación

Una cuenta personal sin ampliaciones dispone de hasta 15 GB compartidos entre Drive, Gmail y Photos. Al agotarse, se bloquea la creación/subida de archivos; no hay una reserva independiente para el gimnasio. No se midió espacio disponible. [Almacenamiento oficial](https://support.google.com/drive/answer/6374270).

La documentación actual indica hasta 20 millones de celdas o 100 MB para hojas creadas o convertidas a Sheets; no son 20 millones de alumnos. [Tamaño de archivos](https://support.google.com/drive/answer/37603). Esta cifra no demuestra que una aplicación sea rápida cerca de ese tamaño.

`files.export`, el método usado para obtener XLSX, limita el contenido exportado a 10 MB. Guardarlo posteriormente en Drive no evita ese límite previo. [Exportación oficial](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export).

El código envía el libro temporal a la papelera al finalizar el informe. Los archivos en papelera siguen consumiendo almacenamiento hasta eliminarse definitivamente; normalmente permanecen 30 días. Los archivos QA conservados también ocupan espacio. No se eliminó ninguno en esta investigación. [Papelera de Drive](https://support.google.com/docs/answer/14933051).

### Cuotas de la API de Drive: cambio de 2026

Desde mayo de 2026 el esquema nuevo usa unidades, no un número uniforme de solicitudes:

| Métrica | Esquema nuevo publicado |
| --- | ---: |
| Unidades/minuto/proyecto | 1.000.000 |
| Unidades/minuto/usuario/proyecto | 325.000 |
| Umbral diario de unidades antes de cargos | 400.000.000 |
| Umbral diario de datos salientes antes de cargos | 1 TB |

Ejemplos: obtener metadatos 5 unidades, listar 100, editar 50. Proyectos con uso entre noviembre de 2025 y abril de 2026 conservan cuotas anteriores. No se verificó a qué esquema pertenece el proyecto del gimnasio. Google anuncia detalles de facturación posteriormente en 2026, con aviso previo; estos umbrales no prueban un cobro activo en tu cuenta. Puede haber controles adicionales de frecuencia. [Cuotas actuales de Drive](https://developers.google.com/workspace/drive/api/guides/limits).

## 7. Vercel

No se confirmó tu plan. Si es Hobby, la documentación vigente incluye:

| Recurso | Incluido mensual |
| --- | ---: |
| Invocaciones de funciones | 1.000.000 |
| Solicitudes CDN | 1.000.000 |
| Transferencia al usuario | 100 GB |
| Transferencia entre CDN y cómputo | 10 GB |
| CPU activa | 4 horas |
| Memoria aprovisionada | 360 GB-hora |

Hobby permite 100 despliegues diarios; superar cuotas puede suspender recursos hasta su restablecimiento. Son asignaciones del plan, no recursos reservados exclusivamente para este proyecto. [Plan Hobby](https://vercel.com/docs/plans/hobby).

Hobby exige uso personal no comercial. Un sistema institucional no debe darse por compatible automáticamente; verificar la clasificación, especialmente si hay servicio pagado o trabajo remunerado. No afirmo que este proyecto infrinja las condiciones. [Uso permitido](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage).

Las funciones admiten cuerpos de petición/respuesta de hasta 4,5 MB. Con Fluid Compute, Hobby permite hasta 300 s; sin Fluid, las configuraciones heredadas difieren. La app fija su propio máximo de 60 s, aunque el plan permita más. Hobby tiene 2 GB de memoria por instancia. Esperar a Google no es CPU activa, pero interviene en memoria aprovisionada; tampoco se debe sumar duración por solicitud como consumo exacto cuando instancias comparten concurrencia. [Límites de funciones](https://vercel.com/docs/functions/limitations).

El panel devuelve las listas completas del mes. Paginar visualmente el historial no pagina la respuesta de la API: datos abundantes pueden alcanzar el límite de respuesta o resultar lentos antes de agotar las celdas de Sheets. No se midió el tamaño del panel real de producción en esta investigación.

Se ejecutó nuevamente `monthlyScenario()` en memoria local: 120 alumnos ficticios, 223 reservas y 789 asistencias; panel JSON de 249.337 bytes (aproximadamente 244 KiB). El recorrido completo, incluidos verificaciones, errores, informes y cambio de mes, hizo 1.379 lecturas por lotes, 1.006 lecturas de metadatos y 1.006 escrituras. Estos son totales del escenario, NO solicitudes por minuto ni contadores de Google. Las 4 exportaciones del simulador no miden el tamaño de un XLSX real. No hubo conexiones a Google ni uso de credenciales reales.

## 8. Límites impuestos por nuestra aplicación

Verificados en `server/api.mjs`, `server/bridge.mjs`, `server/auth.mjs`, `src/main.js`, `apps-script/Code.js` y `Domain.js`:

| Control | Valor actual |
| --- | --- |
| Solicitud JSON aceptada por el servidor | 16.000 bytes |
| Espera para adquirir bloqueo de Apps Script | 25 s |
| Intento HTTP ordinario hacia Google | Hasta 30 s |
| Presupuesto compartido de conexión por solicitud web | 50 s, también exportaciones |
| Duración configurada de función Vercel | 60 s |
| Espera del navegador | 65 s |
| Sesión de personal | 8 horas |
| Descarga XLSX dentro de JSON | Hasta 2.800.000 bytes de XLSX |
| Firma: antigüedad/tolerancia temporal | 120 s |
| Nonce: retención solicitada en caché | 240 s |

El puente tiene por defecto 55 s para exportaciones/inicialización cuando se llama directamente. La API web lo sustituye por su presupuesto de 50 s: no prometer 55 s al usuario de la web.

Al pasar 2,8 MB, el informe manual necesita «Guardar copia en Drive» para responder con enlace. Base64 aumenta el tamaño aproximadamente un tercio; por eso el límite local es menor que los 4,5 MB de Vercel.

Protecciones de frecuencia por IP pública y acción (no por alumno):

| Acción | Máximo por ventana |
| --- | ---: |
| Intentos de acceso | 12 / 10 min |
| Registros | 60 / 10 min |
| Consultas de cupos | 120 / min |
| Intentos de asistencia | 120 / min |

Usuarios conectados al mismo Wi-Fi pueden compartir IP y contador. También cuentan intentos inválidos. El almacenamiento se divide en 16 grupos, cada uno admite hasta 80 identidades/acciones vigentes; la distribución desigual puede rechazar una IP antes de alcanzar la suma global. No es una cuota de Google.

Se reintentan algunas lecturas ante fallos de transporte, hasta dos intentos dentro del presupuesto. No hay reintento exponencial general de errores de cuota. Las escrituras no se repiten automáticamente: un timeout no prueba que Google no guardó; verificar antes de reenviar.

El caché de Google permite 1.000 entradas y puede expulsarlas antes del plazo solicitado. La protección contra reutilización de nonce depende de ese caché, no de un registro durable. No equivale a un límite de alumnos. [CacheService](https://developers.google.com/apps-script/reference/cache/cache).

## 9. Capacidad del gimnasio frente a capacidad informática

Configuración del código: lunes–viernes, 9 bloques diarios de una hora (08–12 y 15–20), 20 cupos por bloque, 1–3 días por alumno y bloqueo desde 3 faltas.

Cálculos con horarios estables y todos los días/bloques habilitados:

- 180 plazas de sesiones por día.
- 900 plazas de reservas semanales.
- Si todos toman 3 días: 300 alumnos con reservas semanales completas; si todos toman 1: hasta 900. No son límites informáticos ni del historial.
- Octubre de 2026 tiene 22 días lunes–viernes: 3.960 plazas de sesiones antes de descontar cierres.

Cambios de horarios y conservación de historiales alteran la cantidad de filas; no usar estas cifras como límites duros de registros acumulados.

Diez llegadas repartidas durante un minuto no equivalen a diez solicitudes al mismo instante. Ejemplo ilustrativo: con escrituras de 4 s, algunas de diez solicitudes simultáneas podrían superar los 25 s esperando el bloqueo, aun con cuotas de Sheets disponibles. No es una medición de concurrencia real en Google.

## 10. GitHub, dispositivos y límites no aplicables

GitHub advierte sobre archivos superiores a 50 MiB y bloquea superiores a 100 MiB en Git normal. Recomienda repositorios pequeños, idealmente menos de 1 GB; 5 GB no debe confundirse con una asignación garantizada. Esto afecta subidas/despliegues, no el contador de asistencia. [Archivos grandes en GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

En el código actual, generar un QR no guarda un archivo en Drive. La cámara se procesa en el navegador, con permisos y compatibilidad del dispositivo; no hay evidencia de que se suban fotos del carnet a Google. No funciona como una app independiente sin Internet para guardar asistencias.

No corresponden aquí las cuotas de Google Forms, AppSheet, APIs de IA o MCP de Drive/Sheets: no forman parte del recorrido de la aplicación. Comprar Google One amplía espacio; no debe suponerse que convierte una cuenta personal en Workspace o amplía automáticamente sus cuotas de Apps Script.

## 11. Qué revisar antes de afirmar capacidad garantizada

1. Vercel → equipo → Usage y Billing: plan real, Fluid Compute, consumo y otros proyectos compartidos.
2. Google Cloud → APIs y servicios → Sheets/Drive → cuotas: valores efectivos y uso del proyecto asociado al script.
3. Drive → Almacenamiento: espacio total y libre, papelera, copias y carpetas QA. Revisar sin eliminar datos.
4. Apps Script → Ejecuciones: errores y duración agregada de tareas durante varios días; especialmente el día 1.
5. Medir latencia por tramo, espera de bloqueo, bytes del panel/XLSX y picos reales. Separar demora de red de procesamiento de Google.

Prioridades propuestas, no implementadas: observabilidad, alarmas con margen sobre cuotas, paginación real del panel y tratamiento controlado de errores de frecuencia. No aumentar límites ni repetir escrituras a ciegas.

**Diagnóstico final:** el volumen indicado no demuestra necesidad inmediata de cambiar de plataforma. Los riesgos verificables están en tiempos/bloqueo, crecimiento de respuestas e informes, almacenamiento acumulado y cuotas del plan real. Ninguna de estas cifras permite declarar el sistema infalible o ilimitado.
