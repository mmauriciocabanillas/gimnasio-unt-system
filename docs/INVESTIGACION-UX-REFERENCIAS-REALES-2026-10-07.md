# Gimnasio UNT: investigación visual y criterios de rediseño

Fecha: 7 de octubre de 2026. Alcance: investigación, sin implementación ni publicación. Complementa y corrige la dirección del informe anterior. Las imágenes A, B y C son exploraciones rechazadas, no diseños aprobados.

## Resultado

El problema no se resuelve sustituyendo azul por negro, Inter por otra fuente o tarjetas por líneas. Las propuestas anteriores intentaron comprimir demasiada información en una pantalla móvil y conservaron una composición genérica de dashboard. Hay que diseñar a tamaño real, con una jerarquía útil y una identidad UNT específica.

No existe un certificado objetivo de interfaz «no hecha por IA». Sí podemos comprobar legibilidad, organización, fidelidad funcional y decisiones visuales justificadas. La valoración estética final requiere tu aprobación.

## 1. Qué falló y qué evidencia tenemos

### En las propuestas generadas

- Se pidió meter navegación, cinco indicadores, nueve horarios, gráficos y controles en una sola imagen móvil. Eso produjo texto minúsculo y una pantalla amontonada.
- Cambiar el acabado no corrigió la estructura. La versión plana seguía comprimida; la versión oscura repetía la misma composición.
- Se introdujeron ejemplos que NO deben pasar al sistema: navegación de tres destinos en lugar de siete pestañas, métricas nuevas y denominadores ficticios. Se descartan.
- Una imagen raster no demuestra cómo responde el diseño al teclado, desplazamiento, texto largo o zoom. Tampoco garantiza que preserve los datos y controles reales.

### En el código local

Se inspeccionaron `src/main.js`, `style.css`, `template.css`, `access.css` e `interaction.css`, y capturas de QA anteriores. No equivale a una auditoría autenticada actual de producción.

- Cuatro hojas de estilos se superponen. La tipografía final declarada en el tema es Segoe UI/Arial, no una Inter cargada desde internet.
- Superficies de 24 px de radio, navegación encajada y cinco métricas similares producen muchas fronteras visuales con el mismo peso.
- Hay etiquetas de navegación a `.55rem` y encabezados de tabla a `.57rem` en estilos móviles del panel: 8.8 y 9.12 px si la raíz mide 16 px. Son valores declarados, no una medición universal de todos los elementos en producción; algunas pantallas públicas tienen sobrescrituras mayores.
- El gris `#81909c` sobre blanco da 3.2798:1. Para texto normal, esa combinación no alcanza 4.5:1. Esto no certifica ni invalida por sí solo toda la aplicación: importa qué elemento utiliza efectivamente cada par.
- El dorado `#f5c52b` sobre blanco da 1.6274:1; no usarlo para texto informativo normal. Azul `#041d37` sobre ese dorado da 10.4394:1. Gris claro `#a3b4c3` sobre `#132a40` da 6.8908:1.
- Hay puntos decorativos que parecen una navegación de carrusel sin serlo, y eslóganes publicitarios en pantallas de trabajo. No aportan orientación operativa.

Los contrastes se calcularon con luminancia relativa sRGB. No se ha emitido una certificación WCAG completa.

## 2. Referencias reales: qué tomar y qué descartar

### Hevy: referencia principal para filas y lectura móvil

[Pantalla oficial examinada visualmente](https://www.hevyapp.com/wp-content/uploads/complete-Hevy-workout-1024x683.png).

Observación de la captura: el encabezado, los datos de sesión y las filas tienen funciones distinguibles. Las filas comparten alineaciones; no hay una tarjeta independiente por cada celda. El color de una fila comunica su estado. Un panel superpuesto agrupa acciones, no ocupa permanentemente el mismo espacio que la tabla.

Tomar: alineación, relación entre título y contenido, filas sin decoración repetida y estados localizados. No copiar sus métricas, datos de entrenamiento, navegación ni menú contextual: UNT tiene otras tareas y sus flujos están congelados. La captura no demuestra accesibilidad del producto completo ni su interfaz actual en todos los dispositivos.

### GymMaster Staff: referencia de contexto, no modelo del dashboard

[Artículo oficial con capturas examinadas](https://www.gymmaster.com/blog/gymmaster-staff-app/).

Es una aplicación dirigida al personal, a diferencia de muchas apps de entrenamiento para socios. La imagen publicada muestra reservas en lista, ficha del miembro y estadísticas. Su dashboard también está cargado de bloques pequeños y colores: no recomiendo copiarlo.

Tomar: la orientación al trabajo del personal y la separación entre lista, ficha y estadísticas. Descartar: su mosaico de KPIs como solución visual para UNT. La imagen es histórica; no afirmo que represente toda la versión actual.

### Linear: referencia del proceso de diseño, no plantilla móvil

[Relato oficial de su rediseño](https://linear.app/now/how-we-redesigned-the-linear-ui).

El equipo describe simplificación de encabezados y filtros, ajustes de contraste y pruebas internas. También conserva Inter para el cuerpo e incorpora Inter Display en títulos. Eso contradice la idea de que una fuente concreta convierte automáticamente una interfaz en «IA».

Tomar: iteración sobre el producto real, coherencia y contraste. No trasladar a un teléfono su densidad de escritorio ni copiar una apariencia de herramienta de desarrollo.

### TeamUp: distinguir socio de personal

[Documentación oficial de la app de reservas](https://support.goteamup.com/en/articles/9327488-an-overview-of-the-member-booking-app-w-video).

La documentación distingue la app de miembros del acceso del personal. Por eso no sirve asumir que una bonita pantalla de reservas de un socio es una referencia funcional del panel de administrador. No se inspeccionó un panel privado ni se creó una cuenta.

## 3. Buenas prácticas verificadas y aplicación a UNT

| Fuente | Criterio relevante | Aplicación propuesta, sin cambiar funciones |
| --- | --- | --- |
| [Apple HIG: layout](https://developer.apple.com/design/human-interface-guidelines/layout?changes=l_1__4&language=objc) | Agrupar por relación y dar espacio suficiente a lo importante | Diferenciar distancia dentro de un grupo y entre grupos; evitar un borde por elemento. No copiar efectos de cristal de interfaces nativas. |
| [NN/g: jerarquía visual](https://www.nngroup.com/articles/principles-visual-design/) | Tamaño, contraste, posición y espacio establecen orden | Un título identificable, controles de contexto y datos; no cinco cifras gigantes compitiendo con todo lo demás. |
| [NN/g: tablas móviles](https://www.nngroup.com/articles/mobile-tables/) | La tabla debe seguir siendo legible; indicar desplazamiento cuando haga falta | Mantener columnas y encabezados. Permitir desplazamiento dentro de la tabla, sin encoger toda la página. |
| [IBM Carbon: tablas](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Separar herramientas de tabla y evitar contenedores estrechos innecesarios | Una tabla por conjunto de datos, con su contexto; eliminar envoltorios decorativos redundantes, no campos. |
| [GOV.UK: formularios](https://design-system.service.gov.uk/patterns/question-pages/) | Preguntas relacionadas pueden compartir página; ayuda breve | Conservar el formulario de registro actual y sus grupos. No introducir un asistente de pasos ni nuevos botones de avance. |
| [Android: adaptación al espacio](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) | Adaptar al ancho y alto disponibles, no al nombre del dispositivo | Diseñar también con poca altura y teclado visible. No trasladar literalmente unidades dp de Android a CSS. |

### Accesibilidad: requisitos, no preferencias estéticas

- [Contraste WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): texto normal 4.5:1; texto grande 3:1, con las excepciones del criterio.
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): evaluar un ancho equivalente a 320 CSS px. Las tablas bidimensionales pueden necesitar desplazamiento, pero no justifican que toda la página desborde.
- [Objetivos táctiles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): AA establece 24 × 24 CSS px o las excepciones previstas. Para acciones principales proponemos 44–48 px; no afirmar que AA exige 48.
- [Espaciado del texto](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html): debe soportar ajustes del usuario sin perder contenido ni funcionalidad. Sus valores de prueba no son una obligación de utilizarlos como estilo predeterminado.

## 4. Skills y repositorios: útiles, pero no una solución automática

- [Impeccable](https://github.com/pbakaus/impeccable): repertorio de auditoría, crítica y refinamiento. Útil como lista de revisión después de fijar dirección y contexto. Su identificación de patrones no prueba autoría ni calidad estética.
- [avoid-ai-design](https://github.com/funboy322/avoid-ai-design): también cuestiona sustitutos repetidos, como crema/terracota y etiquetas monoespaciadas. Útil para detectar recetas, no para decidir por sí solo qué necesita UNT.
- [frontend-design de Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md): orientación a decisiones intencionales. No aporta automáticamente una identidad propia ni evidencia de usabilidad.
- [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): catálogo de recursos. Elegir una paleta por categoría «fitness» sigue siendo una receta si no se contrasta con las tareas.

[Discusión sobre resultados repetidos de frontend-design](https://www.reddit.com/r/ClaudeAI/comments/1t3ht2g/claude_code_frontenddesign_skill_always_outputs/) y [discusión sobre alternativas](https://www.reddit.com/r/claudeskills/comments/1v1v9qq/searching_for_better_frontenddesign_skills/): sirven como experiencias de participantes, no como estudios que demuestren qué herramienta gana.

No se instalaron ni ejecutaron estas herramientas. No adoptamos sus archivos externos como instrucciones del proyecto. Prohibir indiscriminadamente tarjetas, Inter o esquinas redondeadas sustituiría un cliché por otro. Cada elemento debe justificar su utilidad aquí.

## 5. Contrato funcional que el diseño NO puede romper

Se mantienen las dos cuentas, contraseñas, permisos, rutas, validaciones, consultas, datos, cálculos y backend. Se mantienen siete secciones con sus nombres y acceso:

| Sección actual | Qué queda intacto | Tratamiento visual propuesto |
| --- | --- | --- |
| Resumen | Cinco métricas, horario diario, reservas y gráficos existentes; periodo, turno, actualización | Separar contexto, cifras y tabla. Los gráficos continúan debajo con desplazamiento natural; no convertirlo todo en una postal de una sola pantalla. |
| Inscritos | Búsqueda, información del alumno, estado, faltas y cambio de horario | Filas con nombre legible, código y detalles alineados. Ningún dato ni acción se oculta para conseguir una captura limpia. |
| Asistencia y faltas | Ambos conjuntos, todas sus columnas y paginación | Dos grupos claramente titulados. Tabla con ancho legible y desplazamiento local si es necesario; paginación existente visible. |
| Cierres | Fecha, turno, estado, motivo, confirmación, acciones rápidas e historial | Formulario y luego historial; proximidad entre cada etiqueta y control, separación mayor entre tareas. |
| Reportes | Alcance, descargar Excel, guardar en Drive, abrir Sheet | Una zona de alcance y tres acciones diferenciadas, no tres enormes tarjetas de promoción. |
| Códigos QR | Dos QR distintos y sus descargas/enlaces | Registro y asistencia inequívocos; en móvil uno después del otro. No duplicar una pantalla genérica para ambos usos. |
| Configuración | Días, patrón del carnet, inscripciones, guardado y funciones de cuenta existentes | Grupos de ajustes por relación; explicación humana breve sin alterar validación ni credenciales. |

También se conservan bienvenida → INGRESAR → acceso, el registro con revisión actual y el check-in con cámara/ingreso manual. Registro y asistencia continúan siendo destinos separados. No agregar navegación cruzada para alumnos ni métricas inventadas.

Cambiar navegación a «Hoy / Alumnos / Más», ocultar secciones en un menú nuevo o convertir registro en varios pasos requiere una aprobación funcional adicional. Queda fuera de este rediseño visual.

## 6. Dirección visual recomendada

Esto es una especificación inicial para probar, no un diseño aprobado:

- Base: herramienta de operación universitaria y deportiva; no landing SaaS, banco digital ni afiche motivacional.
- Identidad: logo UNT existente. Azul y dorado usados por función y marca, no para pintar cada bloque. No hace falta agregar fotografías de stock, degradados, cristal, números decorativos o ilustraciones para conseguir personalidad.
- Composición: contenido continuo, alineación consistente y grupos por espacio. Bordes o superficies solo cuando aclaran un límite real; conservar separadores que ayudan a recorrer una lista.
- Tipografía: elegirla por legibilidad con español, nombres largos, códigos y cifras. Compararla con los mismos datos reales de estructura. Propuesta inicial: cuerpo 16 px, datos secundarios 14 px, títulos 22–28 px; nada de reducir información importante a 9 px. Es una hipótesis de diseño, no un estándar universal.
- Espacios iniciales: margen móvil 16–20 px; 8 px dentro de un grupo, 16 px entre controles y 24–32 px entre secciones. La diferencia entre distancias comunica relaciones; no aumentar todos los espacios indiscriminadamente.
- Indicadores: todos preservados, sin cinco tarjetas idénticas. Evaluar una composición de cifras y etiquetas en filas de una o dos columnas legibles. No inventar un indicador «principal» que cambie el significado del resumen.
- Claro y oscuro: misma estructura y acciones. Diseñar pares de color explícitos para texto, superficies, foco, estados y líneas. No invertir colores automáticamente. El dorado necesita un tratamiento diferente sobre blanco.
- Movimiento: solo para cambio de estado y orientación. No añadir animaciones de entrada a cada fila o cifra. No aumentar peso de descarga para arreglar una composición.

No recomiendo fijar una fuente o paleta definitiva antes de comparar una pantalla real con estos criterios.

## 7. Próxima etapa: cómo evitar repetir el mismo error

1. Congelar el inventario funcional anterior y capturar la pantalla actual con sus estados.
2. Prototipar UNA sección representativa —Inscritos— a 360 y 390 px de ancho, sin límite artificial de altura. Usar HTML/CSS aislado del sistema publicado, no otra lámina generada con siete pantallas comprimidas.
3. Comparar versión clara y oscura de la MISMA composición, con nombres largos, códigos de diez dígitos ficticios, horarios múltiples y estados existentes.
4. Revisar si se lee sin zoom, dónde empieza cada grupo, cómo se reconoce la sección activa y si todas las acciones continúan presentes. Aprobar esa dirección antes de extenderla.
5. Aplicar el lenguaje a Resumen, tablas y formularios; comprobar también registro y asistencia, cuya función exige composiciones distintas.
6. Solo después de aprobación visual, implementar sin modificar lógica y verificar regresiones.

### Matriz mínima de revisión posterior

- Anchos: 320, 360, 390, 768 y escritorio; altura reducida y orientación horizontal.
- Contenido: cero registros, muchos registros y paginación, nombre/carrera largos, tres horarios, errores y carga.
- Interacción: teclado, foco visible, scroll de tablas, confirmaciones, cámara rechazada, alternativa manual y conexión lenta.
- Lectura: ambos temas, contraste medido, zoom/reflow y ajustes de espaciado.
- Fidelidad: siete pestañas, dos cuentas, dos QR, mismos datos y acciones; no cambiar un cálculo para acomodar un diseño.

Estos son criterios y pruebas pendientes de un futuro prototipo. No se afirma que ya estén aprobados o ejecutados.

## 8. Autocrítica y límites

Más referencias no garantizan mejor diseño. GymMaster sirve para contexto, pero su dashboard es precisamente un ejemplo de densidad que conviene evitar. Hevy ayuda con filas móviles, no sustituye un panel administrativo. Linear aporta método, no una plantilla para UNT. Una interfaz accesible puede seguir sin gustarte: hacen falta tanto verificación como aprobación estética.

Esta investigación no modifica la aplicación. El siguiente paso útil es una comparación a tamaño real de una pantalla conservando sus funciones, no otra generación indiscriminada de imágenes.
