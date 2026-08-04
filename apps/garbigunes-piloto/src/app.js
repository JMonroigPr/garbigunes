import { getDataHealth } from "./data-client.js";

const axes = {
  flows: {
    title: "Flujos y recogidas",
    domain: "Entradas y salidas",
    description: "Demanda, salidas transportadas, cadencia y variabilidad de ruta.",
    callout: "Base preparada. El siguiente módulo conectará los agregados de entradas, salidas y balance homologado.",
  },
  specialisation: { title: "Especialización de residuos", domain: "Residuos y gestores", description: "RCD, residuos singulares, concentración y circuitos autorizados.", callout: "Eje reservado. Su contrato de producto se aplicará sobre el mismo sistema de filtros." },
  capture: { title: "Captación territorial", domain: "Entradas AW", description: "Origen, áreas de influencia y elección observada de Garbigune.", callout: "Eje reservado. Mantendrá sus filtros territoriales locales además de los filtros comunes compatibles." },
  resources: { title: "Recursos y cobertura", domain: "Recursos operativos", description: "Personal, cuadrantes, bajas, refuerzos y presión de cobertura.", callout: "Eje reservado. Los datos personales no se expondrán desde las vistas públicas." },
  circularity: { title: "Circularidad", domain: "Pendiente de datos", description: "Reutilización, segunda vida y valor ESG.", callout: "Espacio reservado para el equipo responsable de circularidad. No se mostrarán indicadores hasta disponer de fuentes validadas." },
};

const state = {
  axis: "flows",
  mode: "executive",
  period: "12m",
  wastes: new Set(["Escombros", "Maderas", "Rechazo", "Voluminosos", "Plásticos"]),
  site: "all",
  route: "all",
  vehicle: "all",
  driver: "all",
};

const wastes = ["Escombros", "Maderas", "Rechazo", "Voluminosos", "Plásticos", "Jardinería", "RAEES", "Metales"];
const $ = (selector) => document.querySelector(selector);

function renderChips() {
  const host = $("#waste-chips");
  host.replaceChildren(...wastes.map((waste) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.wastes.has(waste) ? " is-selected" : ""}`;
    button.textContent = waste;
    button.setAttribute("aria-pressed", String(state.wastes.has(waste)));
    button.addEventListener("click", () => {
      state.wastes.has(waste) ? state.wastes.delete(waste) : state.wastes.add(waste);
      render();
    });
    return button;
  }));
}

function renderAxis() {
  const axis = axes[state.axis];
  $("#axis-title").textContent = axis.title;
  $("#axis-domain").textContent = axis.domain;
  $("#axis-description").textContent = axis.description;
  $("#axis-callout").innerHTML = `<strong>Estado</strong><span>${axis.callout}</span>`;
  document.querySelectorAll(".axis-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.axis === state.axis);
  });
}

function renderActiveFilters() {
  const labels = {
    "12m": "12 meses completos",
    ytd: "Año en curso",
    "24m": "24 meses",
    all: "Todo el periodo",
  };
  const entries = [labels[state.period], `${state.wastes.size || 0} residuos`];
  if (state.site !== "all") entries.push(state.site);
  if (state.route !== "all") entries.push(state.route);
  $("#active-filters").replaceChildren(...entries.map((label) => {
    const chip = document.createElement("span");
    chip.className = "active-filter";
    chip.textContent = label;
    return chip;
  }));
}

function renderInsights() {
  const insights = state.axis === "flows"
    ? [
        "Los indicadores se activarán solo con periodos comparables y cobertura declarada.",
        "Las entradas AW y las salidas transportadas se mostrarán siempre como procesos distintos.",
        "El balance por familia será un contraste de registros, no una estimación de stock.",
      ]
    : ["Este eje conserva el contexto y filtros comunes.", "El contenido analítico se habilitará con su contrato de datos específico."];
  $("#insight-list").replaceChildren(...insights.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
}

function renderMode() {
  document.body.classList.toggle("is-analyst", state.mode === "analyst");
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
}

function render() {
  renderChips();
  renderAxis();
  renderActiveFilters();
  renderInsights();
  renderMode();
}

function resetFilters() {
  state.period = "12m";
  state.wastes = new Set(wastes);
  state.site = state.route = state.vehicle = state.driver = "all";
  document.querySelectorAll("select").forEach((select) => { select.value = "all"; });
  $("#period-preset").value = "12m";
  render();
}

function bindControls() {
  document.querySelectorAll(".axis-button").forEach((button) => button.addEventListener("click", () => { state.axis = button.dataset.axis; render(); }));
  document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => { state.mode = button.dataset.mode; render(); }));
  $("#period-preset").addEventListener("change", (event) => { state.period = event.target.value; render(); });
  $("#select-all-waste").addEventListener("click", () => { state.wastes = new Set(wastes); render(); });
  $("#clear-waste").addEventListener("click", () => { state.wastes.clear(); render(); });
  $("#reset-filters").addEventListener("click", resetFilters);
  ["site", "route", "vehicle", "driver"].forEach((name) => {
    $(`#${name}-filter`).addEventListener("change", (event) => { state[name] = event.target.value; render(); });
  });
  $("#collapse-filters").addEventListener("click", (event) => {
    const collapsed = document.body.classList.toggle("filters-collapsed");
    event.currentTarget.textContent = collapsed ? "›" : "‹";
    event.currentTarget.setAttribute("aria-label", collapsed ? "Desplegar filtros" : "Plegar filtros");
    event.currentTarget.title = collapsed ? "Desplegar filtros" : "Plegar filtros";
  });
}

async function updateHealth() {
  const status = $("#connection-status");
  try {
    const health = await getDataHealth();
    status.className = "connection-status is-ready";
    status.textContent = `${health.relation}: disponible`;
  } catch (error) {
    status.className = "connection-status is-error";
    status.textContent = "Datos pendientes de configurar";
    console.info("Supabase health check:", error.message);
  }
}

bindControls();
render();
updateHealth();
