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
