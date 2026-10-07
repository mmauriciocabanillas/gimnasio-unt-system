# Cierre mensual en Google sin alterar producción

Estado: el usuario ejecutó la prueba en Google el 6 de octubre de 2026. Pasó las comprobaciones previas al ZIP (cierre, ID reutilizado, una sola exportación y un único Excel), pero abortó en la inspección del XLSX: `Invalid argument: ContentType. Should be of type: application/zip`. Se corrigió únicamente PruebaCierre.js para normalizar el Blob en memoria a ZIP. **La verificación completa en Google queda pendiente de repetir la ejecución con esa línea corregida.** No se modificó Código.gs, Domain.gs ni el XLSX ya guardado.

La simulación local original del ZIP era demasiado permisiva y no detectó esa precondición; ahora exige application/zip y reproduce el error original. Opera sigue sin conexión y la revisión de conexiones mediante plugin-management no encontró un ejecutor de Apps Script conectado.

Si PruebaCierre.gs ya está añadido, basta reemplazar `Utilities.unzip(archive.getBlob())` por `Utilities.unzip(archive.getBlob().setContentType('application/zip'))`, guardar y ejecutar otra vez. La nueva ejecución crea otra carpeta QA independiente; no borra la anterior.

## Ejecutar una vez desde el editor

1. En el proyecto Gimnasio UNT, Archivos → **+ → Secuencia de comandos**; nombre: **PruebaCierre**.
2. Sustituir el contenido de ese archivo NUEVO con todo [PruebaCierre.js](../apps-script/PruebaCierre.js). No reemplazar Código.gs ni Domain.gs.
3. Guardar, seleccionar **verificarCierreMensualAislado** en el selector superior y pulsar **Ejecutar**. No requiere implementar otra versión.
4. Compartir el resultado del Registro de ejecución. Solo registra resumen y enlaces a archivos ficticios, nunca contraseñas o hashes.

## Qué comprueba

- Usa copias literales de funciones de Código.gs flow-3 con dependencias aisladas; comprueba que coinciden con el código vigente antes de crear archivos. No cambia las funciones/globales originales.
- Crea una carpeta independiente PRUEBA_CIERRE_GIMNASIO_UNT con BASE_DE_PRUEBA y ARCHIVO_DE_PRUEBA.
- Usa el mes anterior como ejemplo (septiembre → octubre si se ejecuta el 6 de octubre de 2026), sin modificar CURRENT_PERIOD de producción.
- Registra dos alumnos ficticios de 10 dígitos, una asistencia y un cierre ficticio; calcula faltas del mes completo.
- Exporta un XLSX a Drive real; provoca una sola vez el fallo del marcador después de crear el Excel y reintenta.
- Comprueba un único Excel/una exportación, reutilización del ID, historial preservado y siguiente mes vacío.
- Abre el XLSX como ZIP y verifica sus hojas y códigos ficticios. [Utilities.unzip](https://developers.google.com/apps-script/reference/utilities/utilities#unzipblob) permite inspeccionar su contenido. Antes cambia el tipo del Blob en memoria mediante [Blob.setContentType](https://developers.google.com/apps-script/reference/base/blob#setContentType(String)); no modifica el archivo de Drive ni lo convierte en otro documento.
- Comprueba que cuentas, periodo/configuración de producción, identificadores del mes real y lista de activadores permanecen iguales.

Las propiedades QA tienen un prefijo aleatorio; todas las claves permitidas se validan. Los accesos a libros/archivos se restringen a IDs creados por esta ejecución. No inicializa cuentas ni instala activadores. Usa un lock de usuario distinto del lock de producción. Se conservan los archivos y las propiedades QA para inspección; no se borran datos reales ni los archivos de prueba. El exportador original envía a papelera únicamente su libro temporal recién creado, igual que en la operación normal.

La función usa declaraciones JavaScript normales (sin eval ni constructor dinámico); no ejecuta instrucciones recibidas de la web ni habilita un endpoint público.

Resultado esperado: `ok:true`, `archiveCopies:1`, `exportCount:1`, `markerFailureRecovered:true`, `xlsxOpened:true`, `newMonthEmpty:true`, `productionUnchanged:true`, `passwordChanges:0`, `triggerConfigurationUnchanged:true`.

Un error real de Sheets/Drive/ZIP aborta la prueba y no fabrica un resultado de éxito. Se muestra el enlace a su carpeta incompleta para diagnóstico. Un timeout también puede dejar archivos QA incompletos; no modifica el operativo real.

## Evidencia local y límite

`node --test tests/monthly-google-probe.test.mjs`: cinco casos (aislamiento exitoso, exportación fallida, bloqueo de apertura de un libro real a través de una propiedad QA alterada, rechazo previo a cualquier escritura cuando el código vigente difiere y regresión del MIME que falló en Google). Son pruebas del aislamiento/control, **no** evidencia de ejecución en Google ni de un ZIP real: Google y el ZIP son simulados en esta suite local.

Las capturas del usuario ya prueban ejecuciones automáticas completadas de ambas funciones y un intervalo observado de 15 minutos en procesarFaltas. Esta prueba manual aislada acredita la rama efectiva del cierre con servicios reales si su resultado termina correctamente, pero no cambia la frecuencia de los activadores ni prueba que el próximo cierre programado se completará bajo cualquier fallo/cuota.
