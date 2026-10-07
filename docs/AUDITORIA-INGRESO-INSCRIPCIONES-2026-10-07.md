# Corrección de ingreso e inscripciones — 7 de octubre de 2026

## Diagnóstico confirmado

- La web mostraba «Reintentar» durante una consulta normal, antes de que existiera un fallo.
- La versión publicada de Google devolvió revisión `2026-10-06-flow-3`, inscripciones desactivadas y formato `^[0-9]{1,40}$`. La versión histórica del dominio exige `input.codePattern` al configurar; el formulario nuevo había dejado de enviarlo.
- El ingreso anterior necesitaba dos viajes consecutivos a Apps Script: cuenta y panel. Las consultas reales presentaron respuestas variables y errores de transporte. No era únicamente una demora de dibujo de la interfaz.

## Cambios implementados

1. La API vuelve a enviar el formato fijo de diez dígitos al guardar configuración, incluso si el cliente envía otro patrón. Se mantiene oculto y no editable.
2. El nuevo Apps Script prepara cuenta y panel en una misma solicitud firmada. La API solo entrega el panel después de verificar la contraseña; una contraseña incorrecta no recibe datos ni cookie.
3. Si falla la lectura del mes, una contraseña válida conserva su sesión y permite reintentar. Durante una carga normal se muestra la navegación y un estado de carga, no una falsa pantalla de error.
4. El cliente acepta el panel entregado por el login sin pedirlo nuevamente. Sigue siendo compatible con Apps Script anterior mediante una segunda consulta cuando no existe el panel incluido.
5. Se corrige una carrera del registro de solicitudes: una consulta antigua no puede borrar una consulta nueva del mismo destino.
6. Inscripciones abiertas por defecto. El cierre manual se respeta y permanece disponible. La validación de 20 cupos sigue siendo obligatoria con el interruptor activado.

## Cambio real en Google

Se guardó y verificó la configuración real: inscripciones activas, código de diez dígitos, aforo 20 y bloqueo por 3 faltas. Se conservaron los días existentes. No se cambiaron contraseñas, horarios ni datos de alumnos; el guardado de configuración genera su entrada de auditoría normal.

## Verificación

- 146 pruebas aprobadas, ninguna fallida. Incluyen carga lenta, fallo y recuperación, autenticación, compatibilidad del guardado, capacidad, cierre manual y simulación mensual.
- El nuevo ingreso completo en Google simulado usa una invocación, una lectura por lote y cero escrituras. Esto no representa el tiempo de Google real.
- Navegador con almacenamiento aislado: ingreso directo al resumen, cierre y reapertura del interruptor, guardado correcto, las siete secciones sin alertas, fallo de consulta y recuperación sin otra contraseña.
- Build, revisión de sintaxis y `git diff --check` correctos.
- Evidencia: `diseno/interfaz-implementada/configuracion-inscripciones-corregida.jpg`.

## Velocidad: mediciones reales anteriores a la nueva publicación

- Una consulta de cuenta correcta: 3,850 segundos.
- Otra consulta de cuenta terminó en timeout a los 34,129 segundos.
- Una secuencia cuenta + panel completó en 17,694 segundos.
- Una lectura pública completó en 20,045 segundos; guardar la configuración tomó 7,933 segundos.

Son observaciones puntuales desde este equipo, con variabilidad y posibles reintentos, no promedios ni una garantía de tiempo. Reducir viajes elimina una espera redundante, pero no elimina la dependencia de Google ni sus fallos de red.

## Publicación pendiente

La configuración real ya está corregida; el nuevo código de ingreso todavía no está publicado.

- Actualizar `Domain.gs` con `apps-script/Domain.js`.
- Actualizar `Código.gs` con `apps-script/Code.js`.
- Guardar y publicar una nueva versión en la implementación existente de Apps Script, manteniendo la URL `/exec`.
- Si se conserva el verificador manual, actualizar también `PruebaCierre.gs` con `apps-script/PruebaCierre.js`; sigue comprobando literalmente las funciones de cierre y el aislamiento de producción.
- Subir los cambios de esta revisión a GitHub y desplegar en Vercel. Después medir el ingreso en el dominio público; no confundir las pruebas locales con ese despliegue.

No se hizo commit, push ni un despliegue remoto en esta revisión.
