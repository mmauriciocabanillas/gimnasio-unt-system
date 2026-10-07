# Evaluación diaria y mensual de cuotas

Fecha: 6 de octubre de 2026. Código local `2026-10-06-flow-3`. No se modificaron datos, contraseñas, activadores ni despliegues reales.

## Veredicto

**No existe un límite de horas de pestaña abierta que apague esta web.** No se encontró sondeo automático en la interfaz: el panel se consulta al cargar, tras acciones y al pulsar Actualizar. El único temporizador encontrado revoca una descarga local, no consulta Google. La cámara consume recursos del dispositivo, no mantiene una función de Vercel ejecutándose.

Con el gimnasio lleno, dos personas consultando cada cinco minutos y nueve horas de atención, las proyecciones de solicitudes, cómputo y transferencia caben en Hobby con Fluid Compute y en las cuotas personales de Apps Script evaluadas. Esto no certifica saldo disponible de una cuenta compartida ni evita fallos de red.

Los límites de CPU/memoria cuentan trabajo del servidor, no horas de página abierta. En Fluid Compute, Vercel pausa el consumo entre solicitudes; esperar respuestas externas no consume CPU activa, aunque sí mantiene memoria durante la solicitud. [Facturación de funciones](https://vercel.com/docs/functions/usage-and-pricing).

## Simulación ejecutada, no solo cálculos

Se ejecutó `scripts/simulate-quota-month.mjs` sobre el código real del proyecto, sustituyendo Google por servicios en memoria. No se cargó `.env.local` ni se conectó a producción.

| Resultado local | Valor |
| --- | ---: |
| Alumnos ficticios | 300 |
| Reservas semanales | 900, todas las franjas llenas |
| Días de atención en octubre | 22 |
| Asistencias válidas | 3.960 = 180 × 22 |
| Revisiones de faltas, incluyendo noches/fines de semana | 2.976 = 96 × 31 |
| Comprobaciones mensuales | 744 = 24 × 31 |
| Operaciones de propiedades acumuladas en el mes simulado | 50.835 |
| Máximo diario de propiedades, escenario ejecutado | 4.086 |
| Tamaño máximo del panel JSON | 911.848 bytes |
| Cierre | Octubre → noviembre |
| Exportaciones finales, incluido reintento | 1 |
| Nuevo mes vacío / versiones de cuentas intactas | Confirmado en simulación |

Las 50.835 operaciones acumuladas NO incumplen un límite de 50.000/día: no ocurrieron en un solo día. Las APIs de Google, sus cuotas y latencia reales no se ejecutaron en esta simulación. El XLSX está simulado; no demuestra el tamaño de un archivo exportado por Google con 3.960 asistencias.

## Proyección mensual, plataforma usada durante nueve horas diarias

Supuestos: misma carga de alumnos/asistencias, dos personas, 22 días de atención, cuatro informes manuales, apertura de una página nueva por asistencia, sin otros proyectos ni tráfico abusivo. Las frecuencias de Actualizar son escenarios, no un comportamiento medido del usuario. Se ejecutaron 18 consultas de panel por día; las consultas adicionales se proyectaron con su coste instrumentado.

| Recurso | Actualizar cada 5 min | Actualizar cada 1 min | Hobby/Google personal |
| --- | ---: | ---: | ---: |
| Solicitudes de funciones/mes | ≈14.052 | ≈33.060 | 1.000.000 con Fluid |
| Memoria/mes, promedio 10 s por solicitud a Google | ≈53,96 GB-h | ≈159,56 GB-h | 360 GB-h |
| CPU/mes, supuesto 100 ms activos por función | ≈0,390 h | ≈0,918 h | 4 h |
| Propiedades/día, previsión conservadora del pico | ≈9.490 | ≈14.674 | 50.000/día |
| Paneles: bytes sin comprimir, usando el panel máximo en todas las consultas | ≤4,333 GB | ≤21,666 GB | 10 GB de transferencia de origen |

Cuotas: [Hobby](https://vercel.com/docs/plans/hobby), [Apps Script](https://developers.google.com/apps-script/guides/services/quotas).

La previsión de propiedades concentra conservadoramente 600 consultas públicas de registro en el día más ocupado. Los informes y cambios de configuración adicionales pueden sumar operaciones; no se midió un saldo real.

Memoria: `(solicitudes a Google × duración + solicitudes locales × 0,02 s) × 2 GB / 3.600`. No se descontó el ahorro por compartir instancias concurrentes. Para el escenario de cinco minutos, promedios de 4/10/30 s dan aproximadamente 21,6/54,0/161,8 GB-h. No se midió la duración media real de todas las acciones del mes.

CPU: `solicitudes × CPU activa media / 3.600`. Los 100 ms son una hipótesis de sensibilidad, no una medición. El contador CPU local devolvió cero y se descartó: no se interpreta como consumo nulo. Con 250 ms de media, el escenario de cinco minutos usaría aproximadamente 0,976 h, todavía bajo cuatro horas.

## Trabajo diario de Google

Los 90 minutos/día aplican al tiempo acumulado de activadores, NO a tener la plataforma abierta. Con 96 revisiones de faltas y 24 comprobaciones mensuales:

- Revisiones de 4 s y comprobaciones de 1 s: 6,8 min/día.
- Revisiones de 10 s y comprobaciones de 1 s: 16,4 min/día.
- Revisiones de 30 s y comprobaciones de 1 s: 48,4 min/día.
- Revisiones de 60 s y comprobaciones de 1 s: 96,4 min/día, excedería la cuota personal.

Estas duraciones son escenarios. El cierre real, exportaciones, errores/reintentos y otros scripts añaden tiempo. La simulación local no mide segundos facturados por Google. La sesión del personal vence tras ocho horas y exige volver a ingresar; eso no equivale a caída por cuota.

## Escenarios que sí pueden agotar recursos mensuales

1. **Dos personas actualizando cada minuto durante nueve horas:** el crecimiento diario del panel produce una estimación de aproximadamente 12,7–13,5 GB de JSON sin comprimir en octubre. Existe riesgo frente a 10 GB de transferencia de origen. No equivale a consumo facturado comprobado: dependen de bytes realmente transmitidos, compresión, cabeceras y demás tráfico. Con cinco minutos, el cálculo diario da como máximo unos 2,703 GB; incluso usando el panel final en todas las consultas, 4,333 GB.
2. **Dos personas actualizando cada minuto las 24 horas durante 31 días:** unas 98.714 solicitudes; suponiendo 10 s de media y 2 GB por instancia, unos 524 GB-h sin ahorro de concurrencia. Supera 360. No es «pestaña abierta»: exige consultas continuas; el código actual NO las realiza automáticamente.
3. **Consultas muy lentas:** con la frecuencia de un minuto/nueve horas y 30 s de media, el modelo da unos 479 GB-h, también supera 360. La demora prolongada sí afecta memoria aunque no sea CPU activa.

Vercel mide transferencia de origen entre funciones y CDN, y transferencia al usuario por separado. Reducir bytes del panel disminuye consumo; la paginación visual actual no reduce su respuesta completa. [Cálculo de transferencia](https://vercel.com/docs/manage-cdn-usage#calculating-fast-origin-transfer).

## Comprobación real limitada

Tres consultas públicas a la aplicación publicada respondieron HTTP 200, revisión `2026-10-06-flow-3`, en 4,069 / 2,614 / 3,060 s. Las inscripciones estaban deshabilitadas por configuración (`enabled:false`). No se activaron. Estas consultas no prueban latencia con el mes lleno ni consumo mensual real.

No hay CLI Vercel disponible ni enlace local `.vercel/project.json` en este entorno. No se confirmó el plan, la opción Fluid ni su saldo Usage. Si se desactivó Fluid, el modelo heredado tiene cuotas distintas; no mezclar las cifras de ambos modelos. [Modelo heredado](https://vercel.com/docs/functions/usage-and-pricing/legacy-pricing).

**Resultado práctico:** mantener la web abierta no provoca agotamiento horario. La carga mensual definida con consultas cada cinco minutos tiene margen bajo las hipótesis publicadas. No es correcto prometer que nunca se suspenderá: hay escenarios cuantificados de uso continuo que sí agotan cuotas, y queda sin medir el saldo real compartido de la cuenta.
