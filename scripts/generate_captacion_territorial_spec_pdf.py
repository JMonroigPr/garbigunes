#!/usr/bin/env python3
"""Genera la especificacion funcional del eje Captacion territorial."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Spacer

import generate_flujos_recogidas_spec_pdf as base


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "axes" / "03_Captacion_Territorial.pdf"


class TerritoryFlowDiagram(Flowable):
    def __init__(self, width=17 * cm, height=3.2 * cm):
        super().__init__()
        self.width, self.height = width, height

    def draw(self):
        c = self.canv
        blocks = [
            ("CP / municipio", "origen declarado", colors.HexColor("#EAF3EF")),
            ("Entrada AW", "familia y usuario", colors.HexColor("#E2F0EA")),
            ("Garbigune observado", "destino de entrada", colors.HexColor("#F7EEDC")),
            ("Flujo territorial", "distancia y captacion", colors.HexColor("#EAF3EF")),
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


class TerritoryWireframe(Flowable):
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
        for i, label in enumerate(["Periodo", "Familia AW", "Garbigune", "CP origen", "Usuario", "Flujos a revisar"]):
            c.drawString(.42 * cm, 7.96 * cm - i * .69 * cm, label)
            c.setStrokeColor(base.LINE); c.roundRect(.42 * cm, 7.63 * cm - i * .69 * cm, 2.75 * cm, .35 * cm, 3, stroke=1, fill=0)
        self.box(c, 3.72 * cm, 7.1 * cm, 12.95 * cm, 1.57 * cm, "Lecturas automaticas: cobertura, flujos no cercanos y casos prioritarios", colors.HexColor("#FFF7E8"))
        for x, label in [(3.72, "CP activos"), (6.96, "t con CP"), (10.2, "No cercano"), (13.44, "t-km extra")]:
            self.box(c, x * cm, 5.67 * cm, 2.92 * cm, 1.08 * cm, label)
        self.box(c, 3.72 * cm, 2.7 * cm, 8.22 * cm, 2.62 * cm, "Mapa CP y Garbigunes: capas, seleccion y lineas de flujo")
        self.box(c, 12.19 * cm, 2.7 * cm, 4.48 * cm, 2.62 * cm, "Perfil de captacion / familia")
        self.box(c, 3.72 * cm, .25 * cm, 12.95 * cm, 2.05 * cm, "Tabla CP → Garbigune y casos prioritarios de revision")


def footer(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(base.LINE)
    canvas.line(1.7 * cm, 1.2 * cm, 19.3 * cm, 1.2 * cm)
    canvas.setFillColor(base.MUTED); canvas.setFont("Arial", 7.2)
    canvas.drawString(1.7 * cm, .74 * cm, "Garbiker - Especificacion funcional | Captacion territorial")
    canvas.drawRightString(19.3 * cm, .74 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build():
    base.register_fonts(); base.S = base.styles(); OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=1.7 * cm, rightMargin=1.7 * cm,
                          topMargin=1.55 * cm, bottomMargin=1.55 * cm,
                          title="Especificacion - Captacion territorial", author="Garbiker")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    p, t, c = base.p, base.table, base.callout
    story = [Spacer(1, 1.1 * cm), p("Captacion territorial", "title"),
             p("Especificacion funcional del tercer eje del visor Garbigunes", "subtitle"),
             c("Proposito", "Comprender de donde proceden las entradas AW, que Garbigunes captan cada zona y que flujos CP → Garbigune merecen una revision territorial por impacto, distancia relativa o falta de contexto."),
             Spacer(1, .42 * cm), p("Alcance", "h2"),
             p("Pestana autonoma basada en codigo postal y municipio de origen de las entradas AW. Permite explorar areas de influencia observadas, perfil material por origen y Garbigune, y la diferencia entre el punto observado y el Garbigune mas cercano estimado."),
             p("No es un modelo de movilidad ni una evaluacion de accesibilidad completa: la distancia actual se calcula entre centroides de CP y ubicaciones de Garbigunes, en linea recta. No representa ruta real, tiempo de viaje, preferencias del usuario ni barreras de acceso."),
             Spacer(1, .28 * cm), TerritoryFlowDiagram(), Spacer(1, .27 * cm),
             p("Principios de interpretacion", "h2"),
             base.bullet("El CP es una unidad agregada. El visor no muestra domicilios, personas ni movimientos individuales."),
             base.bullet("Un flujo no hacia el Garbigune mas cercano es una <b>señal para contextualizar</b>, no una evidencia de ineficiencia."),
             base.bullet("Los CP sin geometria, sin origen informado o con pocas observaciones se etiquetan; nunca se imputan en el mapa."),
             Spacer(1, .24 * cm), p("Fuentes disponibles", "h2"),
             t(["Fuente", "Grano", "Uso territorial", "Limite a mostrar"], [
                 ["fact_captacion_aw", "Agregado por mes, sitio, CP, residuo, familia y usuario.", "Toneladas, lineas/entradas proxy, municipio y CP de origen; flujo observado CP → Garbigune.", "El historico no tiene ID de visita: numero de registros es un proxy estable, no visitas reales."],
                 ["bizkaia_codigos_postales.geojson", "Poligono por CP", "Mapa, centroides de CP, cobertura geometrica y distancias aproximadas.", "Centroide y linea recta no son recorrido por carretera ni tiempo."],
                 ["dim_garbigunes", "Garbigune/punto", "Ubicacion, site_key, tipo fijo/movil y estado para el mapa.", "Ubicaciones deben mantener fuente y fecha de verificacion."],
                 ["Convenios municipales", "Municipio", "Contextualizar flujos intermunicipales cuando exista convenio firmado.", "No demuestra por si solo motivo de desplazamiento ni area de servicio."],
             ], [3.2 * cm, 3.1 * cm, 6.2 * cm, 4.5 * cm]), PageBreak()]

    story += [p("1. Preguntas decisionales y metricas", "h1"),
              p("La pestana debe ofrecer una lectura de demanda territorial observada, no convertir la procedencia declarada en una asignacion normativa de cobertura."),
              t(["Pregunta", "Indicadores", "Decision habilitada"], [
                  ["¿De que CP y municipios proceden las entradas?", "t, registros, familias, CP activos, participacion y tendencia.", "Comprender la huella territorial y priorizar comunicacion o seguimiento."],
                  ["¿Que Garbigune capta cada zona?", "Flujos CP → Garbigune, participacion por destino y diversidad de CP de cada punto.", "Identificar areas de influencia observadas y dependencias de captacion."],
                  ["¿Que familias viajan desde cada territorio?", "Composicion por familia/subfamilia, usuario y CP/municipio.", "Enfocar informacion, aceptacion y circuitos a necesidades territoriales reales."],
                  ["¿Que flujos no siguen el punto mas cercano?", "Distancia observada, distancia minima, km extra y t-km extra estimados.", "Abrir revision contextual: convenio, municipio, especializacion, horario o calidad."],
                  ["¿Donde falta cobertura de datos?", "% kg con CP, % CP con poligono, origen faltante y muestra minima.", "Mejorar captura del dato antes de extraer conclusiones territoriales."],
              ], [4.25 * cm, 6.15 * cm, 6.6 * cm]), Spacer(1, .24 * cm), p("Metricas nucleares", "h2"),
              t(["Metrica", "Definicion", "Uso correcto"], [
                  ["Cobertura CP", "Kg o registros con CP informado y CP cruzable con poligono / total visible.", "Determina la confianza geografica; no se confunde con cobertura del servicio."],
                  ["Area de influencia observada", "Conjunto y peso de CP que registran entradas en un Garbigune.", "Describe comportamiento observado, no delimita un area oficial."],
                  ["Garbigune mas cercano", "Punto fijo activo con menor distancia en linea recta desde el centroide del CP.", "Referencia comparativa; no tiene en cuenta red viaria ni tipologia aceptada."],
                  ["Km extra / t-km extra", "Diferencia entre distancia observada y minima, multiplicada por toneladas cuando corresponde.", "Prioriza casos de revision, no calcula impacto real de movilidad."],
                  ["Diversidad de origen", "Numero de CP/municipios y su concentracion por Garbigune.", "Distingue captacion distribuida de dependencia en pocas zonas."],
              ], [3.15 * cm, 7.1 * cm, 6.75 * cm]), Spacer(1, .18 * cm),
              c("Privacidad y escala", "Los resultados se agregan por CP y periodo. El visor aplica supresion o agrupacion de microflujos segun umbral definido con Garbiker; nunca permite reconstruir actividad individual.", colors.HexColor("#FFF7E8")), PageBreak()]

    story += [p("2. Navegacion, filtros y persistencia", "h1"),
              p("La navegacion superior es comun a los ejes. Captacion territorial mantiene filtros locales adicionales porque CP, composicion y estado de revision requieren una exploracion espacial propia."),
              p("Navegacion", "h2"),
              t(["Elemento", "Especificacion"], [
                  ["Pestana activa", "Captacion territorial. Etiqueta de dominio: <b>Entradas AW - origen y flujos observados</b>."],
                  ["Modo Ejecutivo", "Muestra huella territorial, Garbigunes captadores, flujos no cercanos prioritarios y tres conclusiones resumidas."],
                  ["Modo Analista", "Activa capas de mapa, composicion de CP, selector de metrica, tabla de flujos, metodologia y filtros de revision."],
                  ["URL compartible", "Los filtros locales de captacion se persisten como parametros URL: CP, Garbigune, familia, subfamilia, residuo, usuario, metrica, nivel de composicion y estado de flujo."],
              ], [4.4 * cm, 12.6 * cm]), p("Panel de filtros", "h2"),
              t(["Orden", "Filtro", "Comportamiento y alcance"], [
                  ["1", "Intervalo", "Selector mes inicial - mes final comun. El ultimo mes parcial se marca y se compara a dias equivalentes."],
                  ["2", "Familia/subfamilia/residuo AW", "Chips sincronizados con taxonomia AW. La leyenda del mapa puede modificar la misma seleccion."],
                  ["3", "Garbigune", "Multiseleccion de destinos observados; identifica puntos fijos y moviles cuando aplique."],
                  ["4", "CP y municipio origen", "Busqueda y seleccion directa desde mapa, tabla o chips. Elegir CP actualiza flujos, perfil de residuo y destino."],
                  ["5", "Tipo de usuario", "Filtro exclusivo de entradas AW, visible en Analista si tiene cobertura suficiente."],
                  ["6", "Flujos a revisar", "Todas, mas cercano, no mas cercano o Revisar; se explica la regla y no se ocultan las razones conocidas."],
              ], [1.1 * cm, 3.65 * cm, 12.25 * cm]), Spacer(1, .18 * cm),
              c("Seleccion bidireccional", "Click en un CP: fija CP, actualiza destinos y composicion. Click en un Garbigune: fija destino, actualiza CP de origen. Las lineas CP → Garbigune y la tabla reflejan la misma seleccion. Todo filtro se libera mediante chip o Restablecer."), PageBreak()]

    story += [p("3. Arrangement de la pestana", "h1"),
              p("El orden visual va de cobertura y lectura general al mapa, flujos concretos y excepciones. El mapa ocupa protagonismo, pero no es la unica forma de acceder a la informacion."),
              TerritoryWireframe(), Spacer(1, .24 * cm), p("Bloques funcionales", "h2"),
              t(["Bloque", "Contenido", "Comportamiento"], [
                  ["A. Contexto", "Titulo, periodo, chips, cobertura de CP/geometria, modo Ejecutivo/Analista.", "Explicita que se trata de entradas AW y datos de origen declarados."],
                  ["B. Lecturas", "3 a 5 conclusiones sobre captacion, cobertura, flujos y casos prioritarios.", "Cada lectura enlaza al CP, Garbigune o flujo que la sostiene."],
                  ["C. KPI", "CP activos, toneladas con CP, porcentaje de flujos al mas cercano, km extra y t-km extra estimados.", "Los KPI de distancia indican “estimado en linea recta”."],
                  ["D. Mapa", "Poligonos CP, puntos Garbigune, lineas de flujo y capas de volumen/composicion/revision.", "Seleccion bidireccional, leyenda clara, zoom al elemento y alternativa de tabla."],
                  ["E. Perfil", "Top CP, destinos por CP, composicion por familia y tendencia.", "Cambiar metrica sin modificar el filtro de datos activo."],
                  ["F. Revision", "Tabla CP → Garbigune, motivos conocidos y casos prioritarios ordenados por t-km extra.", "Exportacion CSV especifica para revision operativa."],
              ], [3.25 * cm, 7.2 * cm, 6.55 * cm]), p("Reglas del mapa", "h2"),
              base.bullet("Capas conmutables: toneladas por CP, familia dominante, Garbigunes, flujos, no mas cercano y casos prioritarios. Nunca todas las etiquetas simultaneas."),
              base.bullet("Las lineas de flujo usan grosor por toneladas y color por estado: cercano, contexto conocido, revisar o sin distancia."),
              base.bullet("En movil se utiliza lista/tablas como alternativa principal; el mapa conserva zoom, capas esenciales y una leyenda plegable."),
              base.bullet("No usar un coropleta para valores escasos sin aviso: aplicar muestra minima o agrupar en “otros CP”."), PageBreak()]

    story += [p("4. Vistas predeterminadas e insights", "h1"),
              p("Las vistas iniciales hacen visible la huella territorial sin exigir que la persona usuaria conozca previamente los codigos postales o la estructura geoespacial."),
              t(["Vista", "Configuracion inicial", "Insight esperado", "Decision / siguiente paso"], [
                  ["1. Huella territorial", "Ultimos 12 meses completos; todos los Garbigunes y familias; mapa de t por CP y ranking de origen.", "Ver territorios de mayor captacion y calidad de geocodificacion.", "Priorizar seguimiento, comunicacion o mejora de captura de CP."],
                  ["2. Areas de influencia observadas", "Garbigune seleccionable; lineas CP → punto y top CP por volumen.", "Entender si el punto capta de forma local, distribuida o concentrada.", "Comparar con tipo de punto, convenios y oferta observada."],
                  ["3. Flujos no mas cercanos", "Flujos con distancia minima disponible; ordenar por t-km extra estimados.", "Identificar 5-10 flujos cuyo contraste merece mayor revision.", "Comprobar motivo conocido, horario, residuo, convenio o error de dato."],
                  ["4. Perfil material de origen", "CP o municipio seleccionado; familias/subfamilias y destinos observados.", "Detectar que residuos caracterizan una zona y a que punto llegan.", "Orientar informacion territorial, aceptacion o seguimiento especializado."],
                  ["5. Cobertura y excepciones", "Todos los datos; CP sin geometria, sin CP y microflujos separados.", "Saber que parte del mapa es robusta y donde no procede concluir.", "Solicitar mejora de dato o mantener resultado como orientativo."],
              ], [3.05 * cm, 4.35 * cm, 4.85 * cm, 4.75 * cm]), Spacer(1, .24 * cm), p("Key takeaways automatizados", "h2"),
              base.bullet("<b>Huella:</b> “Los CP visibles explican X% de las toneladas AW; Y% de los CP informados tiene poligono disponible.”"),
              base.bullet("<b>Area de influencia:</b> “[Garbigune] recibe X t desde N CP; los tres principales aportan Y% del volumen visible.”"),
              base.bullet("<b>Flujo prioritario:</b> “El flujo [CP] → [Garbigune] no corresponde al punto mas cercano y concentra X t-km extra estimados; motivo: [contexto/sin confirmar].”"),
              base.bullet("<b>Perfil:</b> “En [CP/municipio], [familia] representa X% de la entrada visible y se dirige principalmente a [Garbigune].”"),
              base.bullet("<b>Calidad:</b> “La lectura territorial de [zona] tiene confianza media/baja por CP faltante, geometria no encontrada o muestra reducida.”"),
              Spacer(1, .16 * cm), c("Regla de redaccion", "Los insights describen captacion observada y distancia estimada. No atribuyen el desplazamiento a una eleccion del usuario ni recomiendan modificar cobertura sin validacion operativa."), PageBreak()]

    story += [p("5. Mapa, graficas y tabla de flujos", "h1"),
              p("El mapa debe servir a una pregunta concreta y mantener una alternativa tabular accesible. Las leyendas y tooltips explican unidad, periodo, cobertura y metodo de distancia."),
              t(["Componente", "Especificacion", "Interaccion"], [
                  ["Mapa CP", "Poligonos de Bizkaia por CP; coropleta por toneladas, registros, familia dominante o % no cercano.", "Click CP filtra y centra. Tooltip: CP, t, registros proxy, familias, destinos, cobertura y confianza."],
                  ["Puntos Garbigune", "Marcador por ubicacion; tamano por t captadas y color por tipo/punto o familia dominante.", "Click fija destino; tooltip con CP de origen, t, perfil y tipo fijo/movil."],
                  ["Lineas de flujo", "CP centroide → Garbigune observado; grosor por t, estado por cercano/contexto/revisar.", "Hover: t, familia, distancia observada, minima, km extra, t-km extra y motivo conocido."],
                  ["Perfil de CP", "Barras por familia/subfamilia y destinos del CP seleccionado; cronologia mensual cuando aplique.", "Leyenda clicable sincroniza filtro de residuos AW y conserva deseleccionados atenuados."],
                  ["Tabla CP → Garbigune", "CP, municipio, Garbigune observado, mas cercano, t, registros, distancia, delta km, t-km, estado y motivo.", "Orden, filtros de columna, descarga CSV y seleccion bidireccional con mapa."],
                  ["Casos prioritarios", "Top 5-10 flujos Revisar por t-km extra, con impacto, contexto y confianza.", "Exportacion CSV separada para la revision operativa; no incluye datos personales."],
              ], [3.1 * cm, 8.05 * cm, 5.85 * cm]), Spacer(1, .22 * cm), p("Leyenda, hover y accesibilidad", "h2"),
              base.bullet("La leyenda no cubre el mapa. En escritorio ocupa una columna lateral o franja inferior; en movil se pliega y conserva el estado de seleccion."),
              base.bullet("Los valores de area y color siempre tienen alternativa en tooltip y tabla; no se depende solo de la percepcion cromatica."),
              base.bullet("Las lineas se limitan por umbral o seleccion: mostrar todas las lineas densas degrada la lectura. El estado “todas” prioriza agregacion por CP o destino."),
              base.bullet("El mapa explica “distancia en linea recta desde el centroide del CP” junto al control de flujos, no escondido en metodologia."), PageBreak()]

    story += [p("6. Outliers y casos prioritarios", "h1"),
              p("La prioridad se basa en impacto potencial de revision, no en un supuesto de conducta incorrecta. Un flujo no cercano puede explicarse por convenios, tipologia de residuo, horarios, desplazamiento habitual o la imprecision de la referencia espacial."),
              t(["Tipo de excepcion", "Regla inicial", "Lectura", "Accion sugerida"], [
                  ["Flujo no cercano", "Garbigune observado distinto del fijo activo mas cercano por distancia centroide → punto.", "Diferencia espacial que requiere contexto, no anomalia confirmada.", "Mostrar motivo conocido o solicitar validacion operativa."],
                  ["Impacto t-km", "Toneladas x km extra estimados; muestra minima y distancia minima disponible.", "Ordena los casos con mayor impacto potencial de desplazamiento.", "Revisar primero 5-10 casos, no todos los flujos."],
                  ["Origen atipico", "CP con composicion o destino muy distinto de su patron historico/comparable.", "Cambio de demanda, campaña, clasificacion o registro.", "Contrastar periodo, familia, municipio y calidad del dato."],
                  ["Cobertura geometrica", "CP informado sin poligono o Garbigune sin coordenada validada.", "No permite calcular distancia ni representar flujo.", "Registrar en calidad y actualizar maestro/geometria."],
                  ["Microflujo", "Volumen o registros bajo umbral de publicacion/interpretacion.", "Evidencia insuficiente o riesgo de lectura erratica.", "Agrupar, ocultar detalle o mantener solo en Analista segun regla de privacidad."],
              ], [3.0 * cm, 4.35 * cm, 4.75 * cm, 4.9 * cm]), Spacer(1, .25 * cm), p("Score de prioridad", "h2"),
              p("Propuesta inicial de score 0-100: 50% t-km extra estimados, 20% toneladas, 15% persistencia, 10% ausencia de motivo conocido y 5% calidad suficiente. La formula se configura y su resultado se presenta como cola de revision, no como calificacion del CP o Garbigune."),
              p("Cada caso debe incluir CP, municipio de origen, Garbigune observado, mas cercano, familia, toneladas, distancias, t-km extra, regla, motivo, confianza, estado de revision, responsable y comentario. La exportacion CSV usa exactamente esas columnas."),
              Spacer(1, .16 * cm), c("Razones contextuales", "Orden de explicacion: mismo municipio, convenio municipal, familia/residuo que pueda requerir punto concreto, horario/servicio, preferencia no observada y, por ultimo, dato a revisar. Las razones conocidas se muestran antes de marcar un caso como Revisar.", colors.HexColor("#FFF7E8")), PageBreak()]

    story += [p("7. Modelo de datos y calculos", "h1"),
              p("Los calculos geoespaciales, proximidad y prioridades se preparan en Python/Supabase. El navegador carga el GeoJSON bajo demanda al abrir la pestana y se concentra en capas, filtros y seleccion."),
              t(["Necesidad", "Capa recomendada", "Salida contractual"], [
                  ["Flujos territoriales", "Supabase / preagregado", "Mes, CP, municipio, site_key, familia/subfamilia, usuario, kg, registros y cobertura."],
                  ["Geometria", "Archivo GeoJSON bajo demanda", "Poligono CP, codigo postal y propiedades minimas; no incluir filas de entradas dentro del GeoJSON."],
                  ["Distancia y punto cercano", "Python / pipeline", "CP, centroide, Garbigune observado, mas cercano, distancia estimada, delta km, estado y metodo."],
                  ["Casos prioritarios", "Python / pipeline", "Flujo, regla, t-km, persistencia, motivo, confianza, score y accion sugerida."],
                  ["Interaccion y URL", "Frontend", "Filtros locales, capas, seleccion bidireccional, serializacion de URL y exportacion del subconjunto filtrado."],
              ], [4.15 * cm, 4.5 * cm, 8.35 * cm]), Spacer(1, .22 * cm), p("Configuracion editable", "h2"),
              base.bullet("<b>dim_garbigunes</b>: site_key, ubicacion, tipo fijo/movil, coordenadas, fuente, vigencia y estado activo."),
              base.bullet("<b>config_familias_aw</b>: familia y subfamilia para interpretar composicion sin reglas hardcodeadas."),
              base.bullet("<b>config_site_aliases</b>: normalizacion de Garbigunes/puntos para evitar destinos fragmentados."),
              base.bullet("Futura <b>config_territorial_context</b>: convenios, notas de servicio, temporalidad, excepciones justificadas y evidencia."),
              Spacer(1, .22 * cm), p("Criterios de aceptacion", "h2"),
              t(["Criterio", "Verificacion"], [
                  ["Trazabilidad", "Cada flujo conserva CP, destino observado, fuente, periodo, metodo de distancia y cobertura."],
                  ["Privacidad", "Sin PII, microflujos gestionados por umbral y exportacion limitada a datos agregados."],
                  ["Claridad espacial", "La interfaz distingue distancia estimada en linea recta de ruta/tiempo real."],
                  ["Sincronizacion", "Mapa, tabla, perfil y filtros globales/locales mantienen una unica seleccion visible."],
                  ["Rendimiento", "GeoJSON se carga bajo demanda; el payload base no incorpora poligonos de CP."],
              ], [4.0 * cm, 13.0 * cm]), PageBreak()]

    story += [p("8. Hoja de ruta de implementacion", "h1"),
              p("La base ya permite desplegar un primer nivel de mapa, filtros y flujos. Las mejoras posteriores deben reforzar el contexto y la comparacion espacial, no asumir datos que aun no existen."),
              t(["Fase", "Entregable", "Dependencias"], [
                  ["1. Fundacion", "Mapa bajo demanda, CP → Garbigune, filtros URL, cobertura CP/geometria y seleccion bidireccional.", "fact_captacion_aw, GeoJSON de CP y dim_garbigunes actualizados."],
                  ["2. Lectura ejecutiva", "Huella, areas observadas, perfil territorial, flujos no cercanos y casos prioritarios.", "Agregados territoriales y reglas de muestra/confianza."],
                  ["3. Contexto", "Motivos conocidos, convenios, exportacion de casos, estado de revision y notas operativas.", "Tabla de contexto territorial validada con Garbiker."],
                  ["4. Madurez", "Distancia por carretera, tiempos, poblacion, accesibilidad y modelos de demanda normalizados.", "Fuentes fiables de red viaria, poblacion y oferta/horarios."],
              ], [2.0 * cm, 8.15 * cm, 6.85 * cm]), Spacer(1, .34 * cm), p("Decisiones que debe hacer mas faciles", "h2"),
              base.bullet("Que zonas y CP explican la captacion observada de cada Garbigune y de cada familia de residuo."),
              base.bullet("Que flujos territoriales merecen una conversacion operativa por su impacto potencial, no una conclusion automatica."),
              base.bullet("Donde puede ser util mejorar informacion, registrar mejor el origen o revisar contextos de convenio y servicio."),
              base.bullet("Que Garbigunes presentan un perfil de captacion territorial concentrado, distribuido o materialmente diferencial."),
              base.bullet("Que limitaciones de CP, geometria o muestra condicionan la confianza de la lectura."),
              Spacer(1, .42 * cm), c("Cierre", "El valor de esta pestana es hacer visible la geografia real observada del servicio y transformar los flujos llamativos en una lista breve, explicable y revisable de preguntas operativas."), Spacer(1, .3 * cm),
              p("Documento preparado para aplicar una futura guia global de estilos. Los comportamientos y contratos descritos aqui se implementaran con los componentes, tokens y reglas de accesibilidad de dicha guia.", "small")]
    doc.build(story); print(OUTPUT)


if __name__ == "__main__":
    build()
