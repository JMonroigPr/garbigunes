# Contrato de producto y datos: Flujos y recogidas

**Estado:** listo para implementar (v0.1)  
**Eje:** Flujos y recogidas  
**Fuentes de verdad:** Supabase, esquema `analytics`; configuraciones versionadas en `config/reference`.

## 1. Propósito y decisión

Este eje convierte los registros de entrada y de transporte de Garbigunes en una lectura operativa: dónde se concentra la actividad, si la cadencia de salida acompaña a la demanda, qué rutas presentan carga o variabilidad inusuales y qué casos requieren revisión.

Debe facilitar estas decisiones, en este orden:

1. Priorizar Garbigunes, fracciones y rutas que requieren revisión de frecuencia.
2. Revisar secuencia de ruta, agrupación de puntos o vehículo cuando la carga media o su variabilidad lo justifican.
3. Investigar diferencias persistentes entre entradas y salidas antes de intervenir: periodos, equivalencias, stock operativo o calidad del registro.
4. Identificar limitaciones de cobertura que impiden concluir con confianza.

No debe recomendar cierres, sanciones ni cambios de frecuencia de forma automática.

## 2. Alcance y límites

| Incluye | Excluye / límite explícito |
| --- | --- |
| Entradas AW, salidas transportadas, servicios, residuos, Garbigunes, rutas, bases y vehículos. | Captación territorial por CP/municipio: pertenece al eje **Captación territorial**. |
| Comparativa entradas-salidas por familia AW homologada. | Especialización/gestores autorizados: pertenece al eje **Especialización de residuos**. |
| Contexto de incidencias de flota cuando cubra el mismo periodo. | Personal, bajas y refuerzos: pertenece al eje **Recursos y cobertura**. |
| Presión operativa estimada y cadencia de salidas. | No se afirma nivel de llenado ni ocupación real sin capacidad de contenedor, inventario o sensores. |

## 3. Taxonomía visible

Cada KPI, tabla o gráfico declara una de estas etiquetas:

- **Entradas AW:** residuo depositado y registrado en un Garbigune.
- **Salidas transportadas:** pesada asociada a una salida de transporte.
- **Comparativa homologada:** contraste entre entradas AW y salidas, mediante equivalencias activas de familia AW.
- **Contexto de flota:** incidencias que ayudan a interpretar actividad, sin establecer causalidad automática.

Los filtros no aplicables se muestran como informativos; nunca se ignoran en silencio.

## 4. Definiciones contractuales

| Término | Definición en el producto | Fórmula / observación |
| --- | --- | --- |
| Entrada AW | Línea registrada de residuo depositado en un Garbigune. | Una visita puede generar varias líneas; `entries` no equivale a visitas salvo que exista una clave fiable. |
| Salida / servicio | Registro de pesada transportada desde un Garbigune o ruta. | Una fila de `fact_salidas_transporte` equivale a un servicio de salida para este eje. |
| Viaje | Sinónimo operativo de servicio de salida. | Se usa en etiquetas no técnicas. |
| Toneladas de entrada/salida | Masa registrada dentro del periodo y filtros activos. | `SUM(kg) / 1.000`. |
| Kg/servicio | Carga media de salida. | `SUM(kg salida) / COUNT(servicios salida)`. No mide ocupación del vehículo. |
| Días activos | Días distintos con al menos un servicio de salida. | `COUNT(DISTINCT service_date)`. |
| Cadencia | Separación temporal entre salidas comparables. | Días desde la última salida o servicios/mes; declarar siempre el denominador. |
| Balance estimado | Diferencia entre entradas AW y salidas equivalentes. | `kg_entrada - kg_salida_ponderada`; contraste de registros, no inventario ni stock exacto. |
| Presión operativa estimada | Señal de priorización que combina entrada, cadencia y referencia histórica. | Solo se habilita cuando cobertura y muestra sean suficientes. Nunca se denomina llenado. |

## 5. Fuentes y grano

| Relación | Grano | Uso permitido |
| --- | --- | --- |
| `analytics.fact_captacion_aw` | Agregado mensual por Garbigune, CP, residuo/familia, usuario y unidad. | Entradas, composición AW y comparativa por familia. El CP no se muestra en este eje. |
| `analytics.fact_salidas_transporte` | Una pesada/servicio de salida. | Salidas, servicios, carga media, ruta, base, vehículo y Garbigune. |
| `analytics.dim_garbigunes` | Un Garbigune o punto móvil. | Tipo de punto y normalización mediante `site_key`. |
| `analytics.fact_incidencias_flota` | Una incidencia. | Contextualización temporal de actividad de flota. |
| `analytics.config_residuos_salida_aw_equivalencias` | Una equivalencia salida-familia AW. | Comparativa homologada; se aplican `allocation_weight` y `active`. |
| `analytics.config_site_aliases` | Un alias operativo. | Normalización de punto y control de `SIN RUTA`/puntos no fijos. |

Las vistas de partida son `v_salidas_monthly`, `v_aw_monthly`, `v_salidas_aw_family_monthly`, `v_aw_vs_salidas_family_monthly`, `v_incidencias_monthly` y sus variantes `v_public_*` cuando la consulta proceda del navegador.

## 6. KPIs obligatorios

| KPI | Dominio | Periodo por defecto | Regla de presentación |
| --- | --- | --- | --- |
| Entradas (t) | Entradas AW | Últimos 12 meses completos | Mostrar cobertura de familias y cualquier exclusión de peso anómalo. |
| Salidas (t) | Salidas transportadas | Últimos 12 meses completos | Incluir número de servicios como denominador contextual. |
| Servicios de salida | Salidas transportadas | Últimos 12 meses completos | No llamar recogidas completas ni visitas. |
| Kg/servicio | Salidas transportadas | Últimos 12 meses completos | Ocultar si hay menos de 10 servicios comparables. |
| Balance estimado (t) | Comparativa homologada | Últimos 12 meses completos | Mostrar solo con equivalencias activas y cobertura suficiente. |
| Presión operativa estimada | Comparativa / salida | Periodo activo | Fase 2; mostrar como “no disponible” mientras no se acuerde su fórmula y umbrales. |

Todo delta MoM o YoY compara días equivalentes. Si no es posible, se etiqueta **Mes parcial - lectura orientativa** y se oculta el delta no comparable.

## 7. Vistas iniciales de producto

1. **Pulso operativo:** entradas, salidas, servicios y kg/servicio mensuales; cronología ascendente por defecto.
2. **Puntos bajo presión:** ranking de Garbigunes por entrada, salida, servicios, carga media o balance, con muestra y cobertura visibles.
3. **Rutas de carga variable:** scatter de kg/servicio frente a servicios; tamaño por toneladas y color por residuo dominante o confianza.
4. **Balance por familia:** entradas AW frente a salidas homologadas, por Garbigune y familia.
5. **Excepciones de servicio:** tabla exportable de pesos, cadencias, variaciones, `SIN RUTA` y baja cobertura.

Modo **Ejecutivo**: conclusiones automáticas, cuatro KPIs y las tres primeras vistas.  
Modo **Analista**: añade balance, excepciones, metodología, filtros avanzados y tabla de detalle.

## 8. Filtros y comportamiento

El panel global aplica intervalo, residuo, Garbigune, ruta/base, vehículo y conductor. Conserva los filtros compatibles al navegar entre ejes.

- Los filtros de residuo sincronizan las leyendas: deseleccionado queda atenuado, no desaparece.
- Ruta, base, vehículo y conductor se aplican solo a salidas; en entradas se señalan como no aplicables.
- La comparativa entradas-salidas usa familias AW; no mezcla residuos sin equivalencia activa.
- Garbigunes móviles se distinguen de los fijos en selector, tabla y lectura de cobertura.
- Clic en una marca, barra o celda fija un filtro local reversible; el chip visible permite retirarlo.

## 9. Reglas de confianza y outliers

| Caso | Regla inicial | Tratamiento |
| --- | --- | --- |
| Peso atípico | Percentil 5/95 de kg/servicio por ruta y residuo, mínimo 10 servicios. | Prioridad de revisión; no error confirmado. |
| Cadencia atípica | Días desde última salida sobre p90 de punto/familia con entrada relevante. | Revisar calendario, festivos, ruta y disponibilidad. |
| Cambio mensual | Desviación robusta frente a días equivalentes e histórico. | Contrastar con operación e incidencias. |
| Balance persistente | Diferencia homologada durante N meses completos. | Revisar cortes, equivalencias y stock operativo. |
| Cobertura insuficiente | Mes parcial, muestra pequeña, `SIN RUTA` o residuo no homologado. | Confianza media/baja; evitar recomendaciones directas. |

La confianza es **alta** con muestra suficiente, cobertura completa y equivalencias activas; **media** con una limitación relevante; **baja** con varias limitaciones.

## 10. Criterios de aceptación

- Entradas, salidas y comparativa se distinguen visual y metodológicamente.
- Cada cifra muestra unidad, periodo, denominador y fuente/taxonomía.
- Los filtros globales actualizan todas las vistas compatibles y exponen las incompatibilidades.
- Series temporales son cronológicas y los meses parciales se tratan de forma explícita.
- Los outliers enlazan a evidencia, regla, impacto y acción de revisión.
- No hay KPI de llenado, visitas ni inventario si no hay una fuente que los soporte.
- Las vistas consumen agregados/vistas Supabase; el navegador no recalcula lógica analítica pesada.

## 11. Supuestos pendientes de validación operativa

Estos supuestos no bloquean la primera versión, pero deben resolverse antes de activar indicadores avanzados:

1. Confirmar si existe una clave fiable de visita AW; mientras tanto, se hablará de líneas o entradas registradas, no de visitas.
2. Confirmar capacidades, inventario o sensores por contenedor/punto; hasta entonces no se habilita llenado ni nivel de ocupación.
3. Acordar el umbral y la fórmula de presión operativa estimada con responsables de operación.
4. Validar la actualización de rutas y el tratamiento operativo de `SIN RUTA` y puntos móviles.

## 12. Hito de cierre

Este contrato se considera cerrado para la **Fase 1: fundación y lectura ejecutiva**. Cualquier cambio de definición, fuente o fórmula se registra en este documento y en la configuración correspondiente antes de modificar una visualización.
