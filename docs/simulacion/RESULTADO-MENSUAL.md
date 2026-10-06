# Simulación mensual — octubre de 2026

Datos completamente ficticios. Se ejecutó la API real del proyecto, el código real de Apps Script y las reglas reales, con Google/Drive/Sheets reemplazados por memoria. Ningún alumno se añadió a producción.

| Indicador | Resultado |
|---|---:|
| Periodo | 2026-10 |
| Alumnos inscritos | 120 |
| Reservas (incluye historial de cambios) | 223 |
| Asistencias | 789 |
| Faltas contabilizadas | 41 |
| Alumnos bloqueados | 11 |
| Asistencia sobre sesiones aplicables (%) | 95 |
| Duplicados evitados comprobados | 1 |
| Reactivación por cierre comprobada | Sí |
| Exportaciones simuladas (3 cortes + cierre) | 4 |
| Mes siguiente | 2026-11 |
| Alumnos al abrir el mes siguiente | 0 |

## Flujos comprobados

Ingreso de ambas cuentas; rechazo de contraseña; acceso sin sesión; configuración; 120 inscripciones; duplicado; aforo 20; códigos inválidos; asistencia manual y carnet; idempotencia; horarios; cierres totales y de turno; bloqueo; cierre retroactivo y reactivación; reapertura; cambio futuro de horario; tres cortes; revocación de sesión por cambio de contraseña; cierre mensual; archivo definitivo; noviembre vacío; reintento mensual; logout.

## Ejemplos ficticios

- 00000001: Alumno ficticio 001 Simulación UNT, ciclo 2; Lunes 08:00.
- 00000002: Alumno ficticio 002 Simulación UNT, ciclo 3; Lunes 08:00.
- 00000003: Alumno ficticio 003 Simulación UNT, ciclo 4; Lunes 08:00, Miércoles 09:00, Viernes 10:00.
- 00000004: Alumno ficticio 004 Simulación UNT, ciclo 5; Lunes 08:00.
- 00000005: Alumno ficticio 005 Simulación UNT, ciclo 6; Lunes 08:00.
- 00000006: Alumno ficticio 006 Simulación UNT, ciclo 7; Lunes 08:00.
- 00000007: Alumno ficticio 007 Simulación UNT, ciclo 8; Lunes 08:00.
- 00000008: Alumno ficticio 008 Simulación UNT, ciclo 9; Lunes 08:00.

## Límites de la prueba

La exportación ejecutó la construcción de tablas y tres gráficos de Code.js. El servicio de exportación y el binario XLSX son simulados: no se ha validado un Excel real ni la persistencia remota, cámara física, permisos de Drive o activadores reales. Las dos solicitudes al último cupo se verifican secuencialmente bajo el lock simulado; no acreditan concurrencia real de Google.

Tiempo local: 44716 ms. No equivale al tiempo en Vercel. Datos y cronología: [octubre-2026-datos-ficticios.json](octubre-2026-datos-ficticios.json).
