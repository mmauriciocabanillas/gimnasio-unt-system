# Contexto para Codex — Gimnasio UNT
Fecha de consolidación: 5 de octubre de 2026

Este archivo reúne los requisitos y las decisiones finales de la conversación disponible. No es una transcripción literal. Las correcciones finales prevalecen sobre las propuestas anteriores.

## Instrucción para Codex
Usa este archivo como contexto para desarrollar el sistema cuando el usuario indique comenzar. Conserva las reglas acordadas. No cambies la arquitectura, no reduzcas funciones ni agregues servicios pagados por iniciativa propia. Separa las decisiones confirmadas de los detalles aún pendientes y explica cualquier limitación técnica real antes de prometer una solución. Este archivo por sí solo no implica que las cuentas externas, Google Sheets, Apps Script o Vercel ya estén configurados.

## 1. Objetivo
Crear una app web móvil para la inscripción mensual de estudiantes de la Universidad Nacional de Trujillo (UNT) en su gimnasio, el control de cupos, la asistencia, las faltas y los reportes.

Los estudiantes no tendrán cuentas ni login. El personal tendrá un panel interno. Los datos operativos estarán en Google Sheets y los reportes mensuales se archivarán en Google Drive.

La web se desplegará en Vercel. El costo buscado es S/0, utilizando opciones gratuitas y evitando infraestructura pagada. Este es un objetivo del proyecto, no una garantía de cuotas ilimitadas o de elegibilidad institucional en cualquier plan gratuito.

## 2. Decisiones finales que reemplazan propuestas anteriores

- Vercel reemplaza la propuesta inicial de Firebase Hosting.
- Habrá dos usuarios distintos: ProfesorGYM y Administrador.
- Ambos usuarios tendrán exactamente los mismos permisos y verán el mismo panel. Se descarta la propuesta de restringir al profesor a su turno o de darle un dashboard más limitado.
- Los dos profesores compartirán la cuenta ProfesorGYM. No se crearán cuentas individuales para cada profesor.
- Al iniciar sesión se podrá elegir turno mañana o tarde. El panel también deberá permitir consultar el conjunto del gimnasio, porque ambos usuarios ven lo mismo.
- Se incluye un apartado sencillo para cambiar la contraseña.
- La interfaz será blanca/clara por defecto, con un botón para cambiar a modo oscuro.
- Se conservarán el logo proporcionado y sus colores: azul oscuro, amarillo/dorado y blanco.

## 3. Reglas generales de inscripción

- El servicio es para estudiantes UNT.
- Cada mes requiere una nueva inscripción.
- Datos: código de estudiante, nombres, apellidos, facultad, carrera/escuela y ciclo de estudios.
- En la inscripción el código UNT se obtiene obligatoriamente escaneando el código de barras del carnet. No se permite escribirlo manualmente en ese formulario.
- El alumno elige 1, 2 o 3 días de asistencia por semana. Nunca 0 ni más de 3.
- Para cada día elegido selecciona una sola sesión de una hora.
- Máximo una sesión por día y tres días por semana.
- Los horarios elegidos quedan fijos durante ese mes.
- Un mismo código no puede inscribirse dos veces en el mismo mes.
- Antes de guardar se muestra una pantalla de confirmación con datos y horarios.
- Después de confirmar, no habrá autoedición del horario por parte del estudiante. Los cambios se gestionarán desde el panel del personal.

Ejemplo válido:
Lunes: 08:00–09:00.
Miércoles: 16:00–17:00.
Viernes: 16:00–17:00.

## 4. Horarios y aforo
Turno mañana: 08:00–12:00.
Turno tarde: 15:00–20:00 (actualizado por el usuario el 6 de octubre de 2026).

Bloques de una hora:
08:00–09:00.
09:00–10:00.
10:00–11:00.
11:00–12:00.
15:00–16:00.
16:00–17:00.
17:00–18:00.
18:00–19:00.
19:00–20:00.

Cada combinación de día de la semana + bloque horario admite como máximo 20 inscritos en el periodo mensual. La reserva representa ese horario semanal recurrente durante el mes.

La página consulta la ocupación antes de mostrar los horarios. Los bloques completos aparecen deshabilitados. Al confirmar una inscripción se deben volver a validar los cupos en el backend y utilizar el bloqueo de Apps Script para impedir que dos solicitudes simultáneas ocupen el último cupo. No debe existir un inscrito número 21.

Los días concretos de apertura son configurables. El usuario confirmó el 6 de octubre de 2026 que abre de lunes a viernes; sábado y domingo no están habilitados.

## 5. Dos qr públicos
Habrá solamente dos QR fijos para estudiantes, con rutas web distintas:

QR de registro:
Abre la página de inscripción mensual. El código UNT se obtiene mediante el escaneo obligatorio del carnet; luego se completan los datos y se eligen los horarios.

QR de asistencia:
Abre la página de marcado de asistencia. Ofrece exactamente dos métodos:
A) Escanear el código de barras del carnet. El sistema obtiene el código y recupera los datos del inscrito del mes, sin volver a pedir nombres ni código.
B) Sin carnet: escribir el código de estudiante y los nombres y apellidos. Ambos deben coincidir con el registro mensual.

Los QR son puntos de acceso visibles a las páginas. Se acepta para esta versión que un QR estático contiene una URL compartible y no demuestra por sí solo presencia física en la puerta. Un QR dinámico queda como evolución futura, no como requisito inicial.

## 6. Lector de carnet
La cámara se utilizará desde la web alojada en Vercel. El frontend debe incluir una librería de lectura de códigos de barras compatible con móviles.

El escaneo devuelve el código del carnet. El usuario confirmó el 6 de octubre de 2026 que contiene solo números. La longitud exacta y la simbología del código de barras siguen pendientes; el límite técnico provisional es 40 caracteres, sin convertirlos a número ni eliminar ceros iniciales. No se ha proporcionado una base oficial de estudiantes UNT. No inventar integración con sistemas oficiales ni afirmar que leer el carnet verifica automáticamente identidad, titularidad o matrícula vigente.

El logo y un ejemplo real del código de barras se entregan como archivos independientes cuando sean necesarios. Este TXT no contiene esos archivos.

## 7. Validaciones de asistencia
Antes de registrar una asistencia, el backend comprobará:

1. Que el código está inscrito en el mes operativo.
2. Que el alumno está activo y tiene menos de 3 faltas.
3. Que hoy es uno de sus días reservados.
4. Que la hora actual corresponde a su bloque reservado.
5. Que el turno o la fecha no están declarados como cerrados.
6. Que no existe ya una asistencia para esa misma sesión.
7. En el método manual, que el nombre completo coincide con el registro.

Ejemplos de comportamiento:

- Miércoles 16:20, con reserva miércoles 16:00–17:00: registra asistencia.
- Segundo marcado para esa sesión: informa que ya está registrado, sin duplicar filas.
- Miércoles 15:20, con reserva 16:00–17:00: rechaza e informa el horario de hoy.
- Martes sin reserva: rechaza porque no tiene sesión programada.
- Con 3 faltas: informa que está bloqueado hasta terminar el mes.

Se utiliza la hora del servidor en zona America/Lima. No se utiliza como autoridad la fecha/hora configurada en el teléfono.

Internamente se conservará el timestamp, el método de marcado y el horario validado. La hoja visible para el administrativo puede mostrar solamente la fecha, sin hora.

## 8. Faltas y bloqueo

- Una sesión reservada que termina sin asistencia genera una falta.
- La falta se calcula respecto del horario reservado, no de cualquier día del mes.
- Al llegar a 3 faltas, el alumno queda bloqueado por el resto del mes.
- Las faltas se calculan automáticamente mediante activadores temporales de Apps Script.
- El proceso debe evitar duplicar faltas si se ejecuta nuevamente.
- Las fechas o turnos cerrados no generan faltas.
- El siguiente mes el estudiante puede inscribirse de nuevo; sus faltas comienzan en cero.

## 9. Cierres del gimnasio
El panel permite declarar días no laborables por feriado, mantenimiento, suspensión de clases, actividad universitaria o cierre excepcional.

También debe existir el botón "Hoy no abrió este turno", aplicable a mañana o tarde. Debe pedir confirmación y registrar fecha, turno, motivo, estado, cuenta que realizó la acción y timestamp.

Si se cierra el turno mañana, afecta a 08–09, 09–10, 10–11 y 11–12.
Si se cierra el turno tarde, afecta a 15–16, 16–17, 17–18 y 18–19.

El cierre obliga a recalcular las faltas de las sesiones afectadas. Si ya se había generado una falta, deja de contar. No se resta una falta arbitrariamente a todos los alumnos.

Ejemplo: un alumno pasó de 2 a 3 faltas por una sesión que luego se declara cerrada. Al recalcular vuelve a 2 faltas y se reactiva automáticamente.

Debe poder corregirse o reabrirse un turno marcado por error, recalculando lo que corresponda. Ambos usuarios tienen acceso a estas acciones.

## 10. Cuentas del panel interno
Cuenta compartida por profesores:
Usuario: ProfesorGYM
Contraseña inicial: Profunt

Cuenta administrativa:
Usuario: Administrador
Contraseña inicial: Adminunt

Son DOS usuarios distintos con los MISMOS permisos. La diferencia sirve para registrar qué cuenta inició sesión o realizó una acción. Al usar una cuenta compartida no se identifica cuál de los dos profesores actuó.

Ambos pueden:

- Elegir turno mañana o tarde y consultar ambos turnos.
- Ver el mismo dashboard completo.
- Revisar registrados, horarios, cupos, asistencias, faltas y bloqueados.
- Gestionar cambios de horario solicitados por estudiantes.
- Declarar días o turnos cerrados y corregir el estado.
- Exportar y descargar reportes.
- Acceder a la configuración necesaria para las reglas acordadas.
- Cambiar la contraseña de su propia cuenta.

El usuario pidió un acceso sencillo, sin un sistema complejo de seguridad. No agregar registro de cuentas, recuperación por correo, códigos, doble factor ni OAuth para estos usuarios.

Las credenciales se validan del lado servidor; no se colocan como constantes públicas en el frontend. Se utiliza una sesión/cookie sencilla. Se propuso inicializar secretos mediante configuración del servidor/Vercel. El cambio de contraseña requiere almacenamiento persistente del lado servidor; no basta modificar una variable temporal en una función ni localStorage.

Apartado "Cambiar contraseña":
Contraseña actual.
Nueva contraseña.
Confirmar nueva contraseña.
Guardar cambio.

## 11. Google sheets operativo mensual
No se mantendrá una única hoja operativa acumulando años de estudiantes. Cada mes habrá un archivo operativo nuevo.

Ejemplo: GIMNASIO_UNT_OCTUBRE_2026.

Hojas previstas:
REGISTRADOS: estudiantes inscritos y sus datos.
HORARIOS: reservas semanales por estudiante.
ASISTENCIAS: marcados válidos.
FALTAS: sesiones sin asistencia y su estado al recalcular.
CUPOS: ocupación por día y hora.
CONFIGURACIÓN: periodo, bloques, días habilitados, aforo y reglas.
CIERRES: cierres por fecha y turno, motivos y cuenta responsable.
DASHBOARD: indicadores, estadísticas y gráficos del mes.

El administrativo trabajará principalmente con REGISTRADOS y ASISTENCIAS. Las hojas técnicas pueden quedar protegidas u ocultas. La representación técnica de usuarios debe preservar las dos identidades, sin publicar las contraseñas en hojas visibles.

REGISTRADOS, columnas visibles orientativas:
Código, alumno, facultad, carrera, ciclo, día 1, hora 1, día 2, hora 2, día 3, hora 3, faltas y estado.
Si elige uno o dos días, los demás pares quedan vacíos.

ASISTENCIAS, columnas visibles orientativas:
Fecha, código, alumno, facultad, carrera y ciclo.
Datos internos adicionales: timestamp, método CARNET/MANUAL y horario validado.

CIERRES, campos orientativos:
Fecha, turno o alcance de cierre, estado, motivo, registrado_por y timestamp.

## 12. Una cuenta google exclusiva
Se utilizará una sola cuenta Gmail creada específicamente para el gimnasio. Será propietaria del Google Sheets operativo, Apps Script, carpeta de reportes y archivos mensuales de Drive.

El proyecto no debe depender del Gmail personal de un alumno. No se ha confirmado que esta cuenta ya esté creada.

## 13. Cierre mensual automático
Al terminar el mes se debe:

1. Consolidar registros, asistencia, faltas y estadísticas.
2. Generar el Excel mensual definitivo, incluyendo el análisis y los gráficos acordados.
3. Guardarlo en Google Drive.
4. Cerrar el periodo y crear el nuevo archivo operativo vacío.

Ejemplo de destino:
Gimnasio UNT / 2026 / Octubre / GIMNASIO_UNT_OCTUBRE_2026.xlsx.

El nuevo mes comienza con:
Registrados: 0.
Asistencias: 0.
Faltas: 0.
Cupos ocupados: 0.

Se debe preservar el archivo de cierre antes de iniciar el periodo nuevo. El reinicio corresponde a datos operativos mensuales; las dos cuentas, las contraseñas cambiadas y la configuración general deben seguir disponibles.

## 14. Exportación parcial a petición
Ambos usuarios pueden generar un reporte del mes hasta el momento de la solicitud y descargarlo directamente en celular, tablet o computadora. No deben esperar al cierre mensual.

Ejemplo: GIMNASIO_UNT_CORTE_15_OCTUBRE_2026.xlsx.

Opciones propuestas para el botón Exportar:
Alcance: todo el mes hasta hoy, solo mañana o solo tarde.
Contenido: registrados, asistencias, faltas, estadísticas y gráficos.
Acción principal: Descargar Excel.

Una exportación parcial no borra registros, no libera cupos, no reinicia el mes ni detiene el funcionamiento.

Se propuso como opción adicional un botón "Guardar copia en Drive" para archivar un corte cuando el personal lo solicite. No guardar automáticamente una copia por cada descarga.

## 15. Dashboard y análisis
Ambos usuarios ven el mismo panel y pueden filtrar por turno.

Indicadores previstos:

- Alumnos inscritos en el mes.
- Asistencias totales.
- Faltas contabilizadas.
- Alumnos bloqueados por faltas.
- Asistencia respecto de las sesiones programadas aplicables.
- Ocupación de cupos por turno y horario.
- Horario más solicitado y menos solicitado.
- Horario con más y menos asistencias.
- Día más concurrido.

Vista de hoy, por turno:

- Alumnos programados.
- Asistencias registradas.
- Sesiones finalizadas sin asistencia.
- Alumnos bloqueados.
- Resumen por bloque: inscritos/programados, asistentes y faltas.

Evitar confundir una sesión aún pendiente con una falta o mezclar ocupación de reservas con concurrencia real. Los ejemplos numéricos de la conversación eran ilustrativos, no datos reales.

Gráficos útiles:

- Asistencia por horario.
- Asistencia por día de la semana.
- Comparación mañana/tarde.
- Inscritos por facultad/carrera, si aporta utilidad.

El dashboard debe ser claro y no estar sobrecargado. El cierre mensual incluye análisis y unos pocos gráficos útiles.

## 16. Arquitectura acordada
Estudiante:
QR registro -> web de inscripción.
QR asistencia -> web de asistencia.

Personal:
Login -> selección de turno -> panel interno compartido en funciones.

Flujo técnico:
Frontend móvil en Vercel -> API/backend de Vercel -> Google Apps Script -> Google Sheets.
Google Apps Script -> automatización de faltas, cierres y cambio de periodo.
Google Apps Script -> exportación Excel -> Google Drive.

La cámara y el lector de carnet están en la web externa alojada en Vercel. La lógica de cupos, inscripción y asistencia debe validarse en el backend, no depender solamente del navegador.

Tecnologías propuestas:
Frontend: HTML, CSS y JavaScript, o una implementación compatible con Vercel que mantenga la sencillez.
Lectura de barcode: librería JavaScript de escaneo.
Hosting de la web y endpoints propios: Vercel.
Backend operativo y automatizaciones: Google Apps Script.
Datos mensuales: Google Sheets.
Archivo de reportes: Google Drive.
Reportes descargables: .xlsx.

No se acordó usar Firebase Database, una base SQL o un servidor pagado. El antiguo Firebase Hosting queda descartado.

## 17. Diseño móvil e identidad visual
Es una app WEB MÓVIL responsive, no una app nativa Android/iOS.

Diseñar primero para celular:

- Botones grandes y fáciles de tocar.
- Navegación simple.
- Formularios cómodos.
- Lectura de carnet mediante cámara del teléfono.
- Dashboard y listados adaptables a pantallas pequeñas.
- Descarga de reportes desde el dispositivo usado.

Identidad:
Logo del Gimnasio UNT proporcionado por el usuario.
Colores principales: azul oscuro y amarillo/dorado.
Blanco como color de apoyo y fondo principal.
Modo claro por defecto.
Botón para alternar entre claro y oscuro, preservando los colores del logo.

No inventar otro logo ni cambiar la identidad por una paleta genérica. No se fijaron códigos hexadecimales; se deben obtener del logo proporcionado. Este archivo no contiene la imagen.

La opción de instalar como acceso directo/PWA queda como posibilidad futura, no como requisito obligatorio para la primera versión.

## 18. Detalles a resolver durante la implementación
Estos puntos no se cerraron expresamente en la conversación:

- Días exactos de apertura del gimnasio.
- Lista oficial de facultades y carreras/escuelas.
- Formato del código de estudiante y tipo de código de barras del carnet.
- Disponibilidad de una lista oficial de alumnos para validación adicional.
- Política de cupos de alumnos bloqueados: no se confirmó que sus reservas se liberen automáticamente.
- Reglas de un cambio de horario a mitad de mes y tratamiento de sesiones previas.
- Momento exacto/frecuencia de los activadores automáticos y tratamiento de fallos de exportación.
- Mecanismo concreto de persistencia de contraseñas y sesión, manteniendo el acceso simple solicitado.
- Credenciales, IDs, URLs y configuración real de Vercel, Apps Script, Sheets y Drive.
- Verificación práctica de límites de los servicios gratuitos y compatibilidad móvil del lector.

No inventar que estos detalles ya están configurados o aprobados. Mantener el trabajo útil y plantear únicamente las aclaraciones que sean necesarias para una decisión concreta.

## 19. Orden de desarrollo propuesto en la conversación

1. Estructura del Sheet y modelo de datos mensual.
2. Lógica de reservas y cupos con concurrencia.
3. Web de registro, lector de carnet y selección de horarios.
4. QR y página de asistencia con sus dos métodos de identificación.
5. Validaciones y prevención de duplicados.
6. Faltas automáticas y bloqueos.
7. Cierres de día/turno y recálculo.
8. Login, selección de turno y panel para los dos usuarios con permisos iguales.
9. Cambio simple y persistente de contraseña.
10. Dashboard, reportes y exportaciones parciales.
11. Cierre mensual automático, archivo Excel en Drive y nuevo periodo vacío.
12. Verificación móvil, lectores, reglas y despliegue en Vercel.

## 20. Comprobaciones clave antes de considerar el sistema terminado

- Dos alumnos intentando tomar simultáneamente el último cupo: solamente uno se inscribe.
- Ningún horario puede superar 20 inscritos.
- No se permite inscribir dos veces el mismo código en un mes.
- La inscripción exige escaneo; la asistencia admite escaneo o datos manuales coincidentes.
- Se respetan 1–3 días semanales y una hora por día.
- No se registra asistencia fuera del día/bloque reservado ni se duplica una sesión.
- Se usa America/Lima en el servidor.
- Las faltas no se duplican al ejecutar nuevamente el cálculo.
- A 3 faltas se bloquea; un cierre posterior puede anular la falta correspondiente y reactivar.
- Ambos usuarios tienen las mismas funciones.
- Los cambios de contraseña persisten entre dispositivos, ejecuciones y meses.
- Exportar un corte no modifica datos operativos.
- El cierre conserva el reporte y abre el nuevo mes con cupos y registros en cero.
- La web abre en modo claro, cambia a oscuro y mantiene logo y colores.

---
