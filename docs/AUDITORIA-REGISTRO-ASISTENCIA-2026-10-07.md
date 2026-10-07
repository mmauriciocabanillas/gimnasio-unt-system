# Auditoría de registro, horarios y asistencia — 7 de octubre de 2026

## Resultado

127 pruebas aprobadas, cero fallidas. `npm run build`, `npm run check` y `git diff --check` correctos. Verificación sobre código local, con Google simulado y datos ficticios; no sobre la implementación remota publicada.

## Correcciones

- Se elimina la fecha decorativa al final del registro. El periodo interno sigue enviado al servidor para impedir una inscripción contra un mes anterior. No se elimina la fecha necesaria para aplicar cambios de horario.
- Registro admite blanco/oscuro con el botón del encabezado. Cambiar el tema no vuelve a renderizar el formulario y conserva los datos y las selecciones.
- Registro y cambio de horario comparten el límite inmediato de tres días. Los horarios de días no elegidos quedan bloqueados al llegar a tres; quitar un día los libera. Los horarios llenos nunca se habilitan por quitar un día.
- Cambio de horario muestra cupos, precarga reservas actuales y permite conservar el cupo propio incluso si el bloque está lleno. No libera cupos de otras personas. La fecha de aplicación se limita al mes operativo, desde mañana.
- Si un cupo se acaba después de cargar el registro, el servidor rechaza la confirmación y la interfaz vuelve a consultar los cupos, conservando los datos escritos.
- Lectura de carnet rechaza formatos distintos de diez dígitos. Confirmar asistencia por escaneo requiere una lectura válida. Asistencia manual también exige diez dígitos en el formulario.

La pantalla de la queja permitía elegir cinco días en el diálogo de cambio; no demostraba una inscripción guardada de cinco días. El servidor ya rechazaba ese guardado. Se corrige el control inmediato de la interfaz sin debilitar esa validación.

## Casos comprobados

| Caso | Resultado |
| --- | --- |
| Asistencia en día no reservado | Rechazada, sin añadir registros |
| Antes de la hora, otro turno o al terminar la hora | Rechazada, sin añadir registros |
| Alumno con tres faltas | Rechazada, sin añadir registros |
| Cierre del turno reservado o cierre del día completo | Rechazada, sin añadir registros |
| Cierre solo de mañana y reserva por la tarde | Asistencia permitida |
| Llegada dentro del horario reservado | Asistencia permitida |
| Repetir llegada válida | No crea una segunda asistencia |
| Inscripción o cambio con cuatro o cinco días | Rechazado, sin guardar reservas |
| Inscripción 21 en el mismo día y horario | Rechazada por aforo 20 |
| Cambio hacia un bloque ocupado por 20 alumnos | Rechazado |
| Conservar una reserva propia en un bloque completo | Permitido, sin sumar otro cupo |
| Competencia simultánea por último cupo | Solo un candidato obtiene el cupo |
| Mes completo y cierre mensual | Pruebas preexistentes pasan con 120 alumnos ficticios |

Los casos de asistencia se ejecutaron por API tanto con método CARNET como MANUAL, pasando por la API del servidor y solicitudes firmadas de Apps Script. En los rechazos se verificó que el estado operativo persistido no cambiaba y que las cuentas conservaban sus valores. Las pruebas de concurrencia y cierre mensual siguen dentro de la suite completa.

## Navegador

- Registro claro y oscuro a 390 px, sin desbordamiento horizontal. Se confirma el cambio real de colores, los tres días elegidos y la conservación del texto escrito.
- Cambio de horario precarga tres días y bloquea los otros dos. Quitar uno permite elegir otro, manteniendo el máximo de tres.
- Inscripción ficticia completa con lector virtual: lectura, datos, tres días, revisión y confirmación correctas.
- No se utilizó cámara física ni se modificaron alumnos, cuentas o contraseñas reales.

Capturas: [registro claro](diseno/interfaz-implementada/registro-claro-final.jpg), [registro oscuro](diseno/interfaz-implementada/registro-oscuro-final.jpg), [cambio de horario](diseno/interfaz-implementada/cambio-horario-limite-final.jpg), [inscripción confirmada](diseno/interfaz-implementada/registro-confirmado-final.jpg).

## Entrega y límites

Cambios locales implementados. No se ha hecho commit, push, despliegue Vercel ni actualización de Google en esta entrega. Para producción se deben publicar los cambios web y la versión vigente de `apps-script/Domain.js` como `Domain.gs` en la implementación existente. Las pruebas no garantizan disponibilidad de Google, red, cámara o Vercel, ni vuelven infalible al sistema.
