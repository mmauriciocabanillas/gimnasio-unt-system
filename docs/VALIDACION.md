# Validación de entrega — 5 de octubre de 2026

## Ubicación

`C:\Users\ASUS\Documents\Siklerito\Proyectos Personales\Gimnasio unt`

El logo original `LOGO GYM UNT.png` se conserva. `public/logo.png` es una copia para la web. Las dependencias están instaladas y se incluye `package-lock.json`.

## Verificado localmente

- `npm run check`: sintaxis JavaScript y JSON correcta, incluidos los archivos Apps Script.
- `npm test`: 43 pruebas aprobadas.
- `npm run build`: compilación de producción aprobada.
- `npm audit --omit=dev --audit-level=high`: cero vulnerabilidades reportadas en dependencias de ejecución en el momento de la verificación.
- El bundle público no contiene las contraseñas iniciales ni el contenido de los secretos locales.
- El original del logo y la copia web tienen el mismo SHA-256.

Las pruebas cubren aforo y último cupo, duplicados, 1–3 días, carnet requerido, método manual coincidente, hora Perú, sesiones pendientes, faltas idempotentes, bloqueo, cierre y reapertura, horario histórico, cupos de cambios futuros, igualdad de permisos, cookies, cambio persistente de versión de contraseña, firma del puente, liberación del lock, guardado atómico y recuperación del rollover tras fallos.

Los servicios de Google se simulan en las pruebas de integración; no se presentan como conexiones reales.

## Revisión en navegador

La lista siguiente corresponde a la primera revisión, anterior al ajuste de diseño y accesos descrito más abajo.

- Inicio, registro, asistencia, login y QR revisados en escritorio y con viewport móvil de 390 × 844.
- Modo claro inicial y cambio a oscuro comprobados.
- Registro sin campo para escribir manualmente el código del carnet.
- Asistencia con los dos métodos acordados.
- Dos QR generados para rutas distintas; los QR locales indican que el destino definitivo requiere HTTPS desplegado.
- Las seis secciones del panel, el filtro de turno y el diálogo de cambio de horario revisados en `http://localhost:3181` con datos ficticios y servidor de QA de solo lectura.
- Se corrigió un desbordamiento de tabla: ancho útil móvil 375 px y ancho del documento 375 px, sin scroll horizontal del documento. Tablas y navegación conservan su propio scroll cuando corresponde.
- La app operativa local en `http://localhost:3180` no usa el servidor QA ni datos ficticios.

## Revisión del ajuste de diseño y accesos

- Raíz: login del personal, sin enlaces para estudiantes. Selector de usuario con ProfesorGYM y Administrador.
- Turnos del login y del panel: Turno mañana, Turno tarde y Todo el día, sin horas en sus etiquetas.
- Panel con siete secciones; **Códigos QR** está dentro del mismo panel compartido por ambas cuentas. Los permisos iguales se verifican en las pruebas de API; la vista de navegador de QA usa ProfesorGYM.
- Dos canvas QR de 280 × 280 listos, con destinos distintos `/registro` y `/asistencia`; descarga habilitada después de dibujarlos. Destinos locales solo para QA, no para uso desde celulares.
- Registro y asistencia revisados como páginas independientes: cero enlaces y sin menú del personal, incluso con una sesión de QA disponible.
- Estilo basado en la referencia, manteniendo el logo original; revisión de escritorio y móvil, claro y oscuro. En móvil, ancho del documento 375 px y ancho útil 375 px: sin desbordamiento horizontal del documento.
- Sintaxis, build y 43 pruebas aprobados después del cambio funcional. Google y el dominio real siguen sin activarse.

## Ajuste posterior: acceso móvil en dos pantallas

- Bienvenida en `/` con **INGRESAR** debajo de «Acompaña cada entrenamiento»; login separado en `/#ingresar`.
- Transición y regreso mediante Atrás comprobados en navegador. Una sola pantalla montada, cero cabeceras/pies exteriores y ningún marco adicional.
- Revisión móvil de 390 × 844: ancho útil y ancho del documento de 390 px, sin desbordamiento horizontal. No se modificaron las páginas de estudiantes ni las funciones del panel.

También se comprobaron ambas pantallas a 320 × 640, sin desbordamiento horizontal. Sintaxis, build y 43 pruebas aprobados tras este ajuste.

## Revisión posterior del fondo azul

- Bienvenida, login, registro y asistencia: fondo raíz `rgb(4, 29, 55)`; sin bandas claras ni fondo blanco de formulario. El azul cubre toda la ventana, con contenido centrado.
- Las cuatro pantallas comprobadas a 320 × 640 sin desbordamiento horizontal. Login, registro y asistencia revisados a 390 × 844; bienvenida y registro revisados en escritorio de 1280 px.
- Registro y asistencia mantienen cero enlaces a otras acciones y no muestran selector de tema. No se cambió la lógica de negocio ni el panel privado.

- Sintaxis, compilación y 43 pruebas aprobados después del cambio.

## Estado real de Google y Vercel

No se ha recibido una URL de implementación Apps Script ni un proyecto/dominio Vercel configurado. `APPS_SCRIPT_URL` y `PUBLIC_APP_URL` quedan vacíos. Los IDs de las carpetas sí están incorporados al código.

En una revisión anterior se pudieron leer los nombres de ambas carpetas, pero el botón Nuevo estaba deshabilitado. En la última comprobación de esta entrega, ambos enlaces exactos devolvieron una página Google 404 en la sesión del navegador disponible. Esto no permite concluir si se eliminaron, cambiaron permisos o existe un problema de acceso de la sesión. Hay que comprobarlos desde la cuenta exclusiva del gimnasio.

No se crearon Sheets, proyectos Apps Script, activadores, reportes reales ni despliegues Vercel en esta sesión.

## Pendiente antes de uso real

Seguir `ACTIVACION.md`: publicar el script desde la cuenta del gimnasio, completar la URL /exec, ejecutar setup, confirmar días y formato del carnet, desplegar en Vercel y probar un carnet real, concurrencia en Google, Excel con gráficos y rollover real.

Esta entrega finaliza el desarrollo local verificado. La activación en nube permanece pendiente del acceso y configuración de esas cuentas.
