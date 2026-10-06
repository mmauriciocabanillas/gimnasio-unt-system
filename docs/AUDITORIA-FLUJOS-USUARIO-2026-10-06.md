# Auditoría de flujos como usuario — 6 de octubre de 2026

## Dictamen

Se ejecutaron acciones reales en los formularios del navegador con datos ficticios: ingreso, inscripción, asistencia, gestión del personal y cambio mensual. Se corrigieron seis defectos adicionales. Las 78 pruebas automáticas pasan. **Esto no certifica todos los casos posibles ni la operación completa de producción.** Cámara y Google se sustituyeron por simuladores en el recorrido con escrituras; la comprobación remota fue separada y no añadió alumnos ficticios.

Proyecto único: `Gimnasio unt`. Web existente: https://gimnasiount.vercel.app. La revisión de Google observada fue `2026-10-06-performance-1`; el código corregido de esta entrega es `2026-10-06-flow-2`. No se cambiaron contraseñas, inscripciones, asistencias, cierres, configuración ni periodo reales. La descarga remota genera un reporte temporal, sin guardar una copia permanente en Drive.

## Cómo se separaron las pruebas

| Capa | Ejecución | Qué acredita / qué no |
|---|---|---|
| Navegador con escrituras | Interfaz original, API Node original, Code.js y Domain.js originales; reloj controlado y servicios Google/cámara en memoria | Formularios, navegación, mensajes, autorizaciones y reglas integradas; no acredita lectura física ni persistencia remota |
| Mes de 120 alumnos | Solicitudes a la API y trabajos mensuales originales en el simulador de Google | Reglas y estados de octubre/noviembre con volumen; no 120 inscripciones manuales por navegador ni concurrencia real |
| Producción | Consultas, login del administrador, descarga XLSX y logout | Conexión actual y Excel real vacío; no operación remota con alumnos ni activador mensual real |

La skill computer-use guio el recorrido y las comprobaciones visibles; spreadsheets guio la importación, inspección estructural y renderizado del XLSX descargado. No se abrió el archivo en Microsoft Excel nativo.

## Recorrido ejecutado en la interfaz

| Etapa / pantalla | Acción y resultado observado |
|---|---|
| Bienvenida y login | INGRESAR abre la segunda pantalla; contraseña incorrecta rechazada; administrador y profesor ingresan; logout vuelve al acceso |
| Configuración | Se habilitaron inscripciones ficticias de lunes a viernes; quitar un día con alumnos fue rechazado sin aplicar el cambio |
| Registro cerrado / rutas | Mensaje de inscripciones cerradas y botón inactivo; `/registro/` y `/asistencia/` funcionan tras corregir la normalización |
| Registro y revisión | Tres alumnos inscritos desde el formulario; sin carnet no permite continuar; cuarto día rechazado; revisión muestra alumno/código/horarios; Corregir vuelve al formulario |
| Registro duplicado / disponibilidad | Segundo registro del mismo código rechazado dentro del diálogo; cupos se actualizan después del alta sin borrar campos pendientes |
| Cámara virtual | Lectura simulada alimenta el formulario; permiso denegado muestra instrucciones y oculta correctamente el botón de cerrar cámara |
| Asistencia por carnet | Marca válida aceptada; repetirla devuelve duplicado y no crea otra fila; alumno inexistente y fuera de horario rechazados |
| Asistencia manual | Código + nombre incorrecto rechazado; coincidencia con normalización de acentos/espacios aceptada; alumno bloqueado rechazado |
| Resumen e inscritos | Métricas reflejan las acciones; búsqueda por código encuentra al alumno; búsqueda inexistente muestra Sin coincidencias; filtro tarde excluye alumnos solo de mañana |
| Asistencias y faltas | Historial muestra las filas del turno elegido; tres faltas bloquean; no se confunde asistencia duplicada con una segunda asistencia |
| Cierres | Cierre retroactivo de mañana elimina la falta afectada y reactiva un alumno de tres a dos faltas; el registro se observó en la API y en el panel actualizado |
| Cambio de horario | Sin días rechaza dentro del diálogo; cambio futuro conserva horario vigente y muestra pendiente; al llegar la fecha aparece el nuevo horario y se acepta su asistencia |
| Reportes | Guardar copia por turno devuelve éxito y enlace ficticio; las tablas construidas se verifican en el simulador; descarga real se comprobó separadamente |
| Dos QR | Dos canvas de 280 px con destinos distintos: `/registro` y `/asistencia`; cada página pública carece de menú privado y de acceso a la otra acción |
| Fallo de red / consulta | Se inyectó un 503 del panel: mensaje visible; Actualizar recuperó la vista sin repetir una mutación |
| Fin de mes | Octubre terminó con datos y bloqueos; el trabajo mensual original archivó el reporte ficticio y abrió noviembre vacío |
| Formulario antiguo | Confirmar un registro de octubre después de abrir noviembre devuelve 409 y no inscribe al alumno en noviembre |
| Nueva inscripción mensual | Alumno bloqueado en octubre pudo inscribirse de nuevo en noviembre: activo y cero faltas |
| Móvil | Registro a viewport 390 px y asistencia a 360 px: sin desbordamiento horizontal observado, fondo azul `rgb(4,29,55)`, sin menú privado; noviembre limita cierres al día 30 |

Límite de automatización: el aviso nativo de confirmación de cierre bloqueó una pestaña del navegador. Se observó posteriormente la operación aceptada y su resultado desde otra pestaña; **no se acredita que el agente aceptara el aviso**, ni el recorrido UI de cancelar/reabrir ese aviso. La lógica de reapertura se comprobó por API en el entorno aislado. Cambio de contraseña/revocación se comprobó por API aislada, no cambiando credenciales reales mediante la interfaz.

## Ejemplo pequeño ejecutado con formularios

Los códigos son ficticios, no carnets institucionales validados.

| Alumno | Código | Horario inicial | Casos recorridos |
|---|---|---|---|
| Lucía | 00000101 | Lunes 08, miércoles 15, viernes 19 | Alta, duplicado, carnet, cambio futuro a miércoles 19, asistencia nueva y horario anterior rechazado |
| Diego | 00000102 | Lunes/miércoles/viernes 09 | Tres faltas, bloqueo, reactivación por cierre, bloqueo posterior y nueva inscripción en noviembre |
| Ana | 00000103 | Lunes/miércoles 15, viernes 19 | Nombre incorrecto, asistencia manual correcta, horario no iniciado y bloqueo |

Corte ficticio del 30 de octubre: **3 inscritos, 5 asistencias, 9 faltas contabilizadas, 3 bloqueados y 36% de asistencia** sobre las 14 sesiones aplicables finalizadas. No son los datos reales del gimnasio ni se deben confundir con la simulación masiva.

Evidencia: [estado y cronología de octubre](simulacion/flujo-interactivo-octubre-2026.json), [continuación de noviembre](simulacion/flujo-interactivo-qa.json), [captura móvil del panel](simulacion/panel-movil-qa.jpg).

## Mes de ejemplo completo por API

**120 inscritos · 223 reservas con historial · 789 asistencias · 41 faltas contabilizadas · 11 bloqueados · 95% de asistencia.** Tres cortes y un archivo definitivo simulados; noviembre empieza con cero alumnos. Se incluyen aforo de 20, duplicados, códigos inválidos, cierres/reaperturas, horarios, sesiones revocadas y reintentos de archivo mensual.

Datos reproducibles: [resultado mensual](simulacion/RESULTADO-MENSUAL.md), [JSON completo con estudiantes y cronología](simulacion/octubre-2026-datos-ficticios.json). Ejecutar `npm run simulate:month`; no lee `.env.local` ni hace peticiones de red. Las solicitudes al último cupo son secuenciales bajo lock simulado: no sustituyen dos clientes simultáneos contra Google.

[Captura del panel del mes completo](simulacion/panel-mes-ejemplo-qa.jpg). La vista de solo lectura en http://localhost:3181 permite revisar sus siete secciones; los botones de escritura no operan contra Google.

## Fallos nuevos corregidos

| Defecto reproducido / revisado | Corrección |
|---|---|
| Barra final mostraba formulario de registro pero no cargaba horarios; asistencia quedaba inactiva | Misma normalización de ruta en renderizado, carga y habilitación |
| Registro confirmado dejaba cupos visuales anteriores | Recarga de disponibilidad y aplicación a la cuadrícula |
| Cámara denegada dejaba un botón Cerrar cámara sin cámara | Se ocultan ambos controles al fallar |
| Formulario de octubre podía inscribir silenciosamente en noviembre | El formulario envía el periodo revisado; API lo conserva; Domain rechaza periodo diferente antes de escribir |
| Cierres usaban día 31 incluso en noviembre/febrero | Último día UTC correcto; pruebas para 28, 29, 30 y 31 días |
| Último día permitía abrir cambio de horario que solo podría empezar fuera del mes | Se informa que debe elegir horarios al inscribirse en el siguiente mes; validación del límite por helper/prueba, no recorrido UI específico del último día |

Además, errores internos inesperados de Apps Script dejan nombre y marcos de stack en Ejecuciones, sin copiar payload, contraseñas ni mensaje interno a la respuesta pública. Validación de texto con aspecto de fórmula comprobada: Sheets guarda `stringValue`, no `formulaValue`; exportación conserva texto literal.

## Comprobación real de Google y rendimiento

| Operación remota | HTTP | Tiempo de una muestra |
|---|---:|---:|
| Horarios públicos | 200 | 5.242 ms |
| Login administrador | 200 | 2.170 ms |
| Panel inicial | 200 | 2.136 ms |
| Descargar XLSX | 200 | 12.382 ms |
| Panel posterior | 200 | 1.642 ms |

Estado antes/después igual: periodo `2026-10`, cero alumnos, cero asistencias, misma configuración y cierres. [Registro remoto sin datos sensibles](simulacion/verificacion-remota.json).

El XLSX real de 18.734 bytes se importó y renderizó: siete hojas (ANÁLISIS, REGISTRADOS, ASISTENCIAS, FALTAS, CIERRES, HORARIOS y GRÁFICOS), tres gráficos, último bloque 19–20 y ambos turnos presentes, sin errores de fórmula encontrados. Los valores son cero porque producción estaba vacía. El binario y sus previews se excluyen de Git para evitar publicar futuros datos personales.

La exportación sigue siendo lenta; las lecturas todavía cuestan segundos. Estas muestras no son mediana/p95 ni una prueba de carga. El ahorro de llamadas/celdas de la optimización anterior está documentado en la [auditoría integral](AUDITORIA-INTEGRAL-2026-10-06.md); **no se inventa un porcentaje de rapidez ni se declara eliminación de la latencia de Apps Script**.

## Verificación y pendientes de aceptación

- `npm test`: 78 aprobadas, cero fallidas.
- `npm run check` y `npm run build`: correctos.
- `npm audit --omit=dev --json`: cero vulnerabilidades reportadas; no es una auditoría de seguridad externa.
- Cero errores de consola observados en la pestaña de recorrido recuperada; no certifica ausencia universal de errores.
- `.env.local` excluido; la eliminación preexistente de `.env.example` pertenece al usuario y no se incorpora a esta tarea.

Pendiente antes de certificar operación real:

1. Cambiar las contraseñas iniciales conocidas desde Configuración. Las credenciales iniciales todavía permitieron el login remoto de prueba; no se cambiaron automáticamente.
2. Probar un carnet físico y permisos de cámara en Android/iPhone HTTPS. El código oficial solo se confirmó como numérico, no su longitud ni simbología.
3. Acordar supervisión/identidad: QR fijo + código/nombre no prueban presencia ni matrícula UNT.
4. Prueba controlada de escritura y persistencia en Google, cierres/reapertura y dos clientes simultáneos al último cupo. No contaminar producción con el JSON ficticio.
5. Verificar activadores reales y archivo definitivo al cambiar el mes; probar recuperación ante error de Drive, con un entorno Google de prueba autorizado.
6. Medir tiempos repetidos y carga en la red del gimnasio; abrir el XLSX en Excel nativo con datos de prueba si se requiere esa aceptación.

## Activar las correcciones

La carpeta local contiene el código corregido. La auditoría por sí sola no equivale a un despliegue.

1. Publicar los cambios de la web en el mismo repositorio/rama y esperar el despliegue correcto de Vercel.
2. Reemplazar **todo** Código.gs por [Code.js](../apps-script/Code.js) y **todo** Domain.gs por [Domain.js](../apps-script/Domain.js). Guardar ambos.
3. Implementar → Administrar implementaciones → lápiz → Nueva versión → Implementar. Conservar la URL `/exec`, cuenta ejecutora y acceso existentes.
4. Revisar `/api/public`: `revision` debe ser `2026-10-06-flow-2`. No ejecutar la inicialización ni borrar propiedades/cuentas/archivos.

Prueba interactiva local: `npm run qa:flow`, aplicación http://localhost:3182 y controles http://localhost:3182/__qa. Solo datos ficticios en memoria, cámara virtual y contraseñas QA explícitas; no es el servicio de producción.
