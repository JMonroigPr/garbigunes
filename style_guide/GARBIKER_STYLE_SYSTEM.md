# GARBIKER STYLE SYSTEM
## Sistema unificado para informes, decks y productos digitales · v2.0

## 1. Posicionamiento visual

Garbiker necesita una identidad reconocible como operador ambiental y, al mismo tiempo, coherente con su condición de empresa pública de la Diputación Foral de Bizkaia.

La solución se organiza en dos capas:

- **Verde Garbiker:** identidad principal de producto, navegación, acciones, datos positivos y comunicación ambiental.
- **Rojo Bizkaia:** vínculo institucional, co-marca, firma foral y criticidad real.

El rojo no desaparece, pero deja de dominar las interfaces operativas. El verde no modifica el logotipo oficial.

## 2. Tokens canónicos

```css
:root {
  --primary:       #0E6849;
  --primary-deep:  #084B36;
  --primary-mid:   #3F8E62;
  --primary-light: #B7D56C;
  --primary-soft:  #E7F3EC;

  --bizkaia-red:      #DA291C;
  --bizkaia-red-deep: #B51F28;
  --bizkaia-red-soft: #FBE8E6;

  --ink:    #1F2925;
  --body:   #46534D;
  --muted:  #66716C;
  --line:   #D6DED9;
  --canvas: #F3F5F2;
  --surface:#FFFFFF;
  --dark:   #173D31;
  --deep:   #0B2B22;

  --info:    #0878CB;
  --success: #147A4B;
  --warning: #A95C00;
  --critical:#B42318;
  --nodata:  #70777D;

  --font: Frutiger, "Segoe UI", Arial, sans-serif;
}
```

## 3. Reglas de color

- Acción primaria, navegación activa y títulos de producto: `--primary`.
- Fondos oscuros y encabezados de tabla: `--primary-deep` o `--deep`.
- Highlights positivos: `--primary-light`, sin usarlo para texto pequeño sobre blanco.
- Co-marca y referencia a Diputación: `--bizkaia-red`.
- Crítico: `--critical`, siempre acompañado por icono o texto.
- Colores de residuos: solo para fracciones, nunca para estados de interfaz.

## 4. Marca y logos

- El logo siempre conserva su proporción.
- Prohibido `object-fit: cover` en logos.
- Usar `display:block; width:auto; height:auto; max-width:100%`.
- El contenedor del logo no debe tener altura fija que recorte el contenido.
- No reconstruir escudos, hojas, firmas o wordmarks.
- El lockup tipográfico de la demo es provisional.
- El verde del sistema no se aplica al master corporativo salvo variante oficial.

```css
.logo-master img,
.logo-master svg {
  display:block;
  width:auto;
  height:auto;
  max-width:100%;
  object-fit:contain;
}
```

## 5. Tipografía

- Fuente institucional: Frutiger, únicamente cuando exista licencia y archivos válidos.
- Fallback autónomo: Segoe UI, Arial, sans-serif.
- Pesos: 400, 600 y 700.
- KPIs y tablas: `font-variant-numeric: tabular-nums`.
- Evitar monospace salvo identificadores técnicos.

## 6. Fotografía

La imagen debe explicar el servicio:

1. Instalaciones y seguridad.
2. Personal en acción.
3. Flota, rutas y logística.
4. Clasificación, reciclaje y valorización.
5. Territorio de Bizkaia.
6. Ciudadanía, educación e innovación circular.

No usar fotografías de naturaleza genérica como sustituto de la operación. Mantener luz natural, tratamiento documental y espacio útil para texto.

## 7. Layout por formato

### Informe

- A4 vertical o apaisado.
- Portada con fotografía operativa y bloque verde profundo.
- Tablas repetibles, fuentes, periodo y cobertura visibles.
- El rojo aparece en co-marca o criticidad, no como fondo dominante.

### Deck

- 16:9, una idea principal por slide.
- Portada verde + fotografía real.
- Slides de contenido predominantemente blancas.
- Verde para mensaje y navegación, rojo para firma institucional.

### Dashboard

- Fondo mineral y cards blancas.
- Sidebar o topbar en verde profundo.
- Densidad alta, radios moderados y estados visibles.
- Alertas críticas en rojo con texto, no solo color.

## 8. Componentes

### Botones

```css
.btn-primary { background:#0E6849; color:#fff; }
.btn-primary:hover { background:#084B36; }
.btn-secondary { background:#fff; color:#084B36; border:1px solid #0E6849; }
.btn-institutional { background:#DA291C; color:#fff; }
```

`btn-institutional` se reserva para enlaces o acciones explícitamente forales, no para la acción diaria del producto.

### KPIs

- Valor: 32–48 px, peso 700.
- Label: 11–13 px, peso 600.
- Siempre: unidad, periodo, fuente y cobertura cuando aplique.
- Tendencia positiva: verde.
- Riesgo o incumplimiento: rojo crítico.

### Tablas

- Cabecera verde profundo.
- Filas blancas con divisores suaves.
- Primera columna fija en tablas anchas.
- Estados con icono + texto.
- Cifras alineadas a la derecha y tabulares.

## 9. Iconografía

- Línea de 1,8–2 px.
- 20, 24 y 32 px como tamaños base.
- Verde para normal/activo.
- Azul para información.
- Ámbar para atención.
- Rojo para crítico.
- No usar emojis.

## 10. Accesibilidad

- Contraste mínimo WCAG AA.
- `focus-visible` de 3 px con `--primary-light` sobre fondos oscuros o `--primary` sobre blanco.
- No ocultar contenido esencial en móvil.
- Preparar textos para castellano y euskera.
- Respetar `prefers-reduced-motion`.
- Alt descriptivo en imágenes informativas y `alt=""` en decorativas.

## 11. Assets incluidos

```text
assets/
├── 01_hero_garbigune.jpg
├── 02_garbigune_site.jpg
├── 03_personal_operacion.jpg
├── 04_flota_logistica.jpg
├── 05_clasificacion_materiales.jpg
├── 06_territorio_bizkaia.jpg
├── 07_marca_publica_referencia.jpg
├── 08_garbigune_banner.jpg
├── 09_flota_banner.jpg
├── 10_territorio_banner.jpg
├── 11_fracciones_residuos_publica.png
└── 12_operaciones_mosaico.jpg
```

## 12. Prompt de activación

```text
Actúa como senior UI/UX developer del GARBIKER STYLE SYSTEM v2.0.
Usa GARBIKER_STYLE_SYSTEM.md como referencia obligatoria.

Genera un HTML single-file, autónomo y production-ready.

FORMATO
[Informe vertical / Informe apaisado / Deck 16:9 / Dashboard]

CONTENIDO
[Pegar contenido y datos]

ASSETS
Usa la biblioteca incluida. Prioriza instalaciones, operación, flota,
personal y territorio. No uses logos fotográficos como logo de interfaz.

REGLAS
- Verde Garbiker #0E6849 como identidad principal.
- Rojo Bizkaia #DA291C solo para co-marca, vínculo institucional y criticidad.
- No recortar logos: object-fit:contain, width:auto, height:auto.
- Frutiger solo si se proporciona; fallback Segoe UI / Arial.
- Estados con icono + texto.
- Castellano y euskera preparados.
- Sin dependencias externas.
- HTML completo, sin TODOs ni placeholders de contenido.
```

## 13. Checklist final

- [ ] Verde Garbiker domina interfaz y navegación.
- [ ] Rojo Bizkaia aparece como co-marca o criticidad, no como acción genérica.
- [ ] Ningún logo usa `object-fit:cover`.
- [ ] Ningún logo está dentro de un viewport más pequeño que su dibujo.
- [ ] Fotografías operativas, no naturaleza genérica.
- [ ] Datos con unidad, periodo y fuente.
- [ ] Contraste AA.
- [ ] Sin scroll horizontal en 390, 768, 1440 y 1920 px.
- [ ] HTML autónomo y assets disponibles por separado.
- [ ] Master oficial pendiente claramente identificado.
