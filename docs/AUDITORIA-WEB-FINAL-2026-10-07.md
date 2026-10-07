# Auditoría de la web actual — 7 de octubre de 2026

## Correcciones de esta revisión

1. QR: los enlaces y los códigos usan el mismo origen público HTTPS. En desarrollo apuntan a `https://gimnasiount.vercel.app`, nunca a localhost. Se elimina la nota sobre desarrollo y publicación. Se respeta un dominio HTTPS válido configurado mediante PUBLIC_APP_URL.
2. Asistencia: deja de forzar la paleta azul antigua. Comparte colores, campos, botones y tipografía del tema general; tiene botón claro/oscuro. Cambiar el tema conserva los datos escritos y mantiene el botón de confirmación desactivado hasta leer un carnet válido.
3. Recuperación del acceso: se reprodujo una sesión válida seguida de fallo al consultar el panel. Antes dejaba al usuario en el login. Ahora muestra Reintentar y Cerrar sesión, sin pedir otra vez la contraseña. Se descartan datos y consultas de la sesión anterior; una consulta inicial tardía no restaura la cuenta después de cambiar de sesión.

## Navegador: flujo real con servicios Google simulados

Se usó la web y la API originales, Apps Script ejecutado en un entorno de prueba y almacenamiento exclusivamente en memoria. No se cargó `.env.local` ni se modificó Google real. El servidor temporal no guardó ni reemplazó snapshots anteriores.

| Recorrido | Resultado observado |
|---|---|
| Las siete secciones del panel | Abren sin alertas ni errores de renderizado |
| Profesor y Administrador | Ambos entran; clave incorrecta rechazada |
| Abrir inscripciones desde configuración | Estado guardado y registro habilitado |
| Registro por lector virtual | Lectura, datos, tres días, revisión y confirmación completos |
| Máximo tres días | Al elegir tres, las opciones de los otros días quedan deshabilitadas |
| Asistencia manual, nombre incorrecto | Rechazada |
| Asistencia manual válida | Guardada |
| Repetir asistencia | Mensaje de duplicado; permaneció una sola asistencia |
| Día sin reserva | Rechazado |
| Cierre del turno | Cierre guardado; asistencia rechazada por gimnasio cerrado |
| Cambio futuro de horario | Guardado desde mañana; historial vigente conservado y cambio pendiente visible |
| Búsqueda sin coincidencias | Mensaje correcto sin filas ajenas |
| Descargar reporte | Descarga iniciada; no rota el mes |
| Guardar copia de reporte | Acción de archivo completada en el Drive simulado |
| Fallo de consulta tras login | Reintentar recupera el panel sin nuevo login |
| Cierre mensual ficticio | Octubre cerrado, noviembre abierto, panel nuevo sin alumnos/asistencias/faltas |
| QR registro y asistencia | Dos destinos distintos, ambos en el dominio público |
| Asistencia claro/oscuro a 390 px | Colores reales cambiados y sin desbordamiento horizontal |

El archivo descargado en esta prueba contenía solamente los dos bytes del mock de Google, no era un Excel real. Se comprobó el evento de descarga, no la apertura de ese archivo en Excel; el archivo ficticio recién creado se eliminó de Downloads. Las pruebas de exportación, almacenamiento y recuperación cubren por separado la lógica del reporte y del cierre.

## Verificación automática

- 139 pruebas aprobadas, cero fallidas: autenticación, revocación, API, registro, horarios, asistencia, aforo 20, tres faltas, cierres, concurrencia, simulación de un mes con 120 alumnos, archivos mensuales y recuperación de errores.
- `npm run build`, `npm run check` y `git diff --check`: correctos.
- El resultado de producción `dist` no contiene las claves QA, el lector virtual, el control QA ni el texto eliminado de los QR.
- No se alteraron contraseñas ni datos reales en esta auditoría.

## Evidencia visual

- `diseno/interfaz-implementada/qr-dominio-publico-limpio.jpg`
- `diseno/interfaz-implementada/asistencia-clara-actualizada.jpg`
- `diseno/interfaz-implementada/asistencia-oscura-actualizada.jpg`

## Límites de la conclusión

Esta auditoría verifica la nueva versión local y los casos listados. No garantiza ausencia absoluta de errores ni disponibilidad de red, Google o Vercel. No se reprobó una cámara física y no se ejecutó un cierre mensual sobre producción. El despliegue publicado todavía no incluye estos cambios de interfaz: falta publicarlos y hacer la comprobación final en el dominio real.
