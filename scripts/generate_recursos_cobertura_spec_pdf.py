#!/usr/bin/env python3
"""Genera la especificacion funcional del eje Recursos y cobertura."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Spacer

import generate_flujos_recogidas_spec_pdf as base

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "axes" / "04_Recursos_y_Cobertura.pdf"


class CapacityDiagram(Flowable):
    def __init__(self, width=17 * cm, height=3.2 * cm):
        super().__init__(); self.width, self.height = width, height

    def draw(self):
        c = self.canv
        blocks = [
            ("Demanda", "servicios y toneladas", colors.HexColor("#EAF3EF")),
            ("Flota", "vehiculos e incidencias", colors.HexColor("#E2F0EA")),
            ("Cobertura", "refuerzos y turnos", colors.HexColor("#F7EEDC")),
            ("Capacidad", "presion estimada", colors.HexColor("#EAF3EF")),
        ]
        w, h, y = 3.55 * cm, 1.48 * cm, .92 * cm
        for i, (title, sub, fill) in enumerate(blocks):
            x = i * 4.45 * cm
            c.setFillColor(fill); c.setStrokeColor(base.LINE)
            c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
            c.setFillColor(base.DARK); c.setFont("Arial-Bold", 8.9)
            c.drawCentredString(x + w / 2, y + .91 * cm, title)
            c.setFillColor(base.MUTED); c.setFont("Arial", 6.9)
            c.drawCentredString(x + w / 2, y + .51 * cm, sub)
            if i < len(blocks) - 1:
                c.setStrokeColor(base.GREEN); c.setLineWidth(1.2)
                c.line(x + w + .12 * cm, y + h / 2, x + 4.25 * cm, y + h / 2)
                c.line(x + 4.25 * cm, y + h / 2, x + 4.0 * cm, y + h / 2 + .12 * cm)
                c.line(x + 4.25 * cm, y + h / 2, x + 4.0 * cm, y + h / 2 - .12 * cm)


class ResourcesWireframe(Flowable):
    def __init__(self, width=17 * cm, height=9.75 * cm):
        super().__init__(); self.width, self.height = width, height

    def box(self, c, x, y, w, h, label, fill=colors.white):
        c.setFillColor(fill); c.setStrokeColor(base.LINE)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        c.setFillColor(base.MUTED); c.setFont("Arial-Bold", 7)
        c.drawString(x + .18 * cm, y + h - .37 * cm, label)

    def draw(self):
        c = self.canv
        c.setFillColor(colors.HexColor("#F6F9F7")); c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        self.box(c, .18 * cm, 8.91 * cm, 16.64 * cm, .6 * cm,
                 "Navegacion global: Resumen | Flujos | Especializacion | Captacion | Recursos | Circularidad", base.PALE)
        self.box(c, .18 * cm, .25 * cm, 3.3 * cm, 8.42 * cm, "Filtros globales")
        c.setFont("Arial", 6.5); c.setFillColor(base.MUTED)
        for i, label in enumerate(["Periodo", "Garbigune/base", "Ruta", "Vehiculo", "Tipo incidencia", "Motivo refuerzo"]):
            c.drawString(.42 * cm, 7.96 * cm - i * .69 * cm, label)
            c.setStrokeColor(base.LINE); c.roundRect(.42 * cm, 7.63 * cm - i * .69 * cm, 2.75 * cm, .35 * cm, 3, stroke=1, fill=0)
        self.box(c, 3.72 * cm, 7.1 * cm, 12.95 * cm, 1.57 * cm, "Lecturas automaticas: presion, disponibilidad y cobertura", colors.HexColor("#FFF7E8"))
        for x, label in [(3.72, "Servicios"), (6.96, "Incidencias"), (10.2, "Refuerzos"), (13.44, "Contexto flota")]:
            self.box(c, x * cm, 5.67 * cm, 2.92 * cm, 1.08 * cm, label)
        self.box(c, 3.72 * cm, 2.7 * cm, 6.3 * cm, 2.62 * cm, "Demanda, refuerzos e incidencias por mes")
        self.box(c, 10.27 * cm, 2.7 * cm, 6.4 * cm, 2.62 * cm, "Vehiculos: actividad vs incidencias")
        self.box(c, 3.72 * cm, .25 * cm, 12.95 * cm, 2.05 * cm, "Tabla de alertas de cobertura y disponibilidad")


def footer(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(base.LINE)
    canvas.line(1.7 * cm, 1.2 * cm, 19.3 * cm, 1.2 * cm)
    canvas.setFillColor(base.MUTED); canvas.setFont("Arial", 7.2)
    canvas.drawString(1.7 * cm, .74 * cm, "Garbiker - Especificacion funcional | Recursos y cobertura")
    canvas.drawRightString(19.3 * cm, .74 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build():
    base.register_fonts(); base.S = base.styles(); OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=1.7 * cm, rightMargin=1.7 * cm,
                          topMargin=1.55 * cm, bottomMargin=1.55 * cm,
                          title="Especificacion - Recursos y cobertura", author="Garbiker")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    p, t, c = base.p, base.table, base.callout
    story = [Spacer(1, 1.1 * cm), p("Recursos y cobertura", "title"),
             p("Especificacion funcional del cuarto eje del visor Garbigunes", "subtitle"),
             c("Proposito", "Relacionar la demanda operativa con los recursos que la sostienen: servicios, flota, incidencias y refuerzos. El objetivo es anticipar presion y facilitar la planificacion, no evaluar o clasificar individualmente a las personas."),
             Spacer(1, .42 * cm), p("Alcance", "h2"),
             p("Pestana autonoma para leer capacidad operativa, contexto de flota y cobertura. Usa las salidas transportadas como señal de actividad, las incidencias de vehículo como contexto de disponibilidad y los refuerzos como evidencia de cobertura adicional."),
             p("Sin cuadrantes, plantilla planificada, bajas, vacaciones, horas y asignaciones de turno no es posible medir dotacion necesaria o déficit de personal. En la version actual, el término correcto es <b>presion/cobertura observada</b>, no suficiencia de plantilla."),
             Spacer(1, .28 * cm), CapacityDiagram(), Spacer(1, .27 * cm),
             p("Principios de interpretacion", "h2"),
             base.bullet("Separar actividad, incidencia y refuerzo: su coincidencia temporal es una señal que requiere contexto, no una causalidad demostrada."),
             base.bullet("No mostrar personas identificables en vistas publicas o ejecutivas. El análisis individual, si se autoriza, debe ser privado, contextualizado y con muestra minima."),
             base.bullet("Comparar vehículos, rutas o conductores solo dentro de contextos operativos similares: residuo, ruta, periodo, dias activos y carga."),
             Spacer(1, .24 * cm), p("Fuentes disponibles y limites", "h2"),
             t(["Fuente", "Grano", "Uso en el eje", "Limite a mostrar"], [
                 ["fact_salidas_transporte", "Pesada/servicio", "Servicios, toneladas, ruta, base, vehículo, conductor y dias activos.", "No describe horas, turnos ni dotacion completa."],
                 ["dim_flota", "Vehículo", "Inventario, combustible, antigüedad, marca y centro de referencia.", "Es una foto de inventario; no confirma disponibilidad diaria."],
                 ["fact_incidencias_flota", "Incidencia", "Tipo/subgrupo, fecha, proveedor, vehículo o código interno cuando sea identificable.", "No contiene necesariamente duración de inmovilizacion ni coste total operativo."],
                 ["fact_refuerzos", "Cobertura/refuerzo", "Fecha, lugar normalizado, motivo y volumen de refuerzos.", "Sin cuadrante base no permite calcular tasa de absentismo ni déficit."],
             ], [3.25 * cm, 2.85 * cm, 6.4 * cm, 4.5 * cm]), PageBreak()]

    story += [p("1. Preguntas decisionales y metricas", "h1"),
              p("El eje debe traducir información dispersa en una lectura prudente de capacidad y continuidad. Las preguntas guían qué comparar y qué información adicional solicitar."),
              t(["Pregunta", "Indicadores", "Decision habilitada"], [
                  ["¿Donde aumenta la presion operativa?", "Servicios, t, dias activos, kg/servicio, tendencia y variabilidad por punto/ruta.", "Anticipar seguimiento de carga, frecuencias o necesidades de cobertura."],
                  ["¿Que recursos requieren mas contexto?", "Actividad por vehículo, incidencias, edad, tipo, ruta/base y cobertura temporal.", "Priorizar mantenimiento, revisión de asignación o contingencia."],
                  ["¿Donde aparecen refuerzos recurrentes?", "Refuerzos por mes, lugar, motivo, persistencia y actividad asociada.", "Revisar patrones de cobertura y solicitar cuadrantes/dotación planificada."],
                  ["¿Hay desalineacion entre demanda y recursos?", "Coincidencia de aumento de servicios, incidencias y refuerzos; score de presión.", "Abrir revisión operativa sin atribuir causa automática."],
                  ["¿Que calidad limita el análisis?", "Matrícula/código interno no emparejado, lugar sin clave, incidencia sin fecha o período parcial.", "Completar maestros y evitar conclusiones de baja confianza."],
              ], [4.25 * cm, 6.15 * cm, 6.6 * cm]), Spacer(1, .24 * cm), p("Metricas nucleares", "h2"),
              t(["Metrica", "Definicion", "Uso correcto"], [
                  ["Demanda de servicio", "Servicios, toneladas, kg/servicio y dias activos por periodo, ruta, base o punto.", "Señal de carga observada; no equivale a horas necesarias."],
                  ["Tasa de incidencias", "Incidencias por vehículo/mes o por 100 servicios cuando existe cruce fiable.", "Comparar cobertura y contexto; no diagnostica fiabilidad por si sola."],
                  ["Intensidad de refuerzo", "Número de refuerzos por lugar/mes, motivo y actividad asociada.", "Señal de cobertura adicional observada, no absentismo."],
                  ["Score de presion", "Combinación transparente de demanda relativa, variabilidad, incidencias y refuerzos.", "Ordena revisión; no es un KPI de desempeño individual."],
                  ["Cobertura de identificadores", "% incidencias con matrícula normalizada, código interno o sin identificar; % refuerzos con place_key.", "Define la confianza de cruces con flota, rutas y Garbigunes."],
              ], [3.15 * cm, 7.1 * cm, 6.75 * cm]), Spacer(1, .18 * cm),
              c("Comparativas temporales", "Meses parciales se comparan a días equivalentes. Las series de incidencias y refuerzos indican su ventana temporal disponible; no se sobreponen a salidas como si todas las fuentes cubrieran el mismo periodo." , colors.HexColor("#FFF7E8")), PageBreak()]

    story += [p("2. Navegacion, filtros y privacidad", "h1"),
              p("La pestaña comparte el periodo y filtros de operación con el visor, pero restringe según el tipo de dato. La información personal se minimiza y se separa de las vistas públicas."),
              p("Navegacion", "h2"),
              t(["Elemento", "Especificacion"], [
                  ["Pestana activa", "Recursos y cobertura. Etiqueta de dominio: <b>Capacidad operativa y continuidad</b>."],
                  ["Modo Ejecutivo", "Muestra presión operativa, tendencia de incidencias/refuerzos, alertas de cobertura y acciones de revisión por lugar o flota."],
                  ["Modo Analista", "Activa desgloses por vehículo, ruta, base, tipo de avería, motivo de refuerzo y metodología de scores."],
                  ["Acceso a personas", "Conductores y personas de refuerzo solo en rol interno autorizado, con datos minimizados y sin exposición mediante vistas públicas."],
              ], [4.4 * cm, 12.6 * cm]), p("Panel de filtros", "h2"),
              t(["Orden", "Filtro", "Comportamiento y alcance"], [
                  ["1", "Intervalo", "Selector mes inicial - mes final comun. Muestra ventanas de cobertura por fuente cuando difieran."],
                  ["2", "Garbigune, base y ruta", "Filtros de contexto operativo. Los lugares de refuerzo se normalizan con place_key/site_key."],
                  ["3", "Vehiculo", "Aplica a salidas e incidencias cuando la matrícula/código interno está normalizado. Indicar coincidencias parciales."],
                  ["4", "Tipo/subgrupo de incidencia", "Aplicable solo a incidencias; leyenda seleccionable en gráficos apilados."],
                  ["5", "Motivo de refuerzo", "Aplicable a coberturas/refuerzos; usar categorías normalizadas y mostrar faltantes."],
                  ["6", "Conductor/persona", "Solo rol analista autorizado; se oculta del modo Ejecutivo y de los datos públicos."],
              ], [1.1 * cm, 3.65 * cm, 12.25 * cm]), Spacer(1, .18 * cm),
              c("Regla de privacidad", "Las vistas consultadas desde el navegador usan agregados públicos que excluyen matrículas, códigos internos, conductores y respuestas personales. El detalle sensible se consulta solo mediante backend/rol autorizado y se registra su uso."), PageBreak()]

    story += [p("3. Arrangement de la pestana", "h1"),
              p("El recorrido de lectura es: demanda del servicio, señales de continuidad, recursos asociados y alertas priorizadas. Una gráfica de flota o una tabla de refuerzos no debe aparecer aislada de la actividad que pretende contextualizar."),
              ResourcesWireframe(), Spacer(1, .24 * cm), p("Bloques funcionales", "h2"),
              t(["Bloque", "Contenido", "Comportamiento"], [
                  ["A. Contexto", "Titulo, periodo, chips, cobertura de fuentes y modo Ejecutivo/Analista.", "Aclara la ventana temporal de incidencias y refuerzos."],
                  ["B. Lecturas", "3 a 5 conclusiones sobre presión, refuerzos, incidencias y calidad.", "Enlazan a evidencia y evitan identificar personas en Ejecutivo."],
                  ["C. KPI", "Servicios/t, vehículos con actividad, incidencias, refuerzos y score de presión/contexto.", "Cada tarjeta muestra denominador, periodo y cobertura."],
                  ["D. Tendencias", "Serie mensual de servicios, refuerzos e incidencias; barras apiladas por tipo/subgrupo de avería.", "Eje temporal cronológico, leyenda seleccionable y escalas explícitas."],
                  ["E. Contexto de flota", "Scatter o matriz vehículo/ruta: actividad, kg/servicio, incidencias, edad y confianza.", "Selección de vehículo actualiza alertas y detalle; seudonimizar si el rol lo requiere."],
                  ["F. Alertas", "Tabla de presión, cobertura y calidad por lugar, ruta o vehículo.", "Exportable; prioriza revisión, no sanción."],
              ], [3.25 * cm, 7.2 * cm, 6.55 * cm]), p("Reglas de legibilidad", "h2"),
              base.bullet("La evolución mensual se ordena siempre cronológicamente, con control claro para invertir el sentido, nunca por valor."),
              base.bullet("Los tipos de avería se muestran como barras apiladas por subgrupo o taller con selector mutuamente excluyente; la leyenda no invade los ejes."),
              base.bullet("La tabla de alertas presenta una explicación de la regla, indicador observado, referencia, confianza y siguiente acción."),
              base.bullet("En movil, KPI 2 x 2, gráficas en una columna y tablas de alerta como tarjetas expandibles con detalle bajo demanda."), PageBreak()]

    story += [p("4. Vistas predeterminadas e insights", "h1"),
              p("Las vistas predeterminadas conectan el recurso con la operación. Están diseñadas para iniciar una conversación de planificación, no para sustituirla por una puntuación automática."),
              t(["Vista", "Configuracion inicial", "Insight esperado", "Decision / siguiente paso"], [
                  ["1. Pulso de capacidad", "Ultimos 12 meses completos; servicios, toneladas, incidencias y refuerzos por mes.", "Detectar aumento simultáneo de actividad y señales de presión/cobertura.", "Revisar calendario, rutas, mantenimiento y plan de cobertura."],
                  ["2. Lugares con refuerzo recurrente", "Refuerzos por site/place_key, mes y motivo; cruzar con actividad cuando sea comparable.", "Identificar lugares o periodos donde el apoyo se repite.", "Solicitar cuadrante base y causas; valorar ajuste de planificación."],
                  ["3. Contexto de flota", "Vehículos con actividad; scatter servicios o t vs incidencias, color por confianza/tipo.", "Distinguir volumen, incidencias y cobertura de datos sin ranking simplista.", "Priorizar revisión de mantenimiento, asignación o calidad de identificador."],
                  ["4. Incidencias por composición", "Barras apiladas por mes; selector subgrupos o talleres; ventana temporal indicada.", "Ver evolución de averías y concentración de atención externa.", "Planificar seguimiento de categorías o proveedores con evidencia."],
                  ["5. Alertas de cobertura", "Score de presión por ruta/base/lugar; mínimo de muestra y mes completo.", "Encontrar combinaciones de demanda, refuerzos e incidencias que merecen revisión.", "Abrir caso operativo, no concluir insuficiencia de personal."],
              ], [3.05 * cm, 4.35 * cm, 4.85 * cm, 4.75 * cm]), Spacer(1, .24 * cm), p("Key takeaways automatizados", "h2"),
              base.bullet("<b>Presión:</b> “La actividad de [ruta/base] creció X% frente a días equivalentes y se sitúa por encima de su rango histórico.”"),
              base.bullet("<b>Refuerzo:</b> “[Lugar] concentra X refuerzos durante N meses; la señal debe contrastarse con el cuadrante planificado.”"),
              base.bullet("<b>Flota:</b> “[Vehículo/grupo] combina actividad elevada e incidencias por encima de comparables; revisar mantenimiento y cobertura del identificador.”"),
              base.bullet("<b>Continuidad:</b> “El aumento de [subgrupo de avería] coincide con un periodo de alta actividad; no se infiere causalidad sin revisión.”"),
              base.bullet("<b>Calidad:</b> “X% de incidencias no se cruza con vehículo normalizado; las conclusiones de flota tienen confianza limitada.”"),
              Spacer(1, .16 * cm), c("Regla de redaccion", "Las lecturas se refieren a rutas, lugares, periodos y grupos de recursos. No exponen nombres ni convierten señales de cobertura en una evaluación de desempeño individual."), PageBreak()]

    story += [p("5. Graficas, tablas y interacciones", "h1"),
              p("Los componentes aplican el sistema visual común. La función de cada visual es conectar demanda con señales de continuidad y permitir descender a una evidencia operativa concreta."),
              t(["Componente", "Especificacion", "Interaccion"], [
                  ["Tendencia mensual", "Servicios/t como barras o línea; incidencias/refuerzos como series separadas o small multiples; meses en orden cronológico.", "Tooltip con periodo, unidades, días equivalentes, fuente y cobertura. Control de orden temporal ascendente/descendente."],
                  ["Averías apiladas", "Barras por mes o tipo; apilado por subgrupo o taller, selector de composición y leyenda bajo la gráfica.", "Leyenda seleccionable sincroniza filtros de incidencia; hover muestra total, segmento, % y ventana temporal."],
                  ["Scatter de flota", "Ejes: servicios/t, kg/servicio, días activos e incidencias; tamaño por actividad, color por confianza o tipo vehículo.", "Click fija vehículo/grupo y muestra ficha contextual; evita mostrar matrícula en modo público."],
                  ["Ranking de refuerzos", "Barras horizontales por lugar, motivo, frecuencia o persistencia; incluir actividad asociada cuando exista.", "Métrica seleccionable, orden invertible en eje y Ver más para lista completa."],
                  ["Matriz de presión", "Ruta/base/lugar x mes o tipo de señal; escala con cero en gris suave y datos faltantes diferenciados.", "Seleccionar celda actualiza detalle de servicios, incidencias y refuerzos."],
                  ["Tabla de alertas", "Entidad, periodo, señales, valor, referencia, confianza, regla, estado y acción sugerida.", "Filtros de columna, orden, exportación CSV y acceso a metodología."],
              ], [3.1 * cm, 8.05 * cm, 5.85 * cm]), Spacer(1, .22 * cm), p("Estados de datos", "h2"),
              base.bullet("Cuando la ventana de incidencias no coincida con la de salidas, el gráfico muestra ambas fechas y desactiva deltas engañosos."),
              base.bullet("Un vehículo con código interno no se fusiona con una matrícula sin regla validada; se muestra como coincidencia parcial o no identificada."),
              base.bullet("Sin cuadrante/baja/dotación, el estado de cobertura se denomina “información de plantilla pendiente”, no “sin problema”."),
              base.bullet("La leyenda y los tooltips nunca son el único modo de conocer la unidad, el periodo o la cobertura."), PageBreak()]

    story += [p("6. Outliers, alertas y confianza", "h1"),
              p("Las alertas ordenan la revisión operativa. La existencia de una alerta no demuestra avería, falta de personal o causa atribuible a una persona concreta."),
              t(["Tipo de alerta", "Regla inicial", "Lectura", "Accion sugerida"], [
                  ["Presión operativa", "Servicios/t o días activos por encima de percentiles de ruta/base comparables; mínimo de muestra.", "Carga relativa elevada o cambio de patrón.", "Revisar calendario, residuos, ruta, frecuencia y recursos asignados."],
                  ["Refuerzo recurrente", "Refuerzos repetidos por lugar/motivo durante N meses o periodos equivalentes.", "Señal de cobertura adicional persistente.", "Contrastar con cuadrante, bajas, vacaciones y planificación."],
                  ["Incidencias elevadas", "Tasa de incidencias sobre referencia de vehículo/grupo; ventana temporal completa.", "Mayor demanda de mantenimiento o distinta exposición operativa.", "Revisar subgrupos, proveedor, antigüedad y disponibilidad real."],
                  ["Actividad interrumpida", "Caída de servicios/t combinada con incidencias o ausencia de vehículo identificable.", "Posible interrupción operativa o problema de registro.", "Validar calendario, sustitución, mantenimiento y dato de salida."],
                  ["Identificador incompleto", "Incidencia sin matrícula/código reconocido o refuerzo sin place_key.", "Limita cruces y confianza.", "Completar maestro de activos/aliases y mantener caso en calidad."],
              ], [3.0 * cm, 4.35 * cm, 4.75 * cm, 4.9 * cm]), Spacer(1, .24 * cm), p("Score de presión", "h2"),
              p("Propuesta inicial de score 0-100: 35% demanda relativa, 25% variabilidad o cambio reciente, 20% refuerzos recurrentes, 15% incidencias contextualizadas y 5% cobertura de identificadores. Se calcula por ruta/base/lugar, no por persona, y siempre muestra los componentes que lo forman."),
              p("La confianza es alta con cobertura temporal completa, muestra suficiente y cruces normalizados; media con una limitación relevante; baja con mes parcial, falta de cuadrante o identificadores incompletos. La baja confianza no desaparece: se muestra y ordena por separado."),
              Spacer(1, .16 * cm), c("Datos de personal pendientes", "Para pasar de señales de cobertura a planificación de personal se requiere una fuente de cuadrantes, puestos/turnos previstos, bajas, vacaciones, horas, restricciones, competencias y asignaciones. Esa integración debe acordar finalidad, acceso, conservación y agregación antes de mostrarse en el visor." , colors.HexColor("#FFF7E8")), PageBreak()]

    story += [p("7. Modelo de datos, seguridad y contratos", "h1"),
              p("Los cálculos recurrentes se resuelven en Python/Supabase. Las vistas públicas se limitan a agregados no sensibles; los detalles de personas y activos permanecen en backend o roles internos autorizados."),
              t(["Necesidad", "Capa recomendada", "Salida contractual"], [
                  ["Demanda operativa", "Supabase / preagregado", "Mes, site_key, ruta, base, vehículo seudonimizado, servicios, kg, kg/servicio y días activos."],
                  ["Contexto de flota", "Vista SQL / Python", "Mes, vehículo/grupo, tipo, edad, servicios, kg, incidencias, cobertura de identificador y confianza."],
                  ["Refuerzos", "Supabase / preagregado", "Mes, place_key, site_key, tipo de lugar, motivo, recuento y cobertura de normalización."],
                  ["Alertas y lecturas", "Python en pipeline", "Regla, entidad agregada, periodo, valor, referencia, score, confianza, texto y acción."],
                  ["Datos de personal", "Fuente restringida futura", "Turno/rol agregados, cobertura planificada/real y ausencias; nunca PII en vistas públicas."],
              ], [4.15 * cm, 4.5 * cm, 8.35 * cm]), Spacer(1, .2 * cm), p("Configuracion editable", "h2"),
              base.bullet("<b>dim_flota</b>: activo, matrícula/código interno protegido, tipo, combustible, antigüedad, centro y estado de referencia."),
              base.bullet("<b>config_site_aliases</b>: normalización de bases, Garbigunes, móvil y otros lugares de refuerzo."),
              base.bullet("<b>config_quality_rules</b>: umbrales de muestra, presión, incidencias, cobertura de identificadores y severidad."),
              base.bullet("Futura <b>fact_cobertura_personal</b>: fecha/turno, lugar, rol, dotación prevista, asignada, ausencias agregadas y evidencia de fuente."),
              Spacer(1, .22 * cm), p("Criterios de aceptacion", "h2"),
              t(["Criterio", "Verificacion"], [
                  ["Privacidad", "Vistas públicas excluyen conductores, matrículas, códigos internos y personas de refuerzo."],
                  ["Contexto", "Ninguna comparación de vehículo/persona se muestra sin ruta, residuo, actividad y muestra minima."],
                  ["Temporalidad", "Cada fuente declara rango disponible y los meses parciales se identifican."],
                  ["Trazabilidad", "Toda alerta expone regla, datos, referencia, confianza y acción sugerida."],
                  ["Planificación", "No se etiqueta déficit/suficiencia de plantilla sin cuadrante y dotación planificada."],
              ], [4.0 * cm, 13.0 * cm]), PageBreak()]

    story += [p("8. Hoja de ruta de implementacion", "h1"),
              p("El primer incremento entrega una lectura útil de presión y continuidad con las fuentes actuales. La capacidad de planificación se vuelve mucho más valiosa al incorporar datos de turnos y cobertura acordados con Garbiker."),
              t(["Fase", "Entregable", "Dependencias"], [
                  ["1. Fundacion", "Filtros, cobertura temporal, contexto de flota, tendencia de incidencias y refuerzos normalizados.", "fact_salidas, dim_flota, incidencias, refuerzos y aliases actualizados."],
                  ["2. Lectura ejecutiva", "Pulso de capacidad, alertas de presión, refuerzos recurrentes y calidad de cruces.", "Agregados mensuales y reglas de confianza."],
                  ["3. Analisis", "Matriz de presión, scatter de flota, composición de averías y exportación de alertas.", "Scores pipeline, normalización de vehículos/lugares y vistas restringidas."],
                  ["4. Personal", "Cuadrantes, bajas, cobertura prevista/real, escenarios y planificación de turnos.", "Fuente HR/operativa validada, gobernanza de datos y permisos."],
              ], [2.0 * cm, 8.15 * cm, 6.85 * cm]), Spacer(1, .34 * cm), p("Decisiones que debe hacer mas faciles", "h2"),
              base.bullet("Que rutas, bases o puntos combinan una presión operativa creciente con señales de continuidad que requieren revisión."),
              base.bullet("Donde los refuerzos se repiten y justifican contrastar la planificación, las ausencias o el diseño de turnos."),
              base.bullet("Que grupos de flota requieren análisis de mantenimiento, asignación o calidad de identificadores antes de concluir."),
              base.bullet("Que ventanas temporales o vacíos de datos limitan la lectura y deben resolverse en origen."),
              base.bullet("Con datos futuros, que turnos y roles necesitan escenarios de cobertura basados en demanda real."),
              Spacer(1, .42 * cm), c("Cierre", "El valor de esta pestaña es convertir señales dispersas de actividad, flota y refuerzo en una conversación de planificación basada en evidencia, manteniendo la privacidad y el contexto operativo."), Spacer(1, .3 * cm),
              p("Documento preparado para aplicar una futura guía global de estilos. Los comportamientos y contratos descritos aquí se implementarán con los componentes, tokens y reglas de accesibilidad de dicha guía.", "small")]
    doc.build(story); print(OUTPUT)


if __name__ == "__main__":
    build()
