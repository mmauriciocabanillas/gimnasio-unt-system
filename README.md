# Gimnasio UNT

Aplicación web móvil para registro mensual, reservas, asistencia y panel del personal.

Arquitectura: web + API de Vercel → Google Apps Script → Sheets mensual y Drive. No se usa base de datos local, Firebase ni un servidor pagado.

## Ejecutar en esta computadora

En PowerShell, desde esta carpeta:

```powershell
npm install
npm run dev
```

Abrir **http://localhost:3180**: el enlace principal muestra primero la bienvenida. **INGRESAR**, debajo de «Acompaña cada entrenamiento», abre el login del personal y, después de autenticarse, su panel. Las dos pantallas se muestran por separado, con enfoque móvil y sin cabecera, pie ni marco exterior. El botón Atrás del navegador vuelve a la bienvenida. También se puede iniciar haciendo doble clic en `INICIAR.cmd` y mantener esa ventana abierta.

Ambas cuentas tienen la sección **Códigos QR** dentro del panel. El QR de inscripción abre `/registro`; el de asistencia abre `/asistencia`. Cada página de estudiantes permite únicamente su acción y no tiene enlaces al panel ni a la otra página. `/panel` y `/qr` se conservan como alias del acceso privado, no como páginas públicas de QR.

Los turnos del personal son **Turno mañana**, **Turno tarde** y **Todo el día**. El diseño adapta la referencia entregada con tarjetas redondeadas, campos sencillos e iconos de línea, conservando el logo y los colores del gimnasio.

Bienvenida, login, registro y asistencia tienen fondo azul UNT continuo en toda la ventana, sin bandas claras exteriores. Formularios centrados y adaptables a móvil; las páginas de estudiantes mantienen el azul fijo. El panel privado conserva su selector de tema.

Sin la URL real de Apps Script, la aplicación muestra que Google está pendiente y no acepta inscripciones ni asistencias. No hay alumnos ni sesiones de demostración mezclados con datos reales.

`XXXXX.COM` fue un ejemplo, no un dominio confirmado. Configurar `PUBLIC_APP_URL` con el dominio HTTPS real después del despliegue; ambos QR usarán esa dirección fija.

## Activar el sistema

Seguir [docs/ACTIVACION.md](docs/ACTIVACION.md). Los IDs de las dos carpetas proporcionadas ya están incluidos en `apps-script/Code.js`.

El setup crea un archivo Sheets para el periodo actual con REGISTRADOS, HORARIOS, ASISTENCIAS, FALTAS, CUPOS, CONFIGURACIÓN, CIERRES, DASHBOARD y AUDITORIA. Las contraseñas se guardan como hashes en propiedades privadas del script, fuera de las hojas y del frontend.

## Verificar el código

```powershell
npm run check
npm test
npm run build
```

Las pruebas locales verifican las reglas y la API. No sustituyen una prueba de concurrencia real en Apps Script, la lectura de un carnet real ni la exportación y el cierre mensual en la cuenta Google.

## Reglas y decisiones

- Inscripción: solo lectura de carnet, 1–3 días, una sesión por día y 20 cupos por bloque semanal.
- Asistencia: carnet o código + nombre completo coincidente. Fecha y hora del servidor en America/Lima.
- Tres faltas bloquean por el resto del mes. Los cupos de un bloqueado se conservan.
- Un cierre anula únicamente las faltas afectadas. Reabrir vuelve a calcularlas.
- ProfesorGYM y Administrador tienen las mismas funciones.
- Contraseñas modificadas persisten entre meses; las sesiones anteriores se revocan al cambiarlas.
- Exportar un corte no cambia el periodo ni los datos operativos.
- El cambio mensual no activa el siguiente periodo hasta archivar correctamente el Excel final.

Las decisiones todavía no confirmadas y sus valores provisionales están en [docs/DECISIONES.md](docs/DECISIONES.md). El contexto entregado por el usuario está preservado en `docs/CONTEXTO_APROBADO.md`.

## Estado de entrega

Consultar [docs/VALIDACION.md](docs/VALIDACION.md) para las comprobaciones realizadas y las pendientes de la conexión real.

Auditoría y optimización posteriores: [auditoría integral](docs/AUDITORIA-INTEGRAL-2026-10-06.md). La web publicada es https://gimnasiount.vercel.app. Las mejoras de Google requieren copiar Code.js/Domain.js a Apps Script y publicar una nueva versión, sin reinicializar cuentas.

Para repetir el mes ficticio sin tocar Google:

```powershell
npm run simulate:month
```

Produce el [resumen mensual](docs/simulacion/RESULTADO-MENSUAL.md) y un JSON de datos ficticios. No importar ese JSON a producción. Para revisar sus pantallas localmente, ejecutar node tests/ui-server.mjs y abrir http://localhost:3181; el servidor QA no permite escrituras.

Recorrido con acciones de alumno y personal: [auditoría de flujos](docs/AUDITORIA-FLUJOS-USUARIO-2026-10-06.md). Distingue pruebas de interfaz, simulación mensual y comprobaciones reales de Google.

Para probar formularios y cambios sin tocar producción:

```powershell
npm run qa:flow
```

Abrir http://localhost:3182 y http://localhost:3182/__qa. La segunda página controla el reloj y la cámara virtual. Este servidor solo escucha en esta computadora, no carga `.env.local` y reemplaza Google por memoria; las contraseñas de prueba aparecen en el control QA. Para recuperar exclusivamente la última evidencia ficticia: `npm run qa:flow -- --restore`. No usarlo como servidor real ni importar sus datos a Google.

Las correcciones de este recorrido requieren desplegar la web y actualizar **ambos** archivos de Apps Script; la revisión esperada es `2026-10-06-flow-2`. No reinicializar el sistema.

Verificación posterior de [concurrencia y cierre mensual](docs/VERIFICACION-CONCURRENCIA-CIERRE-2026-10-06.md): workers independientes y comprobaciones remotas sin cambiar datos. La corrección adicional del archivo mensual está en **Code.js**, revisión `2026-10-06-flow-3`; publicar una nueva versión de Código.gs, sin reinicializar cuentas. Para reproducir las carreras aisladas: `npm run simulate:concurrency`.
