# Garbiker Style System · v2.0

Paquete consolidado para crear informes, presentaciones HTML y productos digitales de Garbiker.

## Archivos principales

- `GARBIKER_STYLE_GUIDE.html`: guía visual autónoma, sin dependencias externas.
- `GARBIKER_STYLE_SYSTEM.md`: reglas, tokens, componentes, prompts y checklist.
- `GARBIKER_DATA_UI.md`: complemento operativo para dashboards, gráficas, tablas, mapas, filtros y estados de datos.
- `assets/`: biblioteca visual preparada para sustitución por masters oficiales.

## Decisión principal de v2

El **verde Garbiker** pasa a ser el color principal de interfaz y comunicación operativa. El **rojo Bizkaia** se mantiene como vínculo institucional, co-marca y señal crítica. Esta combinación permite que Garbiker tenga una expresión propia sin perder la pertenencia a la Diputación Foral de Bizkaia.

## Logos

Se han eliminado las imágenes de logo que estaban recortadas en origen. La guía no usa `object-fit: cover` en ninguna firma. Mientras no exista un SVG oficial, se utiliza un lockup tipográfico provisional claramente separado del master corporativo.

Sustitución futura recomendada:

1. Reemplazar `.brand-lockup` por el SVG oficial de Garbiker + Bizkaia.
2. Mantener `width:auto`, `height:auto`, `object-fit:contain` y el área de respeto del manual.
3. No recolorear el master con el verde del producto.

## Biblioteca visual

La carpeta incluye 12 assets: hero, instalaciones, personal, flota, clasificación, territorio, marca pública de referencia, banners, mosaico, infografía de fracciones . Las imágenes no oficiales son assets de maquetación sustituibles.

## Estado

Sistema final operativo para prototipos, propuestas e informes internos. La publicación corporativa externa requiere validar el SVG, tipografía licenciada y biblioteca fotográfica oficial.

Para el visor Garbigunes se aplican conjuntamente `GARBIKER_STYLE_SYSTEM.md` y `GARBIKER_DATA_UI.md`: la primera define identidad y componentes generales; la segunda fija el comportamiento de la interfaz analítica.
