# Decisiones técnicas y pendientes

## Confirmado por el contexto

20 cupos por combinación de día y bloque; 1–3 días; dos usuarios iguales en permisos; sin login de estudiantes; Vercel, Apps Script, Sheets y Drive; tres faltas; cierres y recálculo; Excel parcial y definitivo; modo claro/oscuro; logo original.

## Ajuste de diseño y acceso confirmado

- La raíz `/` muestra la bienvenida del personal, no un menú público. Su botón **INGRESAR** abre la segunda pantalla, el login (`/#ingresar`). Después de autenticarse muestra el panel. Una pantalla a la vez, sin marco adicional, cabecera ni pie exteriores en estas dos pantallas.
- Ambas cuentas muestran los dos QR fijos en **Códigos QR**. No se crean enlaces nuevos por alumno ni por sesión.
- `/registro` y `/asistencia` son páginas independientes de una sola acción, sin navegación entre ellas ni al panel.
- Turnos: **Turno mañana**, **Turno tarde**, **Todo el día**; las horas de las reservas se conservan donde corresponden.
- Referencia visual: superficies redondeadas, menú oscuro e iconos de línea. Se mantiene el logo original y su identidad navy/dorada.
- `XXXXX.COM` es un ejemplo; el dominio real todavía no se ha proporcionado ni desplegado.
- Ajuste visual posterior: azul UNT de borde a borde en bienvenida, login, registro y asistencia, sin fondo claro exterior ni tarjetas blancas de formulario. Los estudiantes no tienen selector de tema; el panel privado lo conserva. La lectura del QR y el flujo de dos pantallas del personal no cambian.

## Valores provisionales que requieren validación operativa

| Punto | Implementación actual | Qué confirmar |
| --- | --- | --- |
| Días abiertos | Lunes a viernes confirmado el 6 de octubre de 2026; inscripciones cerradas por defecto | Mantener sábado y domingo deshabilitados |
| Turno tarde | 15:00–20:00 confirmado el 6 de octubre de 2026; cinco bloques de una hora verificados en Google | Probar asistencia real en el último bloque antes de uso operativo |
| Código | Solo números confirmado; patrón provisional `^[0-9]{1,40}$`; mantiene ceros iniciales | Largo exacto, tipo de barcode y lectura real |
| Facultades/carreras | Campos de texto, sin lista inventada | Lista oficial si se requieren selectores |
| Bloqueados | Conservan su reserva mensual | Si en una versión posterior se liberarán cupos |
| Alta durante una sesión | Primera sesión aplicable: la próxima que todavía no haya empezado | Validar esta regla de incorporación |
| Cambio de horario | Desde mañana o después, dentro del mes; conserva reservas históricas | Validar esta regla antes de operación institucional |
| Automatización | Faltas cada 15 min; rollover cada hora con reintentos | Ajustar después de medir cuotas y tiempos reales |
| Contraseñas | Hash scrypt en propiedades privadas del script; cookie HttpOnly firmada | Sin cuentas extra ni recuperación por correo |

Un cambio futuro reserva el cupo nuevo desde que se confirma y conserva ocupado el anterior hasta su fecha de aplicación. Si ambos coinciden en el mismo bloque, cuentan una sola vez. Evita sobrecupo al gestionar cambios.

## Límites comprobables

- La cámara lee un código; no acredita identidad, matrícula vigente ni titularidad del carnet.
- `method=CARNET` es una declaración del navegador y puede falsificarse construyendo una petición. En la interfaz no existe entrada manual para registro; una cámara web no produce por sí sola evidencia verificable de que el alumno escaneó físicamente su carnet.
- Los QR estáticos no prueban presencia física. La URL se puede compartir.
- El aislamiento de las páginas de estudiantes es de interfaz, no un bloqueo del navegador: alguien puede escribir la otra URL manualmente. Las operaciones privadas del panel sí requieren sesión autenticada en la API.
- Google Sheets con acceso de editor permite modificar los datos por fuera del bloqueo. Evitar edición directa y restringir los permisos de las hojas operativas.
- Google y Vercel tienen cuotas. Se verifica funcionamiento y rendimiento real después de publicar con la cuenta institucional prevista.
- Los servicios no proporcionan una transacción conjunta entre Drive, Sheets y propiedades de Apps Script. El rollover conserva el archivo operativo y registra hitos para reintentar; una interrupción exactamente entre crear un Excel y guardar su ID puede producir una copia extra, pero no vacía los registros.
- No hay un backend de demostración sustituyendo Google. Sin conexión, la UI informa el pendiente y los endpoints devuelven 503.
- La prueba local del último cupo valida la lógica; la exclusión mutua real de LockService y la escritura atómica de Google se deben comprobar en el script desplegado.
