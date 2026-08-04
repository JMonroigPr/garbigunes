import { getDataHealth, getFlows } from "./data-client.js";
import { DEMO_FLOWS } from "./demo-data.js";

const palette = ["#4E8B7A", "#8A6D3B", "#6F6F73", "#6B5B95", "#0878CB", "#5E8F3E", "#197D87", "#546E7A", "#3977B8", "#9AA3A7"];
const $ = (selector) => document.querySelector(selector);
const format = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const monthFormat = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" });
const currentMonth = new Date().toISOString().slice(0, 7);

const axes = {
  flows: { title: "Flujos y recogidas", domain: "Entradas y salidas", description: "Demanda, salidas transportadas, cadencia y variabilidad de ruta.", callout: "Lectura basada en entradas AW, salidas transportadas y comparativas homologadas. El balance no representa stock." },
  specialisation: { title: "Especialización de residuos", domain: "Residuos y gestores", description: "RCD, residuos singulares, concentración y circuitos autorizados.", callout: "Eje reservado. Mantiene los filtros comunes y se activará con su contrato de datos." },
  capture: { title: "Captación territorial", domain: "Entradas AW", description: "Origen, áreas de influencia y elección observada de Garbigune.", callout: "Eje reservado. Añadirá filtros territoriales locales compatibles con el panel común." },
  resources: { title: "Recursos y cobertura", domain: "Recursos operativos", description: "Personal, cuadrantes, bajas, refuerzos y presión de cobertura.", callout: "Eje reservado. Los datos personales se mantendrán fuera de las vistas públicas." },
  circularity: { title: "Circularidad", domain: "Pendiente de datos", description: "Reutilización, segunda vida y valor ESG.", callout: "Espacio reservado para el equipo responsable de circularidad." },
};

const state = { axis: "flows", mode: "executive", preset: "12m", start: "", end: "", wastes: new Set(), wastesInitialized: false, site: "all", route: "all", data: null, catalog: null, isDemo: false };

function monthOffset(months) {
  const date = new Date(`${currentMonth}-01T00:00:00`);
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 7);
}

function setPreset(preset) {
  state.preset = preset;
  if (preset === "12m") { state.start = monthOffset(12); state.end = monthOffset(1); }
  if (preset === "24m") { state.start = monthOffset(24); state.end = monthOffset(1); }
  if (preset === "ytd") { state.start = `${currentMonth.slice(0, 4)}-01`; state.end = currentMonth; }
  if (preset === "all") { state.start = ""; state.end = ""; }
  $("#period-preset").value = preset;
  $("#start-month").value = state.start;
  $("#end-month").value = state.end;
}

function tons(value) { return `${format.format(Number(value || 0) / 1000)} t`; }
function kilos(value) { return `${format.format(Number(value || 0))} kg/serv.`; }
function displayMonth(value) { return monthFormat.format(new Date(`${value}-01T00:00:00`)).replace(".", ""); }

function sourceClass(level) { return level === "warning" || level === "attention" ? "is-attention" : ""; }

function renderContext() {
  const axis = axes[state.axis];
  $("#axis-title").textContent = axis.title;
  $("#axis-domain").textContent = axis.domain;
  $("#axis-description").textContent = axis.description;
  $("#axis-callout").innerHTML = `<strong>${state.isDemo ? "Demostración local" : "Cobertura"}</strong><span>${state.isDemo ? "Vista de demostración: configure Vercel para consultar Supabase." : axis.callout}</span>`;
  document.body.classList.toggle("is-placeholder-axis", state.axis !== "flows");
  document.querySelectorAll(".axis-button").forEach((button) => button.classList.toggle("is-active", button.dataset.axis === state.axis));
  const wasteLabel = state.wastes.size ? `${state.wastes.size} residuos` : state.wastesInitialized ? "Sin residuos" : "Todos los residuos";
  const chips = [state.start && state.end ? `${state.start} a ${state.end}` : "Todo el periodo", wasteLabel];
  if (state.site !== "all") chips.push(state.site);
  if (state.route !== "all") chips.push(state.route);
  $("#active-filters").replaceChildren(...chips.filter(Boolean).map((label) => { const chip = document.createElement("span"); chip.className = "active-filter"; chip.textContent = label; return chip; }));
}

function renderFilters(data) {
  if (data.filters?.wastes?.length) state.catalog = data.filters;
  const catalog = state.catalog || data.filters || {};
  const wasteList = catalog.wastes || [];
  if (!state.wastesInitialized && wasteList.length) { state.wastes = new Set(wasteList.map((item) => item.name)); state.wastesInitialized = true; }
  const chips = wasteList.map((waste, index) => {
    const button = document.createElement("button");
    const selected = state.wastes.has(waste.name);
    button.type = "button"; button.className = `filter-chip${selected ? " is-selected" : ""}`; button.textContent = waste.name;
    button.style.setProperty("--chip-color", palette[index % palette.length]); button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => { selected ? state.wastes.delete(waste.name) : state.wastes.add(waste.name); loadFlows(); });
    return button;
  });
  $("#waste-chips").replaceChildren(...chips);
  setSelectOptions("#site-filter", catalog.sites || [], "siteKey", "garbigune", "Todos los puntos", state.site, (value) => { state.site = value; loadFlows(); });
  setSelectOptions("#route-filter", (catalog.routes || []).map((route) => ({ route })), "route", "route", "Todas las rutas", state.route, (value) => { state.route = value; loadFlows(); });
}

function setSelectOptions(selector, options, valueKey, labelKey, allLabel, selected, onChange) {
  const select = $(selector);
  select.replaceChildren(new Option(allLabel, "all"), ...options.map((option) => new Option(option[labelKey], option[valueKey])));
  select.value = options.some((option) => option[valueKey] === selected) ? selected : "all";
  select.onchange = (event) => onChange(event.target.value);
  if (selected !== "all" && select.value === "all") onChange("all");
}

function renderKpis(kpis) {
  $("#metric-entries").textContent = tons(kpis.entryKg);
  $("#metric-outputs").textContent = tons(kpis.outputKg);
  $("#metric-services").textContent = format.format(kpis.services);
  $("#metric-load").textContent = kpis.services >= 10 ? kilos(kpis.avgKg) : "--";
}

function renderInsights(insights) {
  $("#insight-list").replaceChildren(...(insights.length ? insights : [{ text: "No hay suficientes datos para generar lecturas automáticas.", action: "Ampliar periodo" }]).map((item) => {
    const element = document.createElement("li"); element.className = sourceClass(item.level); element.innerHTML = `<span>${item.text}</span><small>${item.action || ""}</small>`; return element;
  }));
}

function renderChart(series) {
  const host = $("#monthly-chart"); const legend = $("#chart-legend");
  if (!series.length) { host.innerHTML = `<div class="empty-state">No hay salidas para esta selección.</div>`; legend.replaceChildren(); return; }
  const residues = [...new Set(series.flatMap((row) => row.waste.map((item) => item.name)))].sort((a, b) => {
    const total = (name) => series.reduce((sum, row) => sum + (row.waste.find((item) => item.name === name)?.kg || 0), 0);
    return total(b) - total(a);
  });
  const width = 860; const height = 300; const pad = { top: 20, right: 56, bottom: 42, left: 52 }; const chartW = width - pad.left - pad.right; const chartH = height - pad.top - pad.bottom;
  const maxKg = Math.max(...series.map((row) => row.outputKg), 1); const maxServices = Math.max(...series.map((row) => row.services), 1); const barWidth = Math.max(10, chartW / series.length - 7);
  const colorFor = (name) => palette[residues.indexOf(name) % palette.length];
  const grid = [0, .25, .5, .75, 1].map((step) => { const y = pad.top + chartH - chartH * step; return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="chart-grid"/><text x="${pad.left - 8}" y="${y + 4}" class="chart-tick" text-anchor="end">${format.format((maxKg * step) / 1000)}</text>`; }).join("");
  const bars = series.map((row, index) => {
    const x = pad.left + index * (chartW / series.length) + 4; let running = 0;
    const segments = residues.map((name) => { const kg = row.waste.find((item) => item.name === name)?.kg || 0; const h = (kg / maxKg) * chartH; const y = pad.top + chartH - running - h; running += h; return kg ? `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="2" fill="${colorFor(name)}" data-month="${row.month}" data-residue="${name}" data-kg="${kg}"/>` : ""; }).join("");
    const label = index % Math.ceil(series.length / 6) === 0 ? `<text x="${x + barWidth / 2}" y="${height - 13}" class="chart-tick" text-anchor="middle">${displayMonth(row.month)}</text>` : "";
    return `${segments}${label}`;
  }).join("");
  const line = series.map((row, index) => `${pad.left + index * (chartW / series.length) + barWidth / 2},${pad.top + chartH - (row.services / maxServices) * chartH}`).join(" ");
  const rightTicks = [0, .5, 1].map((step) => `<text x="${width - pad.right + 8}" y="${pad.top + chartH - chartH * step + 4}" class="chart-tick">${format.format(maxServices * step)}</text>`).join("");
  host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Barras apiladas de toneladas de salida por residuo y línea de servicios"><text x="${pad.left}" y="12" class="chart-axis-title">t</text><text x="${width - pad.right}" y="12" class="chart-axis-title" text-anchor="end">servicios</text>${grid}${bars}<polyline points="${line}" fill="none" stroke="#B42318" stroke-width="2.4" stroke-linejoin="round"/>${rightTicks}</svg><div class="chart-tooltip" id="chart-tooltip" hidden></div>`;
  legend.replaceChildren(...residues.map((name) => { const button = document.createElement("button"); button.type = "button"; button.className = `legend-item${state.wastes.has(name) ? "" : " is-muted"}`; button.innerHTML = `<i style="background:${colorFor(name)}"></i>${name}`; button.addEventListener("click", () => { state.wastes.has(name) ? state.wastes.delete(name) : state.wastes.add(name); loadFlows(); }); return button; }));
  const tooltip = $("#chart-tooltip");
  host.querySelectorAll("rect[data-month]").forEach((rect) => rect.addEventListener("pointerenter", () => { tooltip.hidden = false; tooltip.textContent = `${displayMonth(rect.dataset.month)} · ${rect.dataset.residue} · ${tons(rect.dataset.kg)}`; }));
  host.addEventListener("pointerleave", () => { tooltip.hidden = true; });
}

function renderRanking(selector, rows, type) {
  const host = $(selector); const max = Math.max(...rows.map((row) => row.kg), 1);
  host.replaceChildren(...rows.slice(0, 8).map((row) => {
    const label = type === "site" ? row.garbigune : row.route; const meta = type === "site" ? `${format.format(row.services)} servicios · ${kilos(row.avgKg)}` : `${format.format(row.services)} servicios · ${format.format(row.sites)} puntos`;
    const item = document.createElement("button"); item.type = "button"; item.className = "ranking-row"; item.innerHTML = `<span class="ranking-name">${label}</span><strong>${tons(row.kg)}</strong><span class="ranking-bar"><i style="width:${(row.kg / max) * 100}%"></i></span><small>${meta}</small>`;
    item.addEventListener("click", () => { if (type === "site") state.site = row.siteKey; else state.route = row.route; loadFlows(); }); return item;
  }));
}

function renderBalance(rows) {
  $("#balance-table").replaceChildren(...rows.map((row) => { const tr = document.createElement("tr"); const stateLabel = row.coverage_status === "comparable" ? "Comparable" : "Cobertura parcial"; tr.innerHTML = `<td>${row.garbigune || row.site_key || "Sin punto"}</td><td>${row.familia_aw}</td><td class="number ${Number(row.balance_kg) < 0 ? "is-negative" : ""}">${tons(row.balance_kg)}</td><td><span class="table-status">${stateLabel}</span></td>`; return tr; }));
}

function exportBalance() {
  const rows = state.data?.balances || []; const contents = ["garbigune,familia_aw,balance_t,coverage_status", ...rows.map((row) => [row.garbigune || row.site_key, row.familia_aw, (Number(row.balance_kg) / 1000).toFixed(3), row.coverage_status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" })); link.download = "flujos-balance.csv"; link.click(); URL.revokeObjectURL(link.href);
}

function render() {
  renderContext();
  const data = state.data;
  if (!data || state.axis !== "flows") return;
  renderFilters(data); renderKpis(data.kpis); renderChart(data.series); renderInsights(data.insights); renderRanking("#site-ranking", data.sites, "site"); renderRanking("#route-ranking", data.routes, "route"); renderBalance(data.balances);
}

async function loadFlows() {
  if (state.axis !== "flows") { render(); return; }
  $("#axis-callout").innerHTML = "<strong>Cargando</strong><span>Actualizando indicadores y vistas compatibles.</span>";
  try {
    state.data = await getFlows({ start: state.start, end: state.end, wastes: [...state.wastes], site: state.site, route: state.route }); state.isDemo = false;
  } catch (error) {
    state.data = DEMO_FLOWS; state.isDemo = true; console.info("Flows fallback:", error.message);
  }
  render();
}

function bindControls() {
  document.querySelectorAll(".axis-button").forEach((button) => button.addEventListener("click", () => { state.axis = button.dataset.axis; render(); if (state.axis === "flows") loadFlows(); }));
  document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => { state.mode = button.dataset.mode; document.body.classList.toggle("is-analyst", state.mode === "analyst"); document.querySelectorAll(".mode-button").forEach((item) => item.classList.toggle("is-active", item === button)); }));
  $("#period-preset").addEventListener("change", (event) => { setPreset(event.target.value); loadFlows(); });
  ["#start-month", "#end-month"].forEach((selector) => $(selector).addEventListener("change", () => { state.start = $("#start-month").value; state.end = $("#end-month").value; state.preset = "custom"; loadFlows(); }));
  $("#select-all-waste").addEventListener("click", () => { state.wastes = new Set((state.catalog?.wastes || state.data?.filters?.wastes || []).map((item) => item.name)); state.wastesInitialized = true; loadFlows(); });
  $("#clear-waste").addEventListener("click", () => { state.wastes.clear(); state.wastesInitialized = true; loadFlows(); });
  $("#reset-filters").addEventListener("click", () => { state.site = state.route = "all"; state.wastes.clear(); state.wastesInitialized = false; setPreset("12m"); loadFlows(); });
  $("#collapse-filters").addEventListener("click", (event) => { const collapsed = document.body.classList.toggle("filters-collapsed"); event.currentTarget.textContent = collapsed ? "›" : "‹"; event.currentTarget.setAttribute("aria-label", collapsed ? "Desplegar filtros" : "Plegar filtros"); });
  $("#export-csv").addEventListener("click", exportBalance);
}

async function updateHealth() {
  const status = $("#connection-status");
  try { const health = await getDataHealth(); status.className = "connection-status is-ready"; status.textContent = `${health.relation}: disponible`; }
  catch { status.className = "connection-status is-error"; status.textContent = "Datos pendientes de configurar"; }
}

setPreset("12m"); bindControls(); render(); updateHealth(); loadFlows();
