# Verificación de simultaneidad y cierre mensual — 6 de octubre de 2026

## Resultado y alcance

La versión publicada de Google quedó confirmada como `2026-10-06-flow-2`. Se ejecutaron solicitudes paralelas contra producción sin cambiar datos operativos. Se probaron altas, asistencias y cierres con hilos independientes en un entorno aislado. Se reprodujo y corrigió un fallo que duplicaba el Excel mensual al perder su marcador. **La corrección nueva requiere publicar Código.gs con revisión `2026-10-06-flow-3`.** Domain.gs no cambió en esta entrega.

No se cambiaron contraseñas reales, no se habilitaron inscripciones, no se inscribieron alumnos ficticios en Google y no se adelantó octubre a noviembre en producción. El usuario informó que ya probó carnets físicos; se registra como comprobación suya, no como una lectura física hecha por el agente.

## Simultaneidad: no son llamadas secuenciales

Cada cliente usa un worker Node independiente (hilo, no proceso separado del sistema operativo), una instancia independiente de la API y del código original de Apps Script. Todos esperan una barrera y comienzan juntos. Comparten almacenamiento y un mutex real con Atomics. Se observaron solicitudes solapadas y esperas por lock; solo una sección crítica estuvo activa cada vez.

Google Sheets, Drive y LockService siguen simulados. Esto comprueba el código bajo ejecución concurrente, **no certifica la concurrencia del servicio Google ni sus cuotas/tiempos reales**. Se conservó el aforo de 20 y se verificó que cada respuesta de éxito tenía su registro persistido, sin pérdida de escrituras.

| Caso | Clientes simultáneos | Resultado |
|---|---:|---|
| Último cupo con 19 inscritos | 24 | Uno aceptado, 23 rechazados; terminan 20, conservando los anteriores |
| Asistencia de 20 alumnos + 4 reenvíos | 24 | 20 filas únicas, cuatro respuestas de duplicado; cero filas perdidas |
| Reenviar una asistencia existente | 24 | 24 duplicados informados; cero filas nuevas |
| Ocho cierres mensuales | 8 | Un archivo final, un libro de noviembre, noviembre vacío y cuentas intactas |
| Bloque vacío | 24 | 20 inscritos y cuatro rechazos; ningún éxito perdido |
| Mismo código de inscripción | 24 | Un alta y 23 rechazos; una sola reserva |
| Cuatro cierres junto a formularios antiguos | 12 | Un cierre efectivo; ocho formularios rechazados; noviembre vacío |
| Login desde una misma red ficticia | 24 | 12 ingresos y 12 respuestas 429; limitador persistente respetado |

[Evidencia por escenario](simulacion/concurrencia-2026-10-06.json). Tiempos de workers (centenas de milisegundos) no equivalen a latencia de Google. Ejecutar `npm run simulate:concurrency`; no carga `.env.local` ni abre red.

## Comprobación real de la web publicada

- Login y panel (antes/después): HTTP 200, revisión `flow-2`.
- Cuatro consultas públicas lanzadas juntas: cuatro HTTP 200; conjunto completado en 3.726 ms.
- Cuatro asistencias ficticias lanzadas juntas con códigos válidos e inexistentes: cuatro HTTP 404 «No estás inscrito en este mes»; conjunto en 5.427 ms. Verificación previa de que esos códigos no pertenecían a alumnos.
- Datos operativos antes y después idénticos: periodo, alumnos, asistencias, faltas, cierres y configuración.
- Inscripciones actualmente cerradas. No se abrieron para contaminar la base con alumnos ficticios.

[Registro remoto](simulacion/concurrencia-remota-2026-10-06.json). Son muestras puntuales, no percentiles ni prueba de carga sostenida. Estas solicitudes acreditan consultas/rechazos concurrentes en Google real, no reservas aceptadas compitiendo por el último cupo.

## Cierre mensual y recuperación

Se comprobaron:

1. No cierra cinco horas antes: 04:59:59 UTC todavía es octubre en Lima; desde 05:00 UTC se puede ejecutar el cierre de noviembre. El activador horario puede ejecutarlo después, no se promete ejecución exacta a medianoche.
2. Exportación HTTP 503: conserva octubre y sus alumnos; limpia su temporal; recuperación posterior válida.
3. Fallo de acceso a Drive antes de crear el archivo: no activa el mes siguiente; reintento deja una sola copia final.
4. Fallo de escritura al crear noviembre: conserva octubre y el archivo final; repara el mismo libro parcial y no exporta otra copia.
5. Meses omitidos: los recupera de uno en uno, sin saltar archivos ni cambiar cuentas.
6. Fallo del marcador después de crear el Excel: recupera su identificador y no crea otra copia ni vuelve a exportar.
7. Upload completado con respuesta perdida y comprobación temporalmente caída: el reintento recupera el archivo existente.
8. Comprobación caída y respuesta 409 por ID ya usado: mantiene octubre; al recuperarse la lectura completa el cierre sin duplicado.
9. Fallo al guardar el ID reservado: no crea el archivo final ni cambia el periodo.
10. Archivo reservado vacío, sin tamaño, de otro periodo/tipo o en papelera: no lo declara válido ni activa noviembre.

En todos los casos de cierre se verificaron las cuentas sin resetear contraseñas. Los fallos se inyectaron localmente, no sobre Google real.

## Fallo encontrado y corregido con autorización del usuario

Antes, el sistema creaba el Excel y después guardaba `ARCHIVED_<mes>`. Al fallar ese segundo paso, el reintento creaba un segundo archivo con el mismo nombre. El defecto se reprodujo: dos archivos, aunque las cuentas y el operativo se conservaran.

[Comparación reproducible antes/después](simulacion/archivo-mensual-antes-despues.json): fuente del commit `9971254` frente a la corrección actual, mismo fallo inyectado, dos copias frente a una y dos exportaciones frente a una. Ejecutar `node scripts/verify-archive-retry.mjs` desde un checkout con ese historial Git.

Ahora reserva un ID con Drive v3 y guarda `ARCHIVE_PENDING_ID_<mes>` **antes** de crear el archivo. Cada reintento usa ese mismo ID. El archivo incluye etiquetas privadas de tipo/periodo y se comprueba su formato, tamaño y estado antes de darlo por archivado. Si no puede comprobarlo, mantiene el periodo pendiente. Los reportes manuales conservan su comportamiento; la corrección se aplica al archivo mensual definitivo.

La propiedad pendiente se conserva para recuperación, sin borrar archivos ni propiedades anteriores. Archivos huérfanos creados por versiones viejas no se identifican ni eliminan automáticamente.

Mecanismo basado en [IDs pre-generados de Google Drive](https://developers.google.com/workspace/drive/api/guides/create-file): reutilizar un ID de archivo creado provoca 409 y evita crear un duplicado. Se usa [Drive.Files.create con blob](https://developers.google.com/apps-script/advanced/drive), servicio v3 ya declarado en el manifiesto y con los mismos permisos Drive existentes. El XLSX es un archivo binario, no una conversión a Google Sheets.

## Verificación y entrega

Pruebas nuevas: un escenario integrado de ocho carreras concurrentes, diez pruebas de recuperación mensual y cuatro de diagnóstico privado. Ejecución final: **93 pruebas aprobadas, cero fallidas**; `npm run check`, `npm run build` y comprobación de diferencias sin errores. La prueba de reintento del puente también cubre el diagnóstico de activadores.

Para activar **esta corrección adicional**:

1. Reemplazar TODO Código.gs con [apps-script/Code.js](../apps-script/Code.js). Domain.gs ya actualizado no necesita cambios.
2. Guardar y publicar Nueva versión en la implementación existente. No inicializar, no editar cuentas ni cambiar la URL `/exec`.
3. Confirmar `/api/public`: revisión `2026-10-06-flow-3`. Drive API v3 debe seguir en Servicios, como ya aparece en el proyecto.

## Lo que aún no se certifica

No se pudo inspeccionar la lista real de activadores: Opera devolvió navegador desconectado. Se revisaron las conexiones alternativas disponibles; no se encontró un conector específico que acreditara los activadores de Apps Script. La búsqueda de conexiones siguió la skill plugin-management; no se instalaron integraciones ni se ampliaron permisos.

Se añadió `GET /api/automation`, privado y solo de lectura, para no depender del navegador. Requiere una sesión vigente de profesor/administrador, verificada por Apps Script; no devuelve hashes, no toca Sheets ni instala/modifica activadores. Indica si faltan o sobran activadores CLOCK de ambas funciones y si el periodo está pendiente. Disponible tras desplegar Vercel **y** Código.gs `flow-3`; repetir `node scripts/audit-concurrency-live.mjs --automation` después de publicar Google.

La API de [Trigger](https://developers.google.com/apps-script/reference/script/trigger) permite comprobar función y tipo, no la frecuencia exacta ni el éxito de ejecuciones. El diagnóstico declara explícitamente `frequencyVerified=false` y `executionVerified=false`: existencia de un activador no prueba ejecución correcta del cierre.

Queda pendiente la aceptación del activador horario, del archivo final corregido y de escrituras simultáneas exitosas **en un entorno Google de prueba** o durante la operación real controlada. No se simuló un cierre real alterando el periodo de producción. No se declara infalibilidad.
