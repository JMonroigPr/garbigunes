#!/usr/bin/env python3
"""Genera la especificacion funcional del eje Flujos y recogidas."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "axes" / "01_Flujos_y_Recogidas.pdf"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")

GREEN = colors.HexColor("#16856A")
DARK = colors.HexColor("#1E2B28")
MUTED = colors.HexColor("#63716D")
PALE = colors.HexColor("#EAF3EF")
LINE = colors.HexColor("#D7E3DE")
AMBER = colors.HexColor("#C8811C")
RED = colors.HexColor("#B54842")
WHITE = colors.white


def register_fonts():
    pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Arial-Bold", fontSize=25,
                                leading=29, textColor=DARK, spaceAfter=8),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName="Arial", fontSize=11,
                                   leading=16, textColor=MUTED, spaceAfter=18),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Arial-Bold", fontSize=16,
                              leading=20, textColor=DARK, spaceBefore=7, spaceAfter=9),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Arial-Bold", fontSize=11.5,
                              leading=15, textColor=GREEN, spaceBefore=8, spaceAfter=6),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Arial", fontSize=9.2,
                                leading=13.3, textColor=DARK, spaceAfter=7),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName="Arial", fontSize=7.8,
                                 leading=10.5, textColor=MUTED),
        "cell": ParagraphStyle("cell", parent=base["BodyText"], fontName="Arial", fontSize=7.8,
                                leading=10.1, textColor=DARK),
        "cell_bold": ParagraphStyle("cell_bold", parent=base["BodyText"], fontName="Arial-Bold", fontSize=7.8,
                                     leading=10.1, textColor=DARK),
        "caption": ParagraphStyle("caption", parent=base["BodyText"], fontName="Arial", fontSize=7.4,
                                   leading=9.5, textColor=MUTED),
        "callout": ParagraphStyle("callout", parent=base["BodyText"], fontName="Arial", fontSize=8.8,
                                   leading=12.4, textColor=DARK),
        "nav": ParagraphStyle("nav", parent=base["BodyText"], fontName="Arial-Bold", fontSize=8.4,
                               leading=10, textColor=DARK, alignment=TA_CENTER),
    }


def p(text, style="body"):
    return Paragraph(text, S[style])


def bullet(text):
    return Paragraph(f"<font color='#16856A'><b>•</b></font> {text}", S["body"])


def section(title, intro=None):
    elements = [p(title, "h1")]
    if intro:
        elements.append(p(intro))
    return elements


def table(headers, rows, widths, header_color=GREEN):
    body = [[p(h, "cell_bold") for h in headers]]
    body += [[p(value, "cell") for value in row] for row in rows]
    result = Table(body, colWidths=widths, repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Arial-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F7FAF8")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return result


def callout(label, text, tint=PALE):
    content = Table([[p(f"<b>{label}</b><br/>{text}", "callout")]], colWidths=[17.0 * cm])
    content.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return content


class FlowDiagram(Flowable):
    def __init__(self, width=17.0 * cm, height=3.0 * cm):
        super().__init__()
        self.width, self.height = width, height

    def draw(self):
        c = self.canv
        labels = [
            ("Entradas", "AW / visitas"),
            ("Acopio", "presion estimada"),
            ("Recogida", "servicios / viajes"),
            ("Salida", "t y kg/viaje"),
        ]
        box_w = 3.55 * cm
        box_h = 1.45 * cm
        y = 0.82 * cm
        for index, (title, sub) in enumerate(labels):
            x = index * 4.45 * cm
            c.setFillColor(PALE if index != 2 else colors.HexColor("#F7EEDC"))
            c.setStrokeColor(LINE)
            c.roundRect(x, y, box_w, box_h, 5, fill=1, stroke=1)
            c.setFillColor(DARK)
            c.setFont("Arial-Bold", 9)
            c.drawCentredString(x + box_w / 2, y + 0.9 * cm, title)
            c.setFont("Arial", 7)
            c.setFillColor(MUTED)
            c.drawCentredString(x + box_w / 2, y + 0.5 * cm, sub)
            if index < len(labels) - 1:
                c.setStrokeColor(GREEN)
                c.setLineWidth(1.25)
                c.line(x + box_w + 0.12 * cm, y + box_h / 2, x + 4.25 * cm, y + box_h / 2)
                c.line(x + 4.25 * cm, y + box_h / 2, x + 4.0 * cm, y + box_h / 2 + 0.12 * cm)
                c.line(x + 4.25 * cm, y + box_h / 2, x + 4.0 * cm, y + box_h / 2 - 0.12 * cm)


class DashboardWireframe(Flowable):
    def __init__(self, width=17.0 * cm, height=10.0 * cm):
        super().__init__()
        self.width, self.height = width, height

    def box(self, c, x, y, w, h, label, fill=WHITE):
        c.setFillColor(fill)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        c.setFillColor(MUTED)
        c.setFont("Arial-Bold", 7)
        c.drawString(x + 0.18 * cm, y + h - 0.38 * cm, label)

    def draw(self):
        c = self.canv
        c.setFillColor(colors.HexColor("#F6F9F7"))
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        self.box(c, 0.18 * cm, 9.14 * cm, 16.64 * cm, 0.62 * cm, "Navegacion global: Resumen | Flujos y recogidas | Especializacion | Captacion | Recursos | Circularidad", PALE)
        self.box(c, 0.18 * cm, 0.25 * cm, 3.3 * cm, 8.65 * cm, "Filtros globales", WHITE)
        c.setFont("Arial", 6.5)
        c.setFillColor(MUTED)
        for i, label in enumerate(["Periodo", "Residuo", "Garbigune", "Ruta", "Vehiculo", "Conductor"]):
            c.drawString(0.42 * cm, 8.2 * cm - i * 0.72 * cm, label)
            c.setStrokeColor(LINE)
            c.roundRect(0.42 * cm, 7.86 * cm - i * 0.72 * cm, 2.75 * cm, 0.36 * cm, 3, stroke=1, fill=0)
        self.box(c, 3.72 * cm, 7.16 * cm, 12.95 * cm, 1.74 * cm, "Lecturas automaticas y alertas accionables", colors.HexColor("#FFF7E8"))
        for x, label in [(3.72, "Entradas"), (6.96, "Salidas"), (10.2, "Kg/viaje"), (13.44, "Frecuencia")]:
            self.box(c, x * cm, 5.74 * cm, 2.92 * cm, 1.16 * cm, label, WHITE)
        self.box(c, 3.72 * cm, 2.6 * cm, 8.18 * cm, 2.8 * cm, "Evolucion mensual: entradas, salidas y servicios", WHITE)
        self.box(c, 12.15 * cm, 2.6 * cm, 4.52 * cm, 2.8 * cm, "Rutas / puntos prioritarios", WHITE)
        self.box(c, 3.72 * cm, 0.25 * cm, 12.95 * cm, 1.98 * cm, "Tabla de excepciones: outliers y acciones sugeridas", WHITE)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(1.7 * cm, 1.2 * cm, 19.3 * cm, 1.2 * cm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Arial", 7.2)
    canvas.drawString(1.7 * cm, 0.74 * cm, "Garbiker - Especificacion funcional | Flujos y recogidas")
    canvas.drawRightString(19.3 * cm, 0.74 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build():
    register_fonts()
    global S
    S = styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=1.7 * cm, rightMargin=1.7 * cm,
        topMargin=1.55 * cm, bottomMargin=1.55 * cm,
        title="Especificacion - Flujos y recogidas",
        author="Garbiker",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    story = []

    story += [Spacer(1, 1.1 * cm), p("Flujos y recogidas", "title"),
              p("Especificacion funcional del primer eje del visor Garbigunes", "subtitle"),
              callout("Proposito", "Convertir los registros de entrada y de salida en decisiones operativas posibles: entender la carga por punto, anticipar presion de recogida, ajustar frecuencias y detectar excepciones que requieren revision."),
              Spacer(1, 0.42 * cm), p("Alcance", "h2"),
              p("Pestana autonoma dentro de un visor comun. Analiza entradas en Garbigunes, salidas transportadas, servicios, rutas y frecuencia. Se integra con los filtros globales, pero conserva sus vistas y lecturas propias."),
              p("No debe utilizarse para afirmar nivel de llenado real sin capacidad de contenedor, inventario o sensor. Cuando esos datos no existan, la expresion correcta es <b>presion operativa estimada</b>."),
              Spacer(1, 0.35 * cm), FlowDiagram(), Spacer(1, 0.32 * cm),
              p("Principios de interpretacion", "h2"),
              bullet("Separar siempre <b>entradas AW</b> de <b>salidas transportadas</b>: son procesos, fuentes y granularidades diferentes."),
              bullet("Comparar periodos equivalentes: mes completo frente a mes completo, o mismo numero de dias transcurridos."),
              bullet("Evitar rankings punitivos de personas o centros: una diferencia puede responder al mix de residuos, ruta, distancia o cobertura."),
              Spacer(1, 0.3 * cm),
              p("Fuentes disponibles", "h2"),
              table(["Fuente", "Grano", "Uso en el eje", "Limitacion a mostrar"], [
                  ["fact_captacion_aw", "Linea de entrada", "Toneladas, familia/subfamilia AW, tipo de usuario, Garbigune y fecha.", "No confundir linea con visita; CP se reserva para Captacion territorial."],
                  ["fact_salidas_transporte", "Pesada/servicio de salida", "Toneladas transportadas, residuo, ruta, base, vehiculo y conductor.", "Una salida no equivale necesariamente a una retirada completa del stock."],
                  ["dim_garbigunes y rutas", "Maestro", "Ubicacion, tipo de punto, ruta y base asignada.", "Rutas son una foto de referencia y pueden cambiar operativamente."],
                  ["fact_incidencias_flota", "Incidencia", "Contextualizar caidas de actividad o indisponibilidad de vehiculos.", "Cobertura temporal distinta de las pesadas."],
              ], [3.2 * cm, 2.35 * cm, 7.1 * cm, 4.35 * cm]), PageBreak()]

    story += section("1. Preguntas decisionales y metricas", "La pestana debe ayudar a responder primero una pregunta concreta; una grafica solo permanece si habilita una accion o una revision.")
    story.append(table(["Pregunta", "Indicadores", "Decision habilitada"], [
        ["¿Donde se concentra la actividad?", "t de entrada, t de salida, servicios, participacion y tendencia.", "Priorizar seguimiento de puntos, fracciones o rutas relevantes."],
        ["¿La cadencia de recogida acompana la demanda?", "Dias entre salidas, servicios/mes, t/servicio, tendencia de entradas y salidas.", "Revisar frecuencia, secuencia de ruta o capacidad asignada."],
        ["¿Hay desajuste entre lo que entra y lo que sale?", "Balance acumulado y mensual por Garbigune y familia homologada.", "Investigar acumulacion, diferencia de registro o cambio operativo."],
        ["¿Que rutas absorben mayor carga o variabilidad?", "t, servicios, kg/viaje, puntos atendidos, dispersion y outliers.", "Ajustar agrupacion, vehiculo, frecuencia o revisar datos."],
        ["¿La flota condiciona el servicio?", "Incidencias, dias con actividad, t/vehiculo y contexto de ruta.", "Planificar mantenimiento y contingencia sin atribuir causalidad automatica."],
    ], [4.2 * cm, 6.1 * cm, 6.7 * cm]))
    story += [Spacer(1, 0.25 * cm), p("Definiciones metodologicas", "h2"),
              table(["Termino", "Definicion para el visor"], [
                  ["Entrada", "Linea registrada de residuo depositado en un Garbigune. Puede haber varias lineas para una misma visita."],
                  ["Salida / servicio", "Registro de pesada transportada desde un Garbigune o ruta. Se muestra como servicio de salida salvo que se disponga de una clave de retirada inequívoca."],
                  ["Viaje", "Sinonimo operativo de servicio de salida cuando cada pesada representa un desplazamiento de transporte."],
                  ["Kg/viaje", "Carga media: kilogramos de salida divididos entre servicios de salida. No mide ocupacion real del vehiculo."],
                  ["Balance estimado", "Entradas menos salidas de familias equivalentes dentro del periodo. Es un indicador de contraste, no un inventario de stock."],
                  ["Presion operativa estimada", "Combinacion de entradas, tiempo desde la ultima salida y cadencia historica. Nunca debe denominarse llenado sin capacidad disponible."],
              ], [4.25 * cm, 12.75 * cm]),
              Spacer(1, 0.25 * cm),
              callout("Regla de comparabilidad", "Todo KPI temporal debe indicar si el ultimo mes es parcial. Los comparativos MoM y YoY usan dias equivalentes; si no es posible, se muestra la etiqueta <b>Mes parcial - lectura orientativa</b>.", colors.HexColor("#FFF7E8")), PageBreak()]

    story += section("2. Navegacion, contexto y filtros", "El visor comun conserva una navegacion fija. Esta pestana debe sentirse completa por si sola, pero no replicar controles ni definiciones innecesarias.")
    story += [p("Navegacion", "h2"),
              table(["Elemento", "Especificacion"], [
                  ["Pestana activa", "Flujos y recogidas. Debe ser la primera analitica despues de Vision general, con etiqueta de dominio: <b>Entradas y salidas</b>."],
                  ["Navegacion entre ejes", "Barra superior persistente. Al cambiar de eje se conserva el intervalo y los filtros que sean semanticamente compatibles."],
                  ["Modo Ejecutivo / Analista", "Ejecutivo muestra conclusiones, 4 KPI y 3 vistas predeterminadas. Analista revela desgloses, tablas, metodologia y controles avanzados."],
                  ["Estado de filtros", "Resumen compacto de chips bajo el titulo: periodo, residuos, Garbigunes, rutas y vehiculos activos. Cada chip es eliminable."],
              ], [4.5 * cm, 12.5 * cm]),
              p("Panel de filtros izquierdo", "h2"),
              p("Debe ser comun a todos los ejes, plegable en escritorio y desplegable como panel lateral en movil. No se repiten filtros de fecha dentro de graficas."),
              table(["Orden", "Filtro", "Comportamiento"], [
                  ["1", "Intervalo", "Selector mes inicial - mes final; calendario diario solo en modo Analista. Accesos rapidos: ultimo mes completo, YTD, ultimo ano completo, todo el periodo."],
                  ["2", "Tipo de residuo", "Botones Todas / Ninguna y chips multiseleccionables. El orden de chips sigue el volumen en el periodo activo."],
                  ["3", "Garbigune", "Multiseleccion con busqueda. Separar visualmente fijos, moviles y otros puntos si los datos lo permiten."],
                  ["4", "Ruta y base", "Aplicable a salidas. Mostrar aviso de cobertura cuando haya registros SIN RUTA."],
                  ["5", "Vehiculo y conductor", "Aplicable a salidas. No aplicar a entradas sin una equivalencia explicita."],
                  ["6", "Restablecer", "Devuelve al periodo por defecto y a todas las categorias. Nunca borra filtros al navegar entre sub-vistas de la misma pestana."],
              ], [1.15 * cm, 3.3 * cm, 12.55 * cm]),
              Spacer(1, 0.2 * cm),
              callout("Aplicabilidad", "La cabecera de cada grafica indica la taxonomia de la fuente: <b>Entradas AW</b>, <b>Salidas transportadas</b> o <b>Comparativa homologada</b>. Si un filtro no aplica, se muestra como informativo, no como filtro silenciosamente ignorado."), PageBreak()]

    story += section("3. Arrangement de la pestana", "Estructura de lectura de arriba abajo: situacion, evolucion, causa operativa y excepciones. Las graficas no compiten por atencion; cada bloque tiene una funcion.")
    story += [DashboardWireframe(), Spacer(1, 0.25 * cm), p("Composicion por bloques", "h2"),
              table(["Bloque", "Contenido", "Comportamiento"], [
                  ["A. Contexto", "Titulo, periodo, chips activos, calidad de datos y modo Ejecutivo/Analista.", "Persistente; no consume altura excesiva."],
                  ["B. Lecturas", "3 a 5 conclusiones automaticas, ordenadas por impacto, con enlace a la vista que las sustenta.", "En Ejecutivo se ven completas; en Analista se muestra evidencia y formula."],
                  ["C. KPI", "Entradas t, salidas t, servicios, kg/viaje y presion estimada / balance segun cobertura.", "Cada tarjeta abre un desglose, no una pagina nueva."],
                  ["D. Evolucion", "Serie mensual de entradas y salidas; barras apiladas por residuo cuando el detalle sea legible.", "Leyenda seleccionable y sincronizada con filtro global de residuos."],
                  ["E. Priorizacion", "Mapa de puntos o ranking de Garbigunes/rutas, con volumen, frecuencia y variabilidad.", "Click filtra toda la pestana y muestra el contexto seleccionado."],
                  ["F. Excepciones", "Tabla de outliers, calidad y acciones sugeridas.", "Siempre disponible al final; exportable en CSV."],
              ], [3.25 * cm, 7.2 * cm, 6.55 * cm]),
              p("Reglas responsive", "h2"),
              bullet("Escritorio: dos columnas para evolucion y priorizacion; tablas a ancho completo."),
              bullet("Tablet: una columna para graficas principales, filtros plegados y KPI en cuadrícula 2 x 2."),
              bullet("Movil: panel de filtros en cajon; graficas con altura minima de 300 px, leyenda en lista y tabla desplazable horizontalmente."),
              bullet("No usar tooltips como unico soporte de lectura: mostrar etiquetas solo para top valores y mantener ejes legibles."), PageBreak()]

    story += section("4. Vistas predeterminadas e insights", "Las vistas predeterminadas son recetas de lectura. Deben abrirse con filtros claros, contar con un titulo conclusivo y llevar a una decision verificable.")
    story.append(table(["Vista", "Configuracion inicial", "Insight esperado", "Decision / siguiente paso"], [
        ["1. Pulso operativo", "Ultimos 12 meses completos; todos los Garbigunes y residuos. Serie mensual entradas vs salidas, servicios y kg/viaje.", "Detectar meses con entrada creciente, salida estable o caida de productividad.", "Revisar si la frecuencia, rutas o disponibilidad de flota explican el cambio."],
        ["2. Puntos bajo presion", "Periodo actual; ranking de Garbigunes por presion estimada y variacion de entradas.", "Identificar puntos con demanda alta y menor cadencia de retirada relativa.", "Priorizar revision operativa, no declarar saturacion."],
        ["3. Rutas de carga variable", "Ultimos 6-12 meses; scatter kg/viaje vs servicios, color por residuo dominante.", "Separar rutas de alto volumen, baja carga media y comportamiento inestable.", "Revisar agrupacion de puntos, tipo de vehiculo o calendario."],
        ["4. Balance por familia", "Entradas AW vs salidas homologadas; Garbigune y familia seleccionables.", "Visibilizar diferencias persistentes entre registros de entrada y salida.", "Comprobar equivalencias, stock operativo, registro y periodos de corte."],
        ["5. Excepciones de servicio", "Ultimo mes completo; tabla ordenada por score de anomalia.", "Encontrar pesos, cadencias o cambios mensuales atipicos.", "Validar dato, incidente o cambio real de operacion antes de intervenir."],
    ], [3.05 * cm, 4.35 * cm, 4.85 * cm, 4.75 * cm]))
    story += [Spacer(1, 0.25 * cm), p("Key takeaways automatizados", "h2"),
              p("Se muestran entre tres y cinco, usando lenguaje neutral y siempre con una base cuantitativa enlazable. Ejemplos de patrones que el sistema puede comunicar:"),
              bullet("<b>Presion de retirada:</b> “La entrada de [familia] en [Garbigune] crecio un X% frente a dias equivalentes y la cadencia de salida no aumento.”"),
              bullet("<b>Variabilidad de ruta:</b> “La ruta [ruta] concentra X t, pero su kg/viaje presenta dispersion alta respecto a rutas comparables.”"),
              bullet("<b>Desajuste de registro:</b> “La diferencia acumulada entrada-salida para [familia] supera el umbral de revision; revisar periodos, equivalencias y stock.”"),
              bullet("<b>Discontinuidad:</b> “La actividad de [punto] cae/sube de forma atipica; comprobar calendario, movilidad, incidencia o cambio de registro.”"),
              bullet("<b>Calidad:</b> “X% de salidas no tiene ruta normalizada; el analisis de rutas debe leerse con cobertura parcial.”"),
              Spacer(1, 0.18 * cm),
              callout("Regla de redaccion", "Las lecturas automaticas describen evidencia y sugieren revision. No atribuyen causas ni recomiendan cerrar, penalizar o eliminar un Garbigune."), PageBreak()]

    story += section("5. Graficas y tablas requeridas", "Cada visual sigue el sistema grafico comun que se definira despues: escala, tipografia, leyenda, tooltip, estados vacios y exportacion. Esta especificacion fija el comportamiento funcional.")
    story.append(table(["Componente", "Especificacion", "Interaccion"], [
        ["Evolucion mensual", "Barras apiladas por residuo para toneladas de salida o entrada; linea para servicios cuando comparte escala secundaria visible. Orden cronologico por defecto.", "Leyenda clicable: al deseleccionar un residuo queda atenuado y sincroniza filtro global. Tooltip: mes, t, %, servicios y comparativo equivalente."],
        ["Entrada vs salida", "Dos series o small multiples; usar familias homologadas. Separar la unidad y marcar balance estimado.", "Click en familia o Garbigune aplica seleccion local visible. No mezclar residuos sin equivalencia activa."],
        ["Ranking de Garbigunes", "Barras horizontales con selector discreto de metrica: entradas, salidas, servicios, kg/viaje, presion estimada.", "Orden invertible desde el eje; boton Ver mas expande sin sustituir la grafica."],
        ["Scatter de rutas", "Ejes configurables: servicios, toneladas, kg/viaje, dias activos y variabilidad. Tamano por volumen; color por confianza o residuo dominante.", "Hover con ficha de ruta; click fija seleccion y actualiza tabla de detalle."],
        ["Calendario / cadencia", "Heatmap por dia o matriz Garbigune x mes para servicios y dias desde ultima salida.", "Escala clara, ceros en gris suave y celdas vacias diferenciadas de cero."],
        ["Tabla operativa", "Filas por Garbigune, ruta, residuo o mes; columnas comparables y total.", "Orden, filtros de columna, descarga CSV y enlace a detalle. Nunca esconder cero y dato ausente bajo el mismo simbolo."],
    ], [3.1 * cm, 8.05 * cm, 5.85 * cm]))
    story += [Spacer(1, 0.2 * cm), p("Tooltips y seleccion", "h2"),
              bullet("Todos los tooltips incluyen periodo, unidad, denominador y cobertura. Ejemplo: “3.2 t, 12 servicios, 267 kg/servicio, 23 de 31 dias con datos”."),
              bullet("La seleccion debe ser reversible: click para fijar, segundo click o chip para liberar, y Restablecer solo en el panel global."),
              bullet("Las leyendas no se superponen a ejes ni a valores. En pantallas pequenas pasan debajo de la grafica como lista con scroll, no como una franja comprimida."),
              Spacer(1, 0.22 * cm), p("Estados especiales", "h2"),
              table(["Estado", "Respuesta de interfaz"], [
                  ["Sin datos para el filtro", "Explicar que combinacion esta activa y ofrecer Restablecer o ampliar periodo. No mostrar grafica vacia sin contexto."],
                  ["Cobertura parcial", "Badge visible con fechas y porcentaje/filas afectadas. La lectura automatica debe rebajar su confianza."],
                  ["Mes parcial", "Etiqueta junto al KPI y comparativo calculado a dias equivalentes; si no es calculable, ocultar el delta."],
                  ["Residuo no homologado", "No incluir en balance entrada-salida. Mostrarlo en calidad de datos con enlace a la configuracion de equivalencias."],
              ], [4.2 * cm, 12.8 * cm]), PageBreak()]

    story += section("6. Outliers, calidad y confianza", "Los outliers se utilizan para priorizar revision. No son errores confirmados ni juicios de rendimiento.")
    story.append(table(["Tipo de excepcion", "Regla inicial", "Lectura", "Accion sugerida"], [
        ["Peso atipico", "Kg por servicio por encima/bajo percentiles 5/95 dentro de residuo y ruta comparables; minimo 10 observaciones.", "Posible carga inusual, error de pesada o mezcla de contextos.", "Validar pesada, residuo y servicio; conservar evidencia."],
        ["Cadencia atipica", "Dias desde la ultima salida > percentil 90 de su punto/familia, con actividad de entrada relevante.", "Posible presion de retirada o interrupcion de registro.", "Revisar calendario, ruta, festivos y disponibilidad."],
        ["Cambio mensual", "Variacion superior a umbral robusto frente a dias equivalentes y mediana historica.", "Cambio de demanda, operativo o de fuente.", "Comparar con residuo, punto, ruta e incidencias."],
        ["Balance persistente", "Diferencia entrada-salida homologada mantenida durante N meses; excluir meses con cobertura incompleta.", "No implica stock exacto: puede ser corte temporal o equivalencia incompleta.", "Contrastar con operacion y configurar equivalencias si procede."],
        ["Calidad de ruta", "route = SIN RUTA o site_key no normalizado.", "Limita la lectura territorial y de rutas.", "Enviar al informe de calidad y completar alias/configuracion."],
    ], [3.0 * cm, 4.35 * cm, 4.75 * cm, 4.9 * cm]))
    story += [Spacer(1, 0.25 * cm), p("Score de prioridad", "h2"),
              p("La tabla de excepciones puede ordenar por un score transparente de 0 a 100. Propuesta inicial: 40% impacto (t afectadas), 25% desviacion respecto a comparables, 20% persistencia y 15% calidad/cobertura. El score no se muestra como veredicto, sino como criterio de cola de revision."),
              p("Cada fila debe incluir: entidad afectada, periodo, metrica observada, referencia, impacto estimado, confianza, regla activada, estado de revision, responsable y comentario. Exportar la lista filtrada a CSV."),
              Spacer(1, 0.18 * cm),
              callout("Confianza", "Alta: muestra suficiente, cobertura completa y equivalencias activas. Media: una limitacion relevante. Baja: periodo parcial, muestra pequena, SIN RUTA o informacion no homologada.", colors.HexColor("#FFF7E8")), PageBreak()]

    story += section("7. Modelo de datos, calculos y contratos", "Los calculos analiticos recurrentes deben residir en Python/Supabase; el navegador consume agregados y se centra en filtros, seleccion y renderizado.")
    story.append(table(["Necesidad", "Capa recomendada", "Salida contractual"], [
        ["Series de entradas", "Supabase / preagregado", "Mes, fecha, site_key, familia/subfamilia AW, tipo de usuario, kg, lineas y visitas si existe clave fiable."],
        ["Series de salidas", "Supabase / preagregado", "Mes, site_key, ruta, base, residuo, familia AW equivalente, kg, servicios, kg/viaje, dias activos."],
        ["Balance homologado", "Vista SQL generica", "Periodo, site_key, familia AW, kg_entrada, kg_salida_ponderada, balance_estimado, cobertura de mapeo."],
        ["Outliers y lecturas", "Python en pipeline", "Regla, entidad, periodo, valor, referencia, impacto, confianza, texto y accion sugerida."],
        ["Interaccion visual", "Frontend", "Aplicacion de filtros, tooltips, estado de seleccion, orden y exportacion del subconjunto visible."],
    ], [4.2 * cm, 4.25 * cm, 8.55 * cm]))
    story += [Spacer(1, 0.25 * cm), p("Configuraciones editables", "h2"),
              bullet("<b>config_site_aliases</b>: nombre operativo, site_key, tipo de punto y notas; evita aliases hardcodeados."),
              bullet("<b>config_residuos_salida_aw_equivalencias</b>: residuo de salida, familia AW, peso, activo y nota metodologica."),
              bullet("<b>config_quality_rules</b>: umbral, ambito, severidad, accion y vigencia de reglas de calidad."),
              bullet("<b>quality_aw_weight_corrections</b>: correcciones auditables; el dato original nunca se elimina."),
              Spacer(1, 0.25 * cm), p("Criterios de aceptacion", "h2"),
              table(["Criterio", "Verificacion"], [
                  ["Trazabilidad", "Cada tarjeta y grafica declara fuente, definicion y periodo; entradas y salidas no se confunden."],
                  ["Comparabilidad", "Los deltas temporales respetan dias equivalentes y muestran mes parcial cuando aplique."],
                  ["Filtrado", "Filtros globales sincronizan todas las vistas compatibles; leyendas de residuo reflejan y modifican esa seleccion."],
                  ["Legibilidad", "Ejes, unidades, leyendas, textos y tooltips permanecen visibles en escritorio, tablet y movil."],
                  ["Accionabilidad", "Toda lectura automatica enlaza a evidencia y propone una revision concreta, sin afirmar causalidad."],
              ], [4.0 * cm, 13.0 * cm]), PageBreak()]

    story += section("8. Hoja de ruta de implementacion", "El eje puede construirse en incrementos sin bloquear la futura guia de estilos ni el resto de pestañas.")
    story.append(table(["Fase", "Entregable", "Dependencias"], [
        ["1. Fundacion", "Contrato de datos, definiciones, filtros globales, taxonomia Entradas / Salidas / Comparativa y control de mes parcial.", "Vistas genericas actuales y configuraciones de aliases/equivalencias."],
        ["2. Lectura ejecutiva", "KPI, Pulso operativo, Puntos bajo presion, lecturas automaticas y estados de cobertura.", "Agregados mensuales y reglas de confianza."],
        ["3. Analisis operativo", "Rutas de carga variable, balance por familia, tabla de excepciones y exportacion CSV.", "Outliers calculados en pipeline y mapeo de residuos validado."],
        ["4. Madurez", "Presion/llenado con inventario o capacidades, relacion con incidencias y ajustes por distancia/capacidad.", "Nuevas fuentes operativas y validacion con Garbiker."],
    ], [2.0 * cm, 8.2 * cm, 6.8 * cm]))
    story += [Spacer(1, 0.35 * cm), p("Decisiones que debe hacer mas faciles", "h2"),
              bullet("Que puntos y fracciones merecen revisar primero la frecuencia de recogida."),
              bullet("Que rutas requieren revisar su secuencia, agrupacion de puntos o tipo de vehiculo por volumen y variabilidad."),
              bullet("Donde existe un desajuste persistente que exige contrastar registro, equivalencia o situacion operativa."),
              bullet("Que cambios mensuales justifican una comprobacion de calendario, incidencias o cobertura antes de actuar."),
              bullet("Que limitaciones de calidad condicionan la confianza de una conclusion y deben resolverse en origen."),
              Spacer(1, 0.45 * cm),
              callout("Cierre", "El exito de la pestana no es acumular indicadores: es permitir que una persona responsable llegue desde una alerta a una evidencia filtrada y a una accion de revision concreta en pocos pasos."),
              Spacer(1, 0.35 * cm),
              p("Documento preparado para convivir con una futura guia global de estilos. Los patrones funcionales descritos aqui deberan materializarse con los componentes, tokens y reglas de accesibilidad de dicha guia.", "small")]

    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build()
