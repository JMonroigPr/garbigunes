# GARBIKER DATA UI

## Complemento operativo del GARBIKER STYLE SYSTEM v2.0

**Ámbito:** visor Garbigunes y futuros productos analíticos de Garbiker.

**Jerarquía:** este documento complementa `GARBIKER_STYLE_SYSTEM.md`; no sustituye sus reglas de marca, tipografía, accesibilidad, fotografía ni color institucional.

## 1. Propósito

Este documento fija cómo se representan, comparan y exploran datos operativos. Su objetivo es que cada eje del visor mantenga el mismo lenguaje visual y de interacción, incluso cuando cambien sus métricas, fuentes o visualizaciones.

Una gráfica debe responder a una pregunta operativa concreta. Los componentes muestran evidencia y cobertura; no convierten una correlación en una causa ni un outlier en un error confirmado.

## 2. Tokens de datos

Usar estos tokens junto con los tokens canónicos del sistema base.

```css
:root {
  /* Dominios de datos: no reutilizar para acciones de interfaz. */
  --data-entries: #0878CB;       /* Entradas AW */
  --data-outputs: #0E6849;       /* Salidas transportadas */
  --data-comparison: #6B5B95;    /* Comparativa homologada */
  --data-fleet: #A95C00;         /* Contexto de flota */
  --data-resources: #7A4E2D;     /* Recursos y cobertura */
  --data-circularity: #0B7A75;   /* Circularidad cuando tenga datos */

  --data-positive: #147A4B;
  --data-attention: #A95C00;
  --data-critical: #B42318;
  --data-neutral: #66716C;
  --data-no-data: #DCE3DF;
  --data-grid: #E8EEEA;

  --data-radius: 6px;
  --data-control-height: 36px;
  --data-chart-height: 320px;
  --data-chart-height-mobile: 300px;
}
```

Reglas:

- `--primary` sigue siendo navegación, acciones y foco; no debe confundirse con una serie de datos salvo que esa serie sea **Salidas transportadas** y la leyenda lo declare.
- El rojo Bizkaia y `--data-critical` indican criticidad, nunca una categoría de residuo o una serie normal.
- Cero es gris suave; dato ausente usa una celda o marca vacía con explicación. Nunca son equivalentes.
- Todo estado codificado por color tiene texto, icono o patrón complementario.

## 3. Taxonomía de fuentes y cobertura

Cada tarjeta, gráfico, tabla o mapa incluye un chip de fuente, situado junto al título:

| Chip | Color | Significado |
| --- | --- | --- |
| Entradas AW | Azul `--data-entries` | Residuo depositado y registrado en un Garbigune. |
| Salidas transportadas | Verde `--data-outputs` | Pesada/servicio de salida de transporte. |
| Comparativa homologada | Violeta `--data-comparison` | Entradas y salidas comparadas por familias y pesos de equivalencia. |
| Contexto flota | Ámbar `--data-fleet` | Incidencias o disponibilidad usadas solo como contexto. |
| Recursos y cobertura | Marrón `--data-resources` | Refuerzos, personal o cobertura. |

Los chips de cobertura se muestran junto a la fuente, no en el pie:

- **Completa:** periodo y filtros con cobertura conocida.
- **Parcial:** incluye causa corta, por ejemplo `Mes parcial` o `12% SIN RUTA`.
- **Muestra baja:** menos de 10 servicios comparables para ratios o percentiles.
- **No comparable:** no hay equivalencia activa, denominador o periodo compatible.

## 4. Paleta de residuos

Los residuos usan colores estables en todos los ejes. El orden visual sigue las toneladas del filtro activo; el color no cambia al reordenar.

| Residuo / familia | Color |
| --- | --- |
| Escombros / RCD | `#4E8B7A` |
| Maderas | `#8A6D3B` |
| Rechazo | `#6F6F73` |
| Voluminosos | `#6B5B95` |
| Plásticos / envases | `#0878CB` |
| Jardinería | `#5E8F3E` |
| RAEES | `#197D87` |
| Metales | `#546E7A` |
| Papel / cartón | `#3977B8` |
| Vidrio | `#16875D` |
| Otros | `#9AA3A7` |

Máximo ocho categorías visibles en una leyenda inicial. Las restantes se agrupan como **Otros** y se desglosan en modo Analista o en tabla. No usar la paleta de residuos para estados de interfaz.

## 5. Reglas de gráficos

### Barras y rankings

- Barras horizontales para rankings con nombres largos; verticales solo para periodos o pocas categorías.
- Etiqueta de valor al final de la barra para el top visible; evitar etiquetar todas si compromete lectura.
- El eje es control de orden: pulsar alterna mayor/menor; el estado se muestra con flecha y texto accesible.
- `Ver más` expande la lista sin cambiar el filtro ni sustituir el gráfico.

### Barras apiladas

- Usar para composición temporal o total; no más de ocho segmentos visibles.
- Orden de pila y leyenda: mayor a menor volumen en el periodo activo.
- Eje secundario solo para una serie de otra unidad, por ejemplo servicios. Debe tener título, color de la línea y escala visibles.
- Leyenda debajo o a la derecha con espacio reservado; nunca sobre ejes, barras o valores.

### Líneas y evolución temporal

- El tiempo se ordena cronológicamente por defecto; el usuario puede invertir el orden mediante un control discreto.
- Mostrar meses parciales mediante etiqueta y patrón/atenuación, no solo color.
- Las comparativas MoM y YoY usan días equivalentes o no se muestran.

### Scatter

- Ejes con unidad y denominador explícito: `kg/servicio`, `servicios`, `días activos`.
- Tamaño máximo de burbuja: 28 px; mínimo: 6 px. El tamaño representa una variable solo cuando se declara en subtítulo.
- Color por una única variable semántica, normalmente confianza, tipo dominante o estado de cobertura.
- Línea de mediana y cuadrantes solo en modo Analista; incluir explicación metodológica.

### Matrices y heatmaps

- Filas y columnas se seleccionan junto a sus respectivos ejes.
- Cero: fondo gris muy claro sin cifra. Dato no disponible: celda vacía con patrón o tooltip explicativo.
- Primera columna fija, cabecera fija y números alineados a la derecha.
- La escala se reinicia con cada filtro y se declara en el subtítulo.

### Mapas

- Base cartográfica neutra; los polígonos representan intensidad y los puntos tipo de Garbigune.
- Evitar mezclar más de dos codificaciones simultáneas en un mismo mapa.
- Un clic fija selección reversible y sincroniza tabla, chips y gráficos compatibles.
- Incluir siempre leyenda, unidad, periodo y aviso de cobertura geográfica.

## 6. Tooltips, selección y filtros

Todo tooltip sigue este orden:

1. Entidad y periodo.
2. Valor principal y unidad.
3. Denominador o métrica derivada cuando aplique.
4. Participación, comparativo o referencia.
5. Cobertura y fuente.

Ejemplo: `GETXO · 2026-05 · 3,2 t · 12 servicios · 267 kg/servicio · cobertura completa · Salidas transportadas`.

Interacción común:

- Clic en marca, barra, segmento o fila: aplica una selección local visible como chip.
- Segundo clic o eliminación del chip: libera la selección.
- La leyenda permite activar/desactivar residuos; una categoría desactivada queda atenuada, no desaparece.
- La selección de residuo sincroniza todos los gráficos compatibles y el panel global.
- No duplicar filtros de fecha, Garbigune o residuo dentro de gráficos.

## 7. Tarjetas, conclusiones y estados

### Tarjetas KPI

- Máximo cuatro en modo Ejecutivo; unidad, periodo, fuente y cobertura siempre visibles.
- La cifra usa números tabulares y no debe depender solo de un color de tendencia.
- Un delta debe indicar base de comparación y días equivalentes.
- Pulsar una tarjeta revela desglose dentro de la misma pestaña, no una página nueva.

### Conclusiones automáticas

- Entre tres y cinco por eje, ordenadas por impacto y confianza.
- Estructura: evidencia observada + comparación + acción de revisión sugerida.
- Nunca atribuyen causalidad, rendimiento individual ni error confirmado.
- Cada una enlaza a la visualización o tabla que la respalda.

### Estados obligatorios

| Estado | Mensaje y tratamiento |
| --- | --- |
| Cargando | Skeleton de dimensiones estables; no spinner aislado. |
| Sin datos | Explicar filtros activos y ofrecer restablecer o ampliar periodo. |
| Error de conexión | Indicar que no se pudo actualizar y conservar el último dato fechado si existe. |
| Cobertura parcial | Badge con causa, impacto y recomendación de lectura. |
| Mes parcial | Mostrar días cubiertos; ocultar delta no comparable. |
| Muestra insuficiente | Mostrar total, pero ocultar ratio, percentil o score derivado. |

## 8. Tablas operativas

- Tres densidades: Ejecutiva, Operativa y Analista. La pestaña decide la predeterminada; el usuario puede cambiarla.
- Cabecera fija; primera columna fija en tablas anchas; scroll horizontal contenido en móvil.
- Números a la derecha, texto a la izquierda, fechas centradas y `font-variant-numeric: tabular-nums`.
- Orden y filtro de columna visibles; orden estable con indicador textual además de flecha.
- Filas seleccionables, estado de foco visible y exportación del subconjunto filtrado.
- Truncar texto largo con tooltip o detalle expandible; no aumentar la altura de toda la tabla de forma impredecible.

## 9. Layout y responsive

| Ancho | Comportamiento |
| --- | --- |
| >= 1280 px | Panel lateral persistente, KPI en cuatro columnas, dos gráficos principales por fila. |
| 768-1279 px | Panel plegable, KPI 2x2, gráficos principales en una columna, tablas con primera columna fija. |
| < 768 px | Filtros como cajón, una columna, altura mínima de gráfico 300 px, leyenda como lista bajo el gráfico. |

- Radio por defecto: 6 px. Las tarjetas no se anidan dentro de tarjetas.
- Espaciado vertical de sección: 24 px; entre componentes: 16 px; dentro de componente: 12-18 px.
- Títulos compactos dentro de paneles. El tamaño hero se reserva para portadas, no dashboards.
- No usar `clamp()` para tipografía de controles, ejes, tablas o paneles compactos.

## 10. Accesibilidad y localización

- Contraste AA mínimo; verificar también colores de categorías y estado de foco.
- Todo control es navegable por teclado; tooltip disponible por foco además de hover.
- Respetar `prefers-reduced-motion`; no usar animaciones para transmitir información esencial.
- Formato por defecto `es-ES`: `3.250,4 t`, `267 kg/servicio`, `12,5 %`, fechas `may. 2026`.
- Preparar cadenas para castellano y euskera; no incrustar texto de interfaz en imágenes o canvas inaccesible.
- Los gráficos deben tener resumen textual accesible de la tendencia y controles de descarga/tabulación cuando sean complejos.

## 11. Criterios de revisión antes de publicar un eje

- La fuente, periodo, unidad y cobertura se leen sin hover.
- Entradas, salidas y comparativas homologadas se distinguen con chip y color semántico.
- Leyenda, ejes y etiquetas no se solapan en 390, 768, 1440 y 1920 px.
- Cero, nulo, parcial y no comparable se distinguen.
- La misma entidad conserva color y comportamiento entre ejes.
- Los filtros globales y las leyendas sincronizan todas las vistas compatibles.
- No hay cálculos analíticos pesados ni secretos en el navegador.

## 12. Aplicación al visor piloto

Antes de desarrollar una visualización de Flujos y recogidas:

1. Aplicar los tokens canónicos de `GARBIKER_STYLE_SYSTEM.md` al shell.
2. Aplicar este documento a los componentes analíticos.
3. Declarar el dominio de datos en cada panel.
4. Verificar estados de cobertura y comportamiento móvil antes de añadir más gráficos.
