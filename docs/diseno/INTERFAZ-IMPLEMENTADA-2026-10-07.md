# Interfaz implementada — 7 de octubre de 2026

Actualización posterior: registro claro/oscuro, sin fecha decorativa; máximo inmediato de tres días en ambos formularios y auditoría de bloqueos. Véase [auditoría final de registro y asistencia](../AUDITORIA-REGISTRO-ASISTENCIA-2026-10-07.md). Las capturas iniciales de registro azul son históricas.

Rediseño del proyecto conectado a `mmauriciocabanillas/gimnasio-unt-system`, en `C:\Users\ASUS\Documents\Siklerito\Proyectos Personales\Gimnasio unt`.

## Corrección posterior: cupos y carnet

El gráfico anterior sumaba los cinco días y mostraba un denominador 100. El límite de inscripción ya era 20 por día y bloque. Ahora el gráfico muestra únicamente los cupos del día indicado, siempre sobre 20; no se cambia el aforo ni la lógica de reservas.

Se eliminan el campo editable de expresión regular y su aviso provisional. `Domain.js` valida exactamente diez dígitos numéricos, conservando ceros iniciales e ignorando patrones antiguos o enviados por el cliente. Los datos de las pruebas se adaptan a diez dígitos. No se modifican códigos ni contraseñas reales.

Verificación posterior: 105 pruebas aprobadas, compilación y sintaxis correctas; guardado de configuración sin el campo técnico comprobado en el entorno ficticio. Las capturas anteriores de Resumen y Configuración son históricas y quedan sustituidas por [cupos corregidos](interfaz-implementada/cupos-20-detalle.jpg) y [configuración sin patrón](interfaz-implementada/configuracion-sin-patron.jpg).

Esta corrección incluye `apps-script/Domain.js`: para aplicar la validación fija en Google se debe reemplazar `Domain.gs` con ese archivo y publicar una nueva versión de la implementación existente. No se ha actualizado Google ni publicado GitHub/Vercel en esta entrega.

## Diseño aplicado

- Panel claro y oscuro: superficies continuas, filas y separadores; sin tarjetas anidadas ni sombras decorativas.
- Las siete pestañas originales siguen directamente accesibles, también en móvil.
- Inscritos conserva la tabla en escritorio. En móvil cada fila muestra identidad, estudios, horario, faltas, estado y cambio de horario sin buscar la acción fuera del ancho de pantalla.
- Formularios con controles táctiles grandes, foco visible y textos legibles.
- Bienvenida, acceso, registro y asistencia mantienen el fondo azul UNT sin marco exterior blanco.
- Registro y asistencia conservan sus dos destinos y QR independientes.
- No se cambian handlers de negocio, cuentas, contraseñas, permisos, reglas, API ni Apps Script.

Referencias: [Hevy](https://www.hevyapp.com/wp-content/uploads/complete-Hevy-workout-1024x683.png) para filas móviles; [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui) para jerarquía y superficies; [Carbon](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) para tablas. Se adaptan criterios de composición; no se copian logotipos ni recursos visuales ajenos.

## Comprobaciones realizadas

- `npm test`: 102 pruebas aprobadas, 0 fallidas. Incluye 98 pruebas preexistentes y 4 contratos estáticos de interfaz. Los contratos estáticos no sustituyen la revisión del navegador.
- `npm run build`: compilación correcta.
- `npm run check`: sintaxis JavaScript y JSON correcta.
- `git diff --check`: sin errores de espacios.
- 49 revisiones de panel: siete pestañas en ambas cuentas ficticias; panel claro a 320, 360, 390, 768 y 1440 px; panel oscuro y profesor a 390 px. Sin desbordamiento horizontal de la página en las dimensiones revisadas. Algunas tablas usan desplazamiento interno.
- 10 revisiones públicas: registro y asistencia en los cinco anchos anteriores, sin desbordamiento de página.
- Búsqueda con coincidencia y sin coincidencias; apertura y cierre del diálogo de cambio de horario, sin modificar reservas.
- Inscripción ficticia por la interfaz: lectura simulada, datos, selección de horario, revisión y confirmación.
- Asistencia manual ficticia confirmada; repetición rechazada como asistencia ya registrada.

Las pruebas usaron memoria y un lector simulado, no Drive, cuentas reales ni cámara física. No se afirma haber vuelto a validar Google ni haber ejecutado todas las acciones de producción. Las pruebas automatizadas de cierre mensual siguen siendo pruebas aisladas.

## Abrir y reproducir

Con el servidor en ejecución: [Abrir sistema](http://localhost:3184/).

Para volver a iniciarlo, desde el directorio del proyecto:

```powershell
npm run preview:ui
```

Credenciales exclusivamente ficticias para esta vista: `ProfesorGYM` / `QA_Profesor_1234`, `Administrador` / `QA_Admin_1234`. El [control de prueba](http://localhost:3184/__qa) permite simular la lectura. Los datos se reinician al reiniciar el proceso. Este comando no carga `.env`, no persiste datos y no conecta Google.

## Capturas de la aplicación real local

- [Panel claro](interfaz-implementada/panel-escritorio-claro.jpg) · [Panel oscuro](interfaz-implementada/panel-escritorio-oscuro.jpg).
- [Administrador](interfaz-implementada/admin-escritorio-claro.jpg) · [Profesor móvil](interfaz-implementada/profesor-movil-oscuro.jpg).
- [Resumen claro](interfaz-implementada/resumen-movil-claro.jpg) · [oscuro](interfaz-implementada/resumen-movil-oscuro.jpg).
- [Inscritos claro](interfaz-implementada/inscritos-movil-claro.jpg) · [oscuro](interfaz-implementada/inscritos-movil-oscuro.jpg).
- [Asistencia y faltas claro](interfaz-implementada/asistencia-faltas-movil-claro.jpg) · [oscuro](interfaz-implementada/asistencia-faltas-movil-oscuro.jpg).
- [Cierres claro](interfaz-implementada/cierres-movil-claro.jpg) · [oscuro](interfaz-implementada/cierres-movil-oscuro.jpg).
- [Reportes claro](interfaz-implementada/reportes-movil-claro.jpg) · [oscuro](interfaz-implementada/reportes-movil-oscuro.jpg).
- [QR claro](interfaz-implementada/qr-movil-claro.jpg) · [oscuro](interfaz-implementada/qr-movil-oscuro.jpg).
- [Configuración claro](interfaz-implementada/configuracion-movil-claro.jpg) · [oscuro](interfaz-implementada/configuracion-movil-oscuro.jpg).
- [Registro móvil](interfaz-implementada/registro-movil.jpg) · [revisión de inscripción en escritorio](interfaz-implementada/confirmacion-registro-escritorio.jpg).
- [Asistencia móvil](interfaz-implementada/asistencia-movil.jpg) · [confirmación](interfaz-implementada/asistencia-movil-confirmada.jpg).
- [Cambio de horario móvil](interfaz-implementada/cambio-horario-movil.jpg).

Estado de entrega: cambios locales implementados y comprobados. No se ha hecho commit, push ni despliegue en esta entrega. Vercel conserva su versión publicada anterior.
