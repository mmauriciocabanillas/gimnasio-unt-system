# Bienvenida y cuentas — 7 de octubre de 2026

- Título: «Supervisión activa.» / «Control de aforo.».
- Subtexto: «Monitorea el ingreso de los estudiantes.» / «Genera registros y estadísticas de asistencia.».
- Nombre visible en selector, cabecera, barra lateral, configuración e historial de cierres: Profesor.
- API acepta Profesor y lo resuelve al ID persistente ProfesorGYM para preservar las propiedades privadas, sesiones firmadas, permisos e historial. Se conserva compatibilidad con el nombre anterior.
- Las dos contraseñas solicitadas se actualizaron en las propiedades privadas de Google usando hashes scrypt. No se guardan las claves nuevas en este documento, el frontend ni los archivos del repositorio.
- El cambio de versión invalida sesiones anteriores.
- Las respuestas iniciales de las escrituras de Google fueron ambiguas (502/timeout). No se repitieron a ciegas: se comprobó la clave del profesor mediante lectura privada y después se verificaron ambos accesos en https://gimnasiount.vercel.app/api/login. ProfesorGYM y Administrador devolvieron HTTP 200, identidad correcta y cookie de sesión.
- No se modificaron datos de alumnos, horarios, cierres, activadores ni informes de Google.

## Validación

- Suite completa: 135 pruebas aprobadas, 0 fallidas.
- Comprobación posterior de interfaz y API: 26 pruebas aprobadas.
- Compilación correcta.
- La vista ficticia local muestra los textos solicitados y permite entrar como Profesor con la clave exclusiva de QA. Las claves del servicio real no se copiaron al entorno ficticio.
- Evidencia visual: `interfaz-implementada/bienvenida-supervision.jpg`.

Las credenciales reales ya cambiaron. El código de interfaz y el alias API todavía no se publicaron en GitHub/Vercel; no requieren sustituir Code.js o Domain.js en Apps Script.
