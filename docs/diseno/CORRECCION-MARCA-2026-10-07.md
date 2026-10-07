# Corrección de marca e iconos

## Resultado

- Engranaje de configuración completo dentro del viewBox 24×24, sin recorte.
- Emblema amarillo sin letras ni rectángulo azul en cabecera, barra lateral y bienvenida.
- Favicon transparente con el mismo emblema; WebP y respaldo ICO.
- No se modificaron formularios, reglas, cuentas ni contraseñas en esta corrección.
- Los originales `public/logo.png`, `public/logo.webp` y el PNG de Downloads se conservaron.

## Método y archivos

La edición generativa se descartó por residuos visibles. Con autorización explícita del usuario se extrajo el amarillo directamente del PNG original usando `scripts/extract-brand-mark.mjs`: separación por crominancia R-B y alfa en la transición de los bordes. No se redibujó el emblema. `scripts/prepare-brand-assets.mjs` redimensiona y comprime el resultado.

| Archivo | Dimensiones | Bytes |
|---|---:|---:|
| public/logo-mark.webp | 384×384 | 41 846 |
| public/logo-mark-small.webp | 96×96 | 6 538 |
| public/favicon.webp | 64×64 | 3 706 |
| public/favicon.ico | 32×32 | 1 963 |

El recorte a tamaño original se conserva en `docs/diseno/logo-emblema-transparente.png`. Las páginas ya no solicitan el logo anterior de 882 908 bytes.

## Verificación local

- 131 pruebas aprobadas, 0 fallidas.
- `npm run build`, `npm run check` y `git diff --check`: correctos.
- Logo cargado con fondo CSS transparente en registro y panel, temas claro y oscuro.
- Registro móvil verificado a 390×844 sin desbordamiento horizontal.
- Favicon ICO y WebP responden HTTP 200 con su tipo de imagen correcto; ambos declarados en el documento HTML.
- Evidencias reales del navegador en `interfaz-implementada/marca-panel-verificada.jpg`, `marca-panel-oscuro.jpg` y `marca-registro-movil.jpg`.

No se publicó ni se verificó este cambio en Vercel. Esta validación corresponde al código y al servidor local aislado con datos ficticios.
