# Investigación para el rediseño de Gimnasio UNT

Fecha: 7 de octubre de 2026. Estado: investigación; dirección propuesta, no aprobada ni implementada.

## Conclusión

La interfaz actual depende demasiado de contenedores decorativos y jerarquías repetidas. Cambiar una fuente o instalar una skill no resolvería esa composición. La mejor ruta es elegir referencias de productos reales, definir reglas específicas para UNT y aprobar pantallas representativas antes de modificar el sistema.

Propuesta: una aplicación móvil de operación deportiva, no una landing de marketing ni un dashboard financiero. Mantener logo e identidad azul/dorado; usar filas, espacios y divisores para organizar contenido; reservar superficies elevadas para elementos que realmente se superponen. Registro y asistencia conservarán rutas y QR independientes, con composiciones distintas para tareas distintas.

## 1. Qué se comprobó en el proyecto

Inspección de `src/main.js`, `src/style.css`, `src/template.css`, `src/access.css`, `src/interaction.css`, `index.html` y recursos públicos. Revisión visual de las capturas de QA existentes `docs/simulacion/panel-movil-qa.jpg` y `panel-mes-ejemplo-qa.jpg`. Estas capturas documentan pruebas anteriores: no son una nueva auditoría visual en vivo de todas las pestañas.

- `main.js` carga cuatro hojas de estilos en secuencia. `template.css` vuelve a definir tipografía, superficies, botones, navegación y tamaños de `style.css`; `access.css` vuelve a adaptar las pantallas públicas. Las capas tienen funciones reales, pero no hay un contrato visual único explícito.
- La declaración inicial Inter termina reemplazada por Segoe UI/Arial. No se encontró carga de una fuente propia mediante `@font-face` o Google Fonts. No corresponde afirmar que la interfaz final utiliza Inter.
- `.surface` llega a radios de 24 px y `.staff-sidebar` a 23 px. Métricas, navegación, tablas, gráficos y formularios repiten cajas redondeadas. La captura móvil confirma una larga sucesión de tarjetas antes de terminar el resumen.
- Cinco métricas tienen casi el mismo peso visual. Las tarjetas de navegación ocupan espacio destacado en móvil aunque su función es únicamente cambiar de sección.
- En `template.css`, algunas etiquetas móviles llegan a `.55rem`, encabezados de tabla a `.57rem` y textos auxiliares a `.6rem`. Con una raíz de 16 px son aproximadamente 8.8, 9.1 y 9.6 px. Es un problema de lectura, no solo de estilo.
- Las frases «Tu gimnasio, al día», «Un mes. Tus horarios» y «Tu reporte, cuando lo necesites» dan tono publicitario a pantallas operativas. Un título como «Asistencia de hoy» informa mejor sobre la tarea.
- Los puntos del acceso están marcados como decoración, no como una navegación de carrusel. Parecen anunciar una función que no tienen.
- La animación comprobada es principalmente el indicador de carga; también hay transiciones de hover en estilos base. No hay evidencia para culpar a animaciones complejas de todos los problemas actuales.

Azul/dorado no es por sí mismo un defecto: coincide con el logo existente. El defecto es la falta de jerarquía y la repetición de recursos, no que un color sea popular entre herramientas de IA.

## 2. Repositorios y skills investigados

Las siguientes fuentes se consultaron como material externo. No se instalaron, ejecutaron ni adoptaron como instrucciones de este proyecto. Sus promesas no equivalen a una evaluación independiente de calidad.

### Impeccable — candidato principal para revisión

[Repositorio original de Paul Bakaus](https://github.com/pbakaus/impeccable).

Incluye procedimientos de auditoría, crítica, simplificación y pulido, y detección de patrones repetidos. Entre sus recomendaciones están evitar tarjetas anidadas, fuentes escogidas por defecto y ciertos efectos. El repositorio declara compatibilidad con agentes de programación, incluido Codex.

Uso propuesto: revisar jerarquía, consistencia y elementos innecesarios después de elegir una referencia. No dejar que genere la identidad por su cuenta. Algunas prohibiciones, como descartar todas las fuentes de sistema o exigir tintar los neutros, son preferencias del autor, no requisitos universales.

### avoid-ai-design — complemento de diagnóstico

[Repositorio original](https://github.com/funboy322/avoid-ai-design).

Examina tanto clichés iniciales como sustitutos igualmente repetidos: crema/terracota, etiquetas monoespaciadas y numeración decorativa. Incluye un escáner de código y propone documentar la dirección en `DESIGN.md`. Reconoce que espaciado, jerarquía y composición requieren observar la interfaz renderizada.

Uso propuesto: lista de revisión, no detector objetivo de autoría ni nota automática de belleza. Un aviso del escáner puede ser un falso positivo; no justifica retirar un componente útil.

### frontend-design de Anthropic — orientación general

[Fuente oficial](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md).

Propone basar el diseño en el producto y público concretos; elegir tipografía y composición con intención; evitar recursos decorativos repetidos y movimiento automático disperso. Es útil para enfocar el encargo, pero no proporciona una identidad UNT ni sustituye referencias visuales.

### UI UX Pro Max — biblioteca de apoyo

[Repositorio original](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).

Ofrece guías de UX y catálogos de estilos, paletas y tipografías. Puede ayudar a comprobar legibilidad, estados y adaptación móvil. No recomiendo aceptar automáticamente su estilo sugerido por sector: «fitness» no debe convertirse en una receta fija de tarjetas, gradientes o colores.

### Síntesis crítica

Elegiría un solo procedimiento principal, probablemente Impeccable, después de revisar su versión concreta y sus instrucciones completas. Añadiría reglas propias de UNT y una lista corta de diagnóstico. No instalaría varias skills contradictorias para que decidan simultáneamente el diseño.

## 3. Qué dicen los foros y qué no demuestran

En [esta discusión de r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1t3ht2g/claude_code_frontenddesign_skill_always_outputs/), participantes describen resultados repetidos incluso usando una skill y un brief detallado. Sugieren referencias visuales, propuestas previas y un documento específico de diseño. Son experiencias personales, no pruebas controladas; no adopto sus afirmaciones sobre herramientas como hechos técnicos.

En [esta discusión de r/claudeskills](https://www.reddit.com/r/claudeskills/comments/1v1v9qq/searching_for_better_frontenddesign_skills/), se recomienda combinar una guía general con reglas propias del proyecto y evitar acumular varias skills. Hay recomendaciones de recursos de los propios participantes, por lo que no deben tratarse como reseñas independientes.

Mi conclusión: las listas de prohibiciones ayudan a detectar hábitos, pero también pueden crear otro estilo genérico. Necesitamos reglas positivas —qué debe verse y por qué— además de lo que queremos quitar.

## 4. Referencias reales seleccionadas

### Hevy: referencia principal de organización móvil

[Guía oficial con pantallas](https://www.hevyapp.com/features/track-workouts/).

[Captura oficial inspeccionada](https://www.hevyapp.com/wp-content/uploads/complete-Hevy-workout-1024x683.png).

Observación visual: las filas de datos comparten una superficie continua, la acción activa se distingue y el menú aparece como una superposición cuando se necesita. Hay controles redondeados, pero no una caja independiente para cada número o fragmento.

Aplicación propuesta: listas de alumnos y asistencias; selección de horarios legible; estados de confirmación. No copiar funciones de entrenamiento que UNT no tiene, ni reproducir su marca, imágenes o paleta.

### Linear: referencia de jerarquía del panel

[Artículo oficial de rediseño, con comparaciones](https://linear.app/now/how-we-redesigned-the-linear-ui).

El equipo documenta reducción de ruido, alineación, densidad y pruebas de distintos tipos de vista. También explica que utiliza Inter e Inter Display: evidencia concreta de que prohibir Inter no es una solución universal.

Aplicación propuesta: separar navegación, filtros y contenido; priorizar el trabajo diario; probar la dirección con listas, formularios y reportes. Su interfaz de escritorio no debe trasladarse sin adaptación a un teléfono. La página textual se verificó; la captura remota de sus imágenes falló, por lo que no afirmo haber revisado visualmente cada comparación.

### TeamUp: referencia de tareas reales de gestión deportiva

[Documentación oficial del reporte de asistencias](https://support.goteamup.com/en/articles/9327465-reports-class-attendances-all-attendances).

Documenta filtros por estado y periodo, agrupación, vistas de tabla/gráfico y descarga. Sirve para ordenar trabajo administrativo, no para decidir la paleta ni copiar todas sus funciones. La documentación se revisó; no se accedió a una cuenta autenticada del producto.

Aplicación propuesta: distinguir claramente asistencias y faltas; filtros visibles; acciones de exportación cerca del conjunto de datos. No añadir nuevos filtros o cambiar reglas de negocio solo porque otra aplicación los tenga.

### Nike Training Club: referencia secundaria de identidad deportiva

[Página oficial](https://www.nike.com/ntc-app) y [publicación del desarrollador en App Store](https://apps.apple.com/us/app/nike-training-club/id301521403).

Puede orientar la bienvenida y el carácter deportivo, no el panel de administración. La página promocional no demuestra que su composición sirva para operar asistencias. No recomiendo añadir fotografías de stock ni copiar material de Nike; una fotografía real del gimnasio solo tendría sentido si aporta identidad y contamos con autorización para usarla.

## 5. Templates y bibliotecas visuales

- [Catalyst: demo](https://catalyst.tailwindui.com/demos/stacked) y [documentación oficial](https://catalyst.tailwindui.com/docs): kit para React/Tailwind vinculado a Tailwind Plus. Útil para estudiar controles y tablas; no recomiendo comprarlo ni migrar el proyecto actual de JavaScript/Vite solo para cambiar su apariencia. No se hizo una inspección visual completa de la demo.
- [Tabler: repositorio](https://github.com/tabler/tabler) y [demo oficial](https://preview.tabler.io/): template Bootstrap de código abierto, con licencia MIT para el proyecto y condiciones propias para dependencias. Útil como inventario de estados y componentes. Su dashboard completo también contiene muchas tarjetas: importarlo sin criterio reproduciría parte del problema.
- [Mobbin](https://mobbin.com/discover/apps/ios) y [Refero](https://refero.design/): enlaces para explorar referencias posteriormente. La consulta pública no permitió inspeccionar aquí sus colecciones; no afirmo haber revisado pantallas concretas allí ni que todo su contenido sea gratuito.

Referenciar composición no autoriza copiar assets o redistribuir un template sin revisar su licencia. Ninguna biblioteca es necesaria para la primera propuesta.

## 6. Dirección propuesta para UNT

### Identidad compartida

Mantener logo, azul institucional y dorado como acento funcional. La petición anterior de fondo azul continuo para bienvenida, ingreso y pantallas públicas sigue siendo una restricción: no volver a introducir un marco blanco exterior. El tema del panel se decidirá explícitamente; no asumir que debe cambiar a blanco o a negro.

Elegir una familia legible que cubra español y números. Evaluarla con nombres largos, códigos y horarios reales del sistema antes de fijarla. No cambiar a una fuente extravagante para demostrar originalidad. Definir una escala clara: texto de trabajo de aproximadamente 15–16 px en móvil como propuesta, no como norma obligatoria; evitar miniaturizar etiquetas para que entre más contenido.

### Composición según tarea

| Pantalla | Dirección propuesta | Elementos que sobran o deben revisarse |
| --- | --- | --- |
| Bienvenida | Logo, identificación breve y un único acceso al ingreso | Slogan genérico, puntos de falso carrusel, efectos de presentación |
| Ingreso | Formulario directo, etiquetas claras, turno y errores junto a la tarea | Icono gigante de usuario y textos redundantes |
| Asistencia | Una acción dominante: leer carnet; alternativa manual y resultado inequívoco | Instrucciones largas y decoración que compita con cámara/código |
| Registro | Datos y horarios organizados por pasos claros, con revisión final | Contenedores dentro de contenedores y consejos repetidos |
| Resumen del personal | Trabajo de hoy primero; resumen mensual secundario | Cinco tarjetas idénticas antes de la información operativa |
| Alumnos e historial | Filas alineadas; detalle del alumno separado de la lista | Toda la tabla encerrada en una tarjeta decorativa; texto diminuto |
| QR | Dos accesos inequívocos, separados por propósito y título | Numeración ornamental «Acceso 01/02» sin valor funcional |
| Reportes | Periodo, alcance, descarga/archivo y estado de la operación | Lenguaje promocional y contenido que no ayuda a exportar |
| Configuración y cierres | Agrupaciones por función; explicar consecuencias cerca de cada control | Tratar acciones sensibles como botones indistinguibles de navegación |

La coherencia consiste en compartir reglas de texto, controles, espaciado y estados, no en obligar a registro y asistencia a tener la misma estructura.

### Reglas propuestas para la implementación posterior

1. No añadir una tarjeta si separación por espacio o divisor ya resuelve el problema. No es una prohibición absoluta: QR, un modal o un elemento seleccionable pueden necesitar una superficie propia.
2. Un acento principal por estado o acción; no aplicar dorado a cada icono y cifra.
3. Eliminar numeración ornamental, sombras constantes y encabezados auxiliares que repitan el título. Conservar pasos numerados cuando realmente indiquen una secuencia.
4. Textos funcionales: «Asistencia de hoy», «Inscritos de octubre», «Descargar Excel». Mantener explicaciones sobre faltas, cierres y confirmaciones donde sean necesarias.
5. Animación solo para expresar una respuesta o cambio de estado; respetar reducción de movimiento. Sin números animados ni entradas de cada tarjeta.
6. Navegación móvil que no obligue a recorrer una fila de siete tarjetas grandes. Comparar menú compacto frente a pocos destinos principales con acceso al resto, sin ocultar funciones esenciales.
7. Conservar foco de teclado y estados accesibles. No usar solo color para errores, asistencia confirmada o bloqueo.
8. No modificar endpoints, datos, autenticación, contraseñas, horarios, reglas de faltas, cierre mensual ni destinos de QR durante el rediseño.

Accesibilidad: [WCAG contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) establece 4.5:1 para texto normal y 3:1 para texto grande, con excepciones definidas. [WCAG tamaño de objetivo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) establece 24×24 CSS px o condiciones alternativas/excepciones; proponer controles de aproximadamente 44–48 px para uso táctil no equivale a decir que WCAG AA exige ese tamaño para todos los controles.

## 7. Secuencia antes de implementar

1. Confirmar una dirección tomando Hevy como referencia móvil y los principios de jerarquía de Linear, sin clonar ninguno.
2. Presentar dos alternativas visuales realmente distintas de tres pantallas: asistencia, registro y resumen del personal. Usar datos ficticios representativos; todavía fuera del flujo productivo.
3. Elegir una alternativa. Documentar reglas concretas del proyecto en `DESIGN.md`: tipografía cargada, colores por función, espaciado, radios, navegación, errores, ejemplos aprobados y excepciones.
4. Implementar componentes y consolidar estilos; no agregar una quinta capa global que tape las cuatro anteriores. Hacerlo por pantallas, conservando contratos funcionales.
5. Revisar todas las vistas: vacío, ocupado, carga, error, éxito, código inválido, fuera de horario, inscrito/bloqueado y sesión expirada. Ningún mensaje debe confundirse con otro por su diseño.
6. Probar 360/390/768/1280 px, zoom y teclado, nombres largos, tablas con muchos registros, cámara/permisos denegados y los dos QR. Comparar capturas y ejecutar regresiones funcionales antes de publicar.

## 8. Límites y estado de esta investigación

No existe una prueba objetiva que certifique que una interfaz «no parece IA». Esa valoración requiere observar pantallas y aprobación humana. Los repositorios aportan procedimientos, no garantías; los foros aportan experiencias, no benchmarks.

No se eligió todavía una fuente definitiva, no se consiguió una fotografía propia del gimnasio y no se hizo una nueva revisión autenticada de todas las pestañas en producción. Esto no impide diseñar la primera propuesta, pero debe quedar explícito.

Esta fase solo añadió el presente informe. No cambió la aplicación, no instaló skills o paquetes, no publicó commits y no modificó Google ni Vercel.
