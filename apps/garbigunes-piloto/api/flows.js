const SCHEMA = "analytics";
const PAGE_SIZE = 1000;

const normaliseMonth = (value) => /^\d{4}-\d{2}$/.test(value || "") ? value : null;
const list = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const inFilter = (values) => `in.(${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",")})`;

function filtersFrom(search) {
  return {
    start: normaliseMonth(search.get("start")),
    end: normaliseMonth(search.get("end")),
    wastes: list(search.get("wastes")),
    wastesNone: search.get("wastes_mode") === "none",
    site: search.get("site") || "all",
    route: search.get("route") || "all",
  };
}

function addCommonFilters(params, filters, { residueField, familyField, routeField = "route_name" } = {}) {
  const monthConditions = [];
  if (filters.start) monthConditions.push(`month_key.gte.${filters.start}`);
  if (filters.end) monthConditions.push(`month_key.lte.${filters.end}`);
  if (monthConditions.length) params.set("and", `(${monthConditions.join(",")})`);
  if (filters.site !== "all") params.set("site_key", `eq.${filters.site}`);
  if (filters.route !== "all" && routeField) params.set(routeField, `eq.${filters.route}`);
  if (filters.wastesNone && residueField) params.set(residueField, "eq.__NO_RESIDUE_SELECTED__");
  if (filters.wastesNone && familyField) params.set(familyField, "eq.__NO_FAMILY_SELECTED__");
  if (filters.wastes.length && residueField) params.set(residueField, inFilter(filters.wastes));
  if (filters.wastes.length && familyField) params.set(familyField, inFilter(filters.wastes));
}

async function getAll(url, key, relation, params) {
  const rows = [];
  for (let offset = 0; offset < 30000; offset += PAGE_SIZE) {
    const query = new URLSearchParams(params);
    query.set("select", "*");
    query.set("limit", String(PAGE_SIZE));
    query.set("offset", String(offset));
    const upstream = await fetch(`${url}/rest/v1/${relation}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": SCHEMA },
    });
    if (!upstream.ok) throw new Error(`${relation} respondió ${upstream.status}`);
    const page = await upstream.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error(`${relation} excedió el límite de seguridad de consulta.`);
}

const number = (value) => Number(value || 0);
const by = (items, key) => items.reduce((groups, item) => {
  const value = item[key];
  (groups[value] ||= []).push(item);
  return groups;
}, {});

function monthlySeries(outputs, balances) {
  const months = [...new Set([...outputs.map((row) => row.month_key), ...balances.map((row) => row.month_key)])].sort();
  return months.map((month) => {
    const outputRows = outputs.filter((row) => row.month_key === month);
    const balanceRows = balances.filter((row) => row.month_key === month);
    const waste = Object.entries(by(outputRows, "residuo")).map(([name, rows]) => ({
      name,
      kg: rows.reduce((sum, row) => sum + number(row.kg), 0),
    }));
    return {
      month,
      outputKg: outputRows.reduce((sum, row) => sum + number(row.kg), 0),
      services: outputRows.reduce((sum, row) => sum + number(row.services), 0),
      entryKg: balanceRows.reduce((sum, row) => sum + number(row.aw_kg), 0),
      waste,
    };
  });
}

function siteRows(outputs, cadence) {
  const cadenceBySite = by(cadence, "site_key");
  return Object.entries(by(outputs, "site_key")).map(([siteKey, rows]) => {
    const cadenceRows = cadenceBySite[siteKey] || [];
    const kg = rows.reduce((sum, row) => sum + number(row.kg), 0);
    const services = rows.reduce((sum, row) => sum + number(row.services), 0);
    return {
      siteKey,
      garbigune: rows[0]?.garbigune || siteKey,
      mobile: Boolean(rows[0]?.es_movil),
      kg,
      services,
      avgKg: services ? kg / services : 0,
      maxDays: Math.max(0, ...cadenceRows.map((row) => number(row.max_days_between_services))),
    };
  }).sort((a, b) => b.kg - a.kg);
}

function routeRows(outputs, routes) {
  if (routes.length) {
    return Object.entries(by(routes, "route_name")).map(([route, rows]) => {
      const kg = rows.reduce((sum, row) => sum + number(row.kg), 0);
      const services = rows.reduce((sum, row) => sum + number(row.services), 0);
      return { route, base: rows[0]?.base || "SIN BASE", kg, services, avgKg: services ? kg / services : 0, sites: Math.max(...rows.map((row) => number(row.sites_served))) };
    }).sort((a, b) => b.kg - a.kg);
  }
  return Object.entries(by(outputs, "route_name")).map(([route, rows]) => {
    const kg = rows.reduce((sum, row) => sum + number(row.kg), 0);
    const services = rows.reduce((sum, row) => sum + number(row.services), 0);
    return { route, base: rows[0]?.base || "SIN BASE", kg, services, avgKg: services ? kg / services : 0, sites: new Set(rows.map((row) => row.site_key)).size };
  }).sort((a, b) => b.kg - a.kg);
}

function buildInsights(sites, routes, balances, outputs) {
  const items = [];
  if (sites[0]) items.push({ level: "info", text: `${sites[0].garbigune} concentra la mayor salida del periodo (${(sites[0].kg / 1000).toFixed(1)} t).`, action: "Revisar detalle del punto" });
  if (routes[0]) items.push({ level: "info", text: `${routes[0].route} es la ruta con mayor volumen (${(routes[0].kg / 1000).toFixed(1)} t).`, action: "Comparar carga y cadencia" });
  const balance = [...balances].sort((a, b) => Math.abs(number(b.balance_kg)) - Math.abs(number(a.balance_kg)))[0];
  if (balance && number(balance.balance_kg) !== 0) items.push({ level: "attention", text: `La mayor diferencia homologada aparece en ${balance.familia_aw}: ${(number(balance.balance_kg) / 1000).toFixed(1)} t.`, action: "Contrastar registros y periodos" });
  const withoutRoute = outputs.filter((row) => row.route_name === "SIN RUTA").reduce((sum, row) => sum + number(row.kg), 0);
  const total = outputs.reduce((sum, row) => sum + number(row.kg), 0);
  if (withoutRoute && total) items.push({ level: "warning", text: `${((withoutRoute / total) * 100).toFixed(1)}% de las salidas no tiene ruta normalizada.`, action: "Revisar calidad de rutas" });
  return items.slice(0, 4);
}

export default async function handler(request, response) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response.status(503).json({ message: "Supabase no está configurado en este entorno." });

  try {
    const filters = filtersFrom(new URL(request.url, "http://localhost").searchParams);
    const outputParams = new URLSearchParams();
    addCommonFilters(outputParams, filters, { residueField: "residuo" });

    const routeParams = new URLSearchParams();
    addCommonFilters(routeParams, { ...filters, route: "all", wastes: [] });

    const cadenceParams = new URLSearchParams();
    addCommonFilters(cadenceParams, filters, { residueField: "residuo", routeField: null });

    const [outputs, cadence, configuredRoutes, equivalences] = await Promise.all([
      getAll(url, key, "v_public_flujos_salidas_mensual", outputParams),
      getAll(url, key, "v_public_flujos_cadencia_mensual", cadenceParams),
      filters.wastes.length ? Promise.resolve([]) : getAll(url, key, "v_public_flujos_rutas_mensual", routeParams),
      filters.wastes.length ? getAll(url, key, "config_residuos_salida_aw_equivalencias", new URLSearchParams([["active", "eq.true"]])) : Promise.resolve([]),
    ]);

    const families = filters.wastes.length
      ? [...new Set(equivalences.filter((row) => filters.wastes.includes(row.residuo_salida)).map((row) => row.familia_aw))]
      : [];
    const balanceParams = new URLSearchParams();
    addCommonFilters(balanceParams, { ...filters, wastes: families, wastesNone: filters.wastesNone || !families.length && filters.wastes.length > 0 }, { familyField: "familia_aw", routeField: null });
    const balances = await getAll(url, key, "v_public_flujos_balance_mensual", balanceParams);

    const series = monthlySeries(outputs, balances);
    const sites = siteRows(outputs, cadence);
    const routes = routeRows(outputs, configuredRoutes);
    const outputKg = outputs.reduce((sum, row) => sum + number(row.kg), 0);
    const services = outputs.reduce((sum, row) => sum + number(row.services), 0);
    const entryKg = balances.reduce((sum, row) => sum + number(row.aw_kg), 0);
    const wastes = Object.entries(by(outputs, "residuo")).map(([name, rows]) => ({ name, kg: rows.reduce((sum, row) => sum + number(row.kg), 0) })).sort((a, b) => b.kg - a.kg);

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return response.status(200).json({
      status: "ready",
      filters: {
        wastes,
        sites: sites.map(({ siteKey, garbigune, mobile }) => ({ siteKey, garbigune, mobile })),
        routes: routes.map(({ route }) => route),
      },
      kpis: { entryKg, outputKg, services, avgKg: services ? outputKg / services : 0 },
      series,
      sites: sites.slice(0, 50),
      routes: routes.slice(0, 50),
      balances: balances.sort((a, b) => Math.abs(number(b.balance_kg)) - Math.abs(number(a.balance_kg))).slice(0, 12),
      insights: buildInsights(sites, routes, balances, outputs),
    });
  } catch (error) {
    return response.status(502).json({ message: error.message || "No se pudo cargar Flujos y recogidas." });
  }
}
