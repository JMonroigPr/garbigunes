#!/usr/bin/env python3
"""Genera la especificacion funcional del eje Especializacion de residuos."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Spacer

import generate_flujos_recogidas_spec_pdf as base


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "axes" / "02_Especializacion_de_Residuos.pdf"


class CompositionDiagram(Flowable):
    def __init__(self, width=17.0 * cm, height=3.2 * cm):
        super().__init__()
        self.width, self.height = width, height

    def draw(self):
        c = self.canv
        blocks = [
            ("Residuo AW", "clasificacion base", colors.HexColor("#EAF3EF")),
            ("Familia", "agregacion comparable", colors.HexColor("#E2F0EA")),
            ("Subfamilia", "lectura operativa", colors.HexColor("#F7EEDC")),
            ("Perfil del punto", "concentracion y singularidad", colors.HexColor("#EAF3EF")),
        ]
        w, h, y = 3.55 * cm, 1.48 * cm, 0.92 * cm
        for i, (title, sub, fill) in enumerate(blocks):
            x = i * 4.45 * cm
            c.setFillColor(fill)
            c.setStrokeColor(base.LINE)
            c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
            c.setFillColor(base.DARK)
            c.setFont("Arial-Bold", 8.9)
            c.drawCentredString(x + w / 2, y + .91 * cm, title)
            c.setFillColor(base.MUTED)
            c.setFont("Arial", 6.9)
            c.drawCentredString(x + w / 2, y + .51 * cm, sub)
            if i < len(blocks) - 1:
                c.setStrokeColor(base.GREEN)
                c.setLineWidth(1.2)
                c.line(x + w + .12 * cm, y + h / 2, x + 4.25 * cm, y + h / 2)
                c.line(x + 4.25 * cm, y + h / 2, x + 4.0 * cm, y + h / 2 + .12 * cm)
                c.line(x + 4.25 * cm, y + h / 2, x + 4.0 * cm, y + h / 2 - .12 * cm)


class WasteWireframe(Flowable):
    def __init__(self, width=17.0 * cm, height=9.75 * cm):
        super().__init__()
        self.width, self.height = width, height

    def box(self, c, x, y, w, h, label, fill=colors.white):
        c.setFillColor(fill)
        c.setStrokeColor(base.LINE)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        c.setFillColor(base.MUTED)
        c.setFont("Arial-Bold", 7)
        c.drawString(x + .18 * cm, y + h - .37 * cm, label)

    def draw(self):
        c = self.canv
        c.setFillColor(colors.HexColor("#F6F9F7"))
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        self.box(c, .18 * cm, 8.91 * cm, 16.64 * cm, .6 * cm,
                 "Navegacion global: Resumen | Flujos | Especializacion | Captacion | Recursos | Circularidad", base.PALE)
        self.box(c, .18 * cm, .25 * cm, 3.3 * cm, 8.42 * cm, "Filtros globales")
        c.setFont("Arial", 6.5); c.setFillColor(base.MUTED)
        for i, label in enumerate(["Periodo", "Familia AW", "Subfamilia", "Residuo", "Garbigune", "Tipo de punto"]):
            c.drawString(.42 * cm, 7.96 * cm - i * .69 * cm, label)
            c.setStrokeColor(base.LINE)
            c.roundRect(.42 * cm, 7.63 * cm - i * .69 * cm, 2.75 * cm, .35 * cm, 3, stroke=1, fill=0)
        self.box(c, 3.72 * cm, 7.1 * cm, 12.95 * cm, 1.57 * cm, "Lecturas automaticas: concentracion, singularidad y cobertura", colors.HexColor("#FFF7E8"))
        for x, label in [(3.72, "Familias"), (6.96, "Top 3"), (10.2, "Singulares"), (13.44, "Cobertura")]:
            self.box(c, x * cm, 5.67 * cm, 2.92 * cm, 1.08 * cm, label)
        self.box(c, 3.72 * cm, 2.7 * cm, 6.3 * cm, 2.62 * cm, "Matriz Garbigune x familia / subfamilia")
        self.box(c, 10.27 * cm, 2.7 * cm, 6.4 * cm, 2.62 * cm, "Perfil y concentracion de residuos")
        self.box(c, 3.72 * cm, .25 * cm, 12.95 * cm, 2.05 * cm, "Residuos singulares, dependencia y calidad de clasificacion")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(base.LINE)
    canvas.line(1.7 * cm, 1.2 * cm, 19.3 * cm, 1.2 * cm)
    canvas.setFillColor(base.MUTED)
    canvas.setFont("Arial", 7.2)
    canvas.drawString(1.7 * cm, .74 * cm, "Garbiker - Especificacion funcional | Especializacion de residuos")
    canvas.drawRightString(19.3 * cm, .74 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build():
    base.register_fonts()
    base.S = base.styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=1.7 * cm, rightMargin=1.7 * cm,
                          topMargin=1.55 * cm, bottomMargin=1.55 * cm,
                          title="Especificacion - Especializacion de residuos", author="Garbiker")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    p, t, c = base.p, base.table, base.callout
    story = [Spacer(1, 1.1 * cm), p("Especializacion de residuos", "title"),
             p("Especificacion funcional del segundo eje del visor Garbigunes", "subtitle"),
             c("Proposito", "Comprender que materiales caracterizan cada Garbigune, donde se concentran los flujos singulares y que dependencias operativas o de destino merecen seguimiento."),
             Spacer(1, .42 * cm), p("Alcance", "h2"),
             p("Pestana autonoma centrada en la <b>composicion</b> y la <b>concentracion</b> de los residuos. Responde que se recibe y desde que puntos, no cada cuanto se recoge: la frecuencia y el transporte pertenecen a Flujos y recogidas."),
             p("El eje permite analizar RCD, residuos singulares, familias y subfamilias AW, perfiles de Garbigune, concentracion de volumen y, cuando exista fuente valida, cobertura de gestor autorizado."),
             Spacer(1, .28 * cm), CompositionDiagram(), Spacer(1, .26 * cm),
             p("Principios de interpretacion", "h2"),
             base.bullet("La especializacion es un <b>perfil relativo</b>: un punto puede ser relevante en una familia sin ser el mayor volumen absoluto."),
             base.bullet("Separar volumen, participacion y variedad. Un residuo de bajo tonelaje puede ser materialmente singular o exigir un destino especializado."),
             base.bullet("No asumir dependencia de gestor hasta disponer de destino, gestor, autorizacion, vigencia y trazabilidad del flujo."),
             Spacer(1, .25 * cm), p("Fuentes disponibles y frontera de datos", "h2"),
             t(["Fuente", "Uso", "Valor para especializacion", "Limite"], [
                 ["fact_captacion_aw", "Entradas AW", "Residuo, familia, subfamilia, Garbigune, fecha, usuario y toneladas.", "Es la fuente principal de composicion; una linea no equivale a visita."],
                 ["fact_salidas_transporte", "Salidas", "Residuo transportado, Garbigune, ruta y toneladas; contrastable por equivalencias AW.", "No identifica por si sola gestor final ni autorizacion."],
                 ["config_familias_aw", "Taxonomia", "Familia, subfamilia, descripcion, ejemplos y criterio para cada residuo AW.", "Requiere mantenimiento cuando aparezcan residuos nuevos."],
                 ["config_residuos_salida_aw_equivalencias", "Homologacion", "Permite comparar familias de entrada con residuos de salida sin doble conteo.", "Las equivalencias multiples son ponderadas; no son conversiones fisicas."],
             ], [3.05 * cm, 2.45 * cm, 6.65 * cm, 4.85 * cm]), PageBreak()]

    story += [p("1. Preguntas decisionales y metricas", "h1"),
              p("La pestana debe convertir la composicion material en una priorizacion explicable. No es un catalogo de residuos ni un ranking de puntos sin contexto."),
              t(["Pregunta", "Indicadores", "Decision habilitada"], [
                  ["¿Que materiales definen cada punto?", "t, % del punto, familia, subfamilia, tendencia y variedad.", "Diferenciar perfiles y revisar adecuacion operativa del punto."],
                  ["¿Donde se concentran los RCD y residuos singulares?", "Participacion, top puntos, indice de concentracion y continuidad temporal.", "Priorizar seguimiento de fracciones que requieren circuitos especificos."],
                  ["¿Existen puntos con perfil atipico?", "Distancia composicional frente a puntos comparables; residuos exclusivos o poco frecuentes.", "Contrastar cambio de demanda, clasificacion o necesidad operativa."],
                  ["¿La salida refleja la composicion de entrada?", "Entradas y salidas por familia homologada, cobertura de equivalencias y balance estimado.", "Revisar trazabilidad, corte temporal, equivalencias o acopio."],
                  ["¿Hay riesgo de dependencia de destino?", "Numero de gestores/destinos autorizados, peso por gestor y vigencia de autorizacion.", "Diversificar o asegurar contingencia cuando exista fuente valida."],
              ], [4.25 * cm, 6.15 * cm, 6.6 * cm]), Spacer(1, .24 * cm),
              p("Metricas nucleares", "h2"),
              t(["Metrica", "Definicion", "Uso correcto"], [
                  ["Participacion", "Toneladas de familia / toneladas del punto o periodo.", "Comparar perfil de composicion, no actividad absoluta."],
                  ["Concentracion top-N", "Porcentaje del total de una familia concentrado en los N primeros puntos.", "Identificar si una fraccion depende de pocos Garbigunes."],
                  ["Indice HHI", "Suma de participaciones al cuadrado por punto; se acompana de explicacion y top-N.", "Señal de concentracion, no medida de riesgo por si sola."],
                  ["Variedad", "Numero de familias y subfamilias con volumen o actividad por encima de un umbral.", "Distinguir puntos generalistas y especializados."],
                  ["Singularidad", "Residuo/familia con baja presencia relativa en red y alta relevancia en un punto.", "Priorizar conocimiento y trazabilidad, no penalizar."],
              ], [3.15 * cm, 7.1 * cm, 6.75 * cm]), Spacer(1, .2 * cm),
              c("Regla temporal", "Las composiciones se calculan para periodos equivalentes. Un mes parcial puede usarse para señal temprana, pero no para clasificar un punto como especializado sin confirmacion historica.", colors.HexColor("#FFF7E8")), PageBreak()]

    story += [p("2. Navegacion y filtros", "h1"),
              p("La navegacion superior es comun a todos los ejes. Esta pestana conserva el periodo y las selecciones compatibles, y declara con claridad que sus analisis se basan principalmente en entradas AW."),
              p("Navegacion", "h2"),
              t(["Elemento", "Especificacion"], [
                  ["Pestana activa", "Especializacion de residuos, tercera pestana analitica. Etiqueta de dominio: <b>Composicion y concentracion</b>."],
                  ["Modo Ejecutivo", "Muestra perfil global, puntos concentradores, residuos singulares y tres conclusiones accionables."],
                  ["Modo Analista", "Muestra matriz configurable, selector familia/subfamilia/residuo, metricas de concentracion, metodologia y tabla detallada."],
                  ["Chips de contexto", "Bajo el titulo: periodo, familias, residuos, Garbigunes y tipo de punto activos. Deben reflejar filtros compartidos sin duplicar controles."],
              ], [4.45 * cm, 12.55 * cm]), p("Filtros", "h2"),
              t(["Orden", "Filtro", "Comportamiento y alcance"], [
                  ["1", "Intervalo", "Selector de mes inicial y final, con accesos a ultimo ano completo, YTD y todo el periodo. Aplica a toda la pestana."],
                  ["2", "Familia AW", "Chips con Todas/Ninguna; ordenados por toneladas activas. Es el filtro principal de lectura ejecutiva."],
                  ["3", "Subfamilia y residuo", "Disponibles en Analista. Al seleccionar una subfamilia, se filtran residuos y se muestra cobertura de clasificacion."],
                  ["4", "Garbigune", "Multiseleccion con busqueda y distincion entre fijos/moviles. Aplica a entradas y a comparativa homologada."],
                  ["5", "Tipo de usuario", "Filtro exclusivo de entradas AW; no se traslada silenciosamente a salidas."],
                  ["6", "Restablecer", "Devuelve la vista al periodo y composicion por defecto. Conserva la navegacion entre vistas internas."],
              ], [1.1 * cm, 3.55 * cm, 12.35 * cm]), Spacer(1, .18 * cm),
              c("Aplicabilidad", "Las tarjetas de salida y balance muestran la etiqueta <b>Comparativa homologada</b>. Si una familia no cuenta con equivalencia activa, se excluye del balance y se señala su cobertura."), PageBreak()]

    story += [p("3. Arrangement de la pestana", "h1"),
              p("El recorrido de lectura es: cual es la composicion global, donde se concentra, que destaca por singularidad y que requiere revisar. La matriz es una herramienta analitica, no el punto de entrada."),
              WasteWireframe(), Spacer(1, .25 * cm), p("Bloques funcionales", "h2"),
              t(["Bloque", "Contenido", "Comportamiento"], [
                  ["A. Contexto", "Titulo, periodo, chips, fuente y cobertura de taxonomia.", "Persistente y compacto; explica que se analizan entradas AW."],
                  ["B. Lecturas", "3 a 5 conclusiones sobre concentracion, especializacion, residuos singulares y calidad.", "Cada lectura enlaza a la familia, punto o matriz que la sostiene."],
                  ["C. KPI", "Familias activas, top 3 share, puntos con perfil singular, residuos sin clasificar y cobertura de equivalencias.", "Cada KPI abre un desglose; no se usan numeros sin denominador."],
                  ["D. Perfil", "Composicion global y de Garbigunes, barras 100% apiladas o small multiples.", "Familia, subfamilia y residuo son seleccionables desde la leyenda."],
                  ["E. Concentracion", "Ranking y matriz configurable Garbigune x familia/subfamilia/residuo.", "Filas y columnas se seleccionan junto a sus ejes; cero queda en gris muy suave."],
                  ["F. Excepciones", "Residuos singulares, concentracion, cobertura y posibles dependencias de gestor.", "Tabla filtrable, exportable y con estado de revision."],
              ], [3.25 * cm, 7.15 * cm, 6.6 * cm]), p("Reglas de legibilidad", "h2"),
              base.bullet("Evitar leyendas de decenas de residuos: en Ejecutivo se muestran familias; subfamilias y residuos se abren bajo demanda."),
              base.bullet("La matriz no duplica filtros voluminosos: los selectores de fila y columna se ubican junto a sus encabezados."),
              base.bullet("Celdas con 0 t se muestran vacias sobre gris muy suave; los valores faltantes usan un simbolo y nota distinta."),
              base.bullet("En movil, la matriz se mantiene horizontalmente desplazable con primera columna fija y selector de dimensiones en un cajon."), PageBreak()]

    story += [p("4. Vistas predeterminadas e insights", "h1"),
              p("Las vistas iniciales convierten una taxonomia amplia en lecturas concretas. Cada una abre con un estado comprensible y puede profundizarse sin abandonar la pestana."),
              t(["Vista", "Configuracion inicial", "Insight esperado", "Decision / siguiente paso"], [
                  ["1. Perfil material de la red", "Ultimos 12 meses completos; familias AW; barras 100% apiladas y volumen total.", "Entender cuales son las familias dominantes y que peso real tienen.", "Definir que familias merecen seguimiento operativo o de circuito."],
                  ["2. Concentracion de RCD", "Familia RCD; ranking de puntos, top-N share y matriz Garbigune x subfamilia.", "Detectar si pocas ubicaciones concentran escombros, mezcla RCD u otras fracciones.", "Revisar especializacion, comunicacion, contenedores o circuitos de destino."],
                  ["3. Puntos con perfil diferencial", "Todos los Garbigunes; score de singularidad; minimo de volumen y meses de actividad.", "Identificar centros con una mezcla distinta de pares comparables.", "Validar demanda local, clasificacion y necesidad de tratamiento especifico."],
                  ["4. Residuos singulares", "Residuos/subfamilias con baja presencia de red y volumen significativo en un punto.", "Visibilizar fracciones que no aparecen en rankings globales.", "Asegurar conocimiento de destino y reglas de aceptacion."],
                  ["5. Entrada-salida por familia", "Familias con equivalencia activa; periodo y punto seleccionables.", "Detectar diferencias persistentes de registro o acopio entre entradas y salidas.", "Contrastar mapeo, temporalidad, stock y operacion."],
              ], [3.05 * cm, 4.35 * cm, 4.85 * cm, 4.75 * cm]), Spacer(1, .25 * cm),
              p("Key takeaways automatizados", "h2"),
              base.bullet("<b>Concentracion:</b> “Los tres Garbigunes principales concentran X% de [familia]; la continuidad del servicio de esta fraccion depende especialmente de esos puntos.”"),
              base.bullet("<b>Especializacion:</b> “[Garbigune] tiene una participacion de [subfamilia] X puntos superior a la mediana de puntos comparables, durante N meses.”"),
              base.bullet("<b>Residuo singular:</b> “[Residuo] es minoritario en la red pero relevante en [Garbigune]; revisar trazabilidad y condiciones de aceptacion.”"),
              base.bullet("<b>Desajuste:</b> “La familia [familia] mantiene diferencia entre entradas y salidas homologadas; comprobar corte temporal, acopio y equivalencias.”"),
              base.bullet("<b>Calidad:</b> “X% de las toneladas AW no tiene subfamilia asignada; las conclusiones de detalle se muestran con confianza media/baja.”"),
              Spacer(1, .16 * cm), c("Regla de redaccion", "Las lecturas describen patron, periodo, denominador y nivel de confianza. Nunca confunden concentracion de volumen con una recomendacion automatica de cerrar o reducir un punto."), PageBreak()]

    story += [p("5. Visualizaciones y tablas requeridas", "h1"),
              p("El sistema grafico comun definira estilos finales. Esta especificacion asegura que cada componente responda a una pregunta, tenga unidades visibles y se comporte de forma consistente."),
              t(["Componente", "Especificacion", "Interaccion"], [
                  ["Composicion 100% apilada", "Familias por Garbigune o periodo; ordenar por participacion o volumen total visible.", "Leyenda clicable sincronizada con el filtro global; tooltip con t, %, total y muestra."],
                  ["Ranking de concentracion", "Barras horizontales por t, participacion, top-N o score de singularidad.", "Selector de metrica discreto; eje clicable para invertir; Ver mas expande todas las filas."],
                  ["Matriz configurable", "Filas/columnas: Garbigune, familia, subfamilia, residuo, ruta cuando sea compatible. Totales y porcentajes.", "Selectores integrados junto a cada eje; click en celda fija combinacion y actualiza detalle."],
                  ["Mapa de perfiles", "Opcional: simbolo por Garbigune, tamano por t y color por familia dominante o indice de especializacion.", "No sustituye a Captacion territorial; se limita a perfil material del punto."],
                  ["Entrada vs salida", "Small multiples o barras emparejadas por familia homologada; kg ponderados de salida.", "Muestra cobertura y residuos excluidos; no representa comparacion como stock exacto."],
                  ["Tabla de singularidades", "Entidad, residuo/familia, t, %, referencia red, persistencia, confianza y accion.", "Orden, filtros de columna, CSV y estado de revision."],
              ], [3.1 * cm, 8.05 * cm, 5.85 * cm]), Spacer(1, .22 * cm),
              p("Hover, seleccion y estados", "h2"),
              base.bullet("El tooltip de composicion incluye periodo, toneladas, participacion, total del punto y familia/subfamilia origen."),
              base.bullet("Seleccionar una familia resalta su huella en todas las visualizaciones compatibles y crea un chip reversible."),
              base.bullet("La leyenda deja elementos deseleccionados atenuados, nunca los elimina: conserva la explicacion de la composicion completa."),
              base.bullet("Si el detalle excede el espacio, se priorizan top familias y una etiqueta “+N familias”; nunca se reduce la tipografia hasta ser ilegible."), PageBreak()]

    story += [p("6. Outliers, concentracion y calidad", "h1"),
              p("La seccion de excepciones organiza la revision de residuos y perfiles. Todos los umbrales se versionan en configuracion y se calculan sobre grupos comparables."),
              t(["Tipo de excepcion", "Regla inicial", "Lectura", "Accion sugerida"], [
                  ["Perfil atipico", "Distancia frente a composicion mediana de puntos comparables; minimo N meses y t.", "Mezcla inusual o cambio de clasificacion/demanda.", "Verificar persistencia, municipio, normas de aceptacion y registro."],
                  ["Concentracion elevada", "Top 3 o HHI por encima del umbral de familia, con tendencia estable.", "Pocos puntos sostienen gran parte del flujo.", "Revisar contingencia de circuito, no cambiar cobertura automaticamente."],
                  ["Residuo singular", "Baja presencia de red y participacion relevante en un punto.", "Fraccion con posible necesidad de conocimiento especializado.", "Confirmar tratamiento, destino y condiciones de aceptacion."],
                  ["Cambio composicional", "Variacion robusta de participacion frente a meses equivalentes y mediana historica.", "Cambio de demanda, operacion o clasificacion.", "Contrastar con origen, calendario, campaña y calidad."],
                  ["Taxonomia incompleta", "Residuo sin familia/subfamilia o equivalencia inactiva para salida.", "Limita comparacion y detalle.", "Completar configuracion editable; no imputar automaticamente."],
              ], [3.0 * cm, 4.35 * cm, 4.75 * cm, 4.9 * cm]), Spacer(1, .25 * cm),
              p("Nivel de confianza", "h2"),
              p("Alta: periodo completo, clasificacion completa y muestra suficiente. Media: muestra limitada, subfamilia incompleta o cambio reciente. Baja: mes parcial, residuo sin clasificar, equivalencia incompleta o registro irregular. La confianza acompaña cada insight, no se deduce del color de una grafica."),
              Spacer(1, .18 * cm), c("Gestores autorizados - dependencia de fuente", "Este indicador solo se activa al disponer de una tabla validada con residuo/familia, gestor o destino, numero de autorizacion, vigencia, capacidad o condicion aplicable y trazabilidad del flujo. Hasta entonces, el visor debe mostrar “Fuente pendiente” y no estimar dependencia." , colors.HexColor("#FFF7E8")), PageBreak()]

    story += [p("7. Modelo de datos y contratos", "h1"),
              p("La taxonomia debe vivir fuera del frontend. El navegador consume agregados y explica interacciones; la clasificacion, los scores y la cobertura se calculan y auditan en la capa de datos."),
              t(["Necesidad", "Capa recomendada", "Salida contractual"], [
                  ["Composicion de entradas", "Supabase / preagregado", "Mes, site_key, familia, subfamilia, residuo, tipo_usuario, kg, lineas y cobertura de clasificacion."],
                  ["Composicion de salidas", "Supabase / preagregado", "Mes, site_key, residuo_salida, familia_AW equivalente, kg_ponderados y cobertura de equivalencia."],
                  ["Concentracion", "Python en pipeline o vista generica", "Familia, periodo, top-N share, HHI, puntos activos, volumen y confianza."],
                  ["Singularidad / outliers", "Python en pipeline", "Entidad, regla, periodo, metrica, referencia, persistencia, impacto, confianza, texto y accion."],
                  ["Gestores", "Nueva fuente validada", "Familia/residuo, gestor/destino, autorizacion, vigencia, capacidad y peso/servicios vinculados."],
              ], [4.15 * cm, 4.5 * cm, 8.35 * cm]), Spacer(1, .2 * cm),
              p("Configuracion editable", "h2"),
              base.bullet("<b>config_familias_aw</b>: residuo AW, familia, subfamilia, descripcion, ejemplos, criterio y estado activo."),
              base.bullet("<b>config_residuos_salida_aw_equivalencias</b>: residuo de salida, familia AW, peso de asignacion, rango y nota metodologica."),
              base.bullet("<b>config_quality_rules</b>: umbrales de concentracion, singularidad, muestra minima, severidad y vigencia."),
              base.bullet("Futura <b>config_gestores_residuos</b>: residuo/familia, gestor, autorizacion, vigencia, territorio, limitaciones y evidencia documental."),
              Spacer(1, .25 * cm), p("Criterios de aceptacion", "h2"),
              t(["Criterio", "Verificacion"], [
                  ["Taxonomia", "Todo residuo visible declara familia y subfamilia, o se marca como pendiente sin ocultarlo."],
                  ["No redundancia", "Las vistas de esta pestana no repiten cadencia/rutas salvo para contextualizar una comparativa homologada."],
                  ["Comparabilidad", "Participaciones y scores declaran periodo, denominador, muestra minima y confianza."],
                  ["Trazabilidad", "Cada insight enlaza a la matriz, ranking o tabla y conserva fuente, regla y version de configuracion."],
                  ["Gestores", "Ningun indicador de dependencia se activa sin fuente autorizada y vigente."],
              ], [4.0 * cm, 13.0 * cm]), PageBreak()]

    story += [p("8. Hoja de ruta de implementacion", "h1"),
              p("Se propone construir primero la lectura material y la calidad de taxonomia. La dependencia de gestores se incorpora como ampliacion informada por nueva fuente, no como supuesto."),
              t(["Fase", "Entregable", "Dependencias"], [
                  ["1. Taxonomia", "Familias/subfamilias editables, cobertura visible, filtros y etiquetas Entradas / Comparativa homologada.", "config_familias_aw y equivalencias actualizadas."],
                  ["2. Lectura ejecutiva", "Perfil de red, RCD, concentracion, residuos singulares y conclusiones automaticas.", "Agregados de entradas AW y reglas de confianza."],
                  ["3. Analisis", "Matriz configurable, perfiles diferenciales, entrada-salida por familia y tabla de excepciones.", "Scores calculados en pipeline y cobertura de equivalencias."],
                  ["4. Gestores", "Modulo de destinos autorizados, diversidad/contingencia y alertas de vigencia.", "Fuente de gestores y autorizaciones validada con Garbiker."],
              ], [2.0 * cm, 8.15 * cm, 6.85 * cm]), Spacer(1, .35 * cm),
              p("Decisiones que debe hacer mas faciles", "h2"),
              base.bullet("Que familias y residuos singulares requieren seguimiento o circuito especializado."),
              base.bullet("Que Garbigunes concentran una fraccion y, por tanto, requieren una lectura de continuidad o contingencia."),
              base.bullet("Que cambios de composicion conviene confirmar antes de ajustar la operacion o la comunicacion al usuario."),
              base.bullet("Que equivalencias y clasificaciones deben completarse para mejorar la confianza de las comparativas."),
              base.bullet("Cuando existan datos de destino, donde hay una dependencia excesiva de un gestor autorizado o una autorizacion proxima a vencer."),
              Spacer(1, .42 * cm),
              c("Cierre", "El valor de esta pestana no es etiquetar Garbigunes como buenos o malos, sino reconocer perfiles de material, concentraciones y excepciones que necesitan una decision informada."), Spacer(1, .3 * cm),
              p("Documento preparado para aplicar una futura guia global de estilos. Los comportamientos y contratos descritos aqui se implementaran con los componentes, tokens y reglas de accesibilidad de dicha guia.", "small")]
    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build()
