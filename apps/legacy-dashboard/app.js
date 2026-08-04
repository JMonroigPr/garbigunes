const data = window.DASHBOARD_DATA;

const fmt = new Intl.NumberFormat("es-ES");
const fmt1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

const COLORS = ["#147d64", "#246fb2", "#c67b24", "#7a5aa6", "#b8463f", "#608b3e", "#5b7480", "#c05285"];
const CHART_THEME = {
  ticks: [0, 0.25, 0.5, 0.75, 1],
  grid: "#dce4df",
  gridSoft: "#edf2ef",
  axis: "#b9c7c1",
  mapWidth: 980,
  mapHeight: 610,
  bar: { width: 720, rowHeight: 42, barHeight: 22, top: 12, right: 128, bottom: 16, left: 172 },
  timeline: { width: 900, height: 320, margin: { top: 28, right: 44, bottom: 58, left: 58 } },
  monthly: { width: 900, top: 34, right: 82, bottom: 128, left: 62 },
  scatter: { width: 980, height: 520, margin: { top: 82, right: 36, bottom: 86, left: 86 } },
  stackedCompact: { width: 900, height: 330, margin: { top: 78, right: 22, bottom: 48, left: 58 } },
};
const tableStates = {};
const chartStates = {};
const chartConfigs = {};
const matrixStates = {};
let rawPesadas = data.records?.pesadas || [];
let rawIncidencias = data.records?.incidencias || [];
let rawAw = (data.records?.aw || []).map((row) => ({ ...row, waste_family: row.waste_family || "SIN FAMILIA", waste_subfamily: row.waste_subfamily || "SIN SUBFAMILIA" }));
let coreRecordsLoading = false;
let coreRecordsError = "";
let captureAggregatesLoading = false;
let captureAggregatesError = "";
let captureGeojson = null;
let captureGeojsonLoading = false;
let captureGeojsonError = "";
const matrixDimensions = {
  site: "Garbigune",
  waste: "Residuo",
  route: "Ruta",
  base: "Base",
  vehicle: "Vehículo",
  driver: "Conductor",
};
let configurableMatrix = { row: "site", col: "waste" };
let globalFilters = {};
let view = data;
let calendarMonth = "";
let monthPickerYear = "";
let selectingRangeStart = true;
let selectingMonthStart = true;
let compareMode = "previous";
let driverMinDays = 10;
let incidentBreakdown = "subgroup";
let viewMode = safeStorageGet("garbikerViewMode") || "executive";
let captureFilters = { site: "", wasteFamily: "", wasteSubfamily: "", waste: "", userType: "", cp: "", metric: "kg", compositionLevel: "family", flowReview: "all" };

const AW_FAMILIES_BY_GLOBAL_WASTE = data.analyticsConfig?.awWasteFamilyBridge || {};
const DRIVER_CLUSTER_DEFS = data.analyticsConfig?.driverClusters || {};
const READING_KIND_LABELS = data.analyticsConfig?.readings?.kindLabels || {
  opportunity: "Oportunidad",
  attention: "Atención",
  context: "Contexto",
  quality: "Calidad",
  stable: "Estable",
};

function safeStorageGet(key) {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in restricted browser contexts; the in-memory mode still works.
  }
}

function number(value, decimals = 0) {
  return decimals ? fmt1.format(value) : fmt.format(Math.round(value));
}

function shortLabel(value, max = 24) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es"));
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function topLabel(rows, key) {
  return countRecords(rows, key, "label", "count", 1)[0]?.label || "-";
}

function topLabelBySum(rows, key, weightKey = "kg") {
  const totals = new Map();
  rows.forEach((row) => {
    const label = row[key] || "SIN DATO";
    totals.set(label, (totals.get(label) || 0) + (Number(row[weightKey]) || 0));
  });
  return [...totals].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function selectedGlobalAwFamilies() {
  if (!globalFilters.wastes || !globalFilters.allWastes || globalFilters.wastes.size === globalFilters.allWastes.length) {
    return { active: false, families: new Set(), mappedWastes: [], unmappedWastes: [] };
  }
  const families = new Set();
  const mappedWastes = [];
  const unmappedWastes = [];
  [...globalFilters.wastes].forEach((waste) => {
    const mapped = AW_FAMILIES_BY_GLOBAL_WASTE[waste] || [];
    if (mapped.length) {
      mappedWastes.push(waste);
      mapped.forEach((family) => families.add(family));
    } else {
      unmappedWastes.push(waste);
    }
  });
  return { active: true, families, mappedWastes, unmappedWastes };
}

function awFamilyBridgeLabel(limit = 4) {
  const bridge = selectedGlobalAwFamilies();
  if (!bridge.active) return "Residuos globales: todos; AW sin restricción de familia";
  const families = [...bridge.families].sort((a, b) => a.localeCompare(b, "es"));
  if (!families.length) return "Residuos globales: sin equivalencia AW; no se restringen familias";
  const suffix = families.length > limit ? ` +${families.length - limit}` : "";
  return `Residuos globales → AW: ${families.slice(0, limit).join(", ")}${suffix}`;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/Ñ/g, "N")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function siteMunicipality(site) {
  const text = String(site || "");
  if (!text) return "";
  if (text === "AMOREBIETA-ETXANO") return "AMOREBIETA ETXANO";
  if (text === "GAUTEGIZ ARTEAGA") return "GAUTEGIZ ARTEAGA";
  return normalizedText(text.split("-")[0]);
}

function hasConvenio(municipality) {
  const normalized = normalizedText(municipality);
  return (data.resources?.convenios?.rows || []).some((row) => normalizedText(row.municipality) === normalized && String(row.status || "").toLowerCase().includes("firmado"));
}

function probableFlowReason({ isNearest, extraKm, extraTonKm, originMunicipality, accountMunicipality, site, family, subfamily }) {
  if (isNearest) return { reason: "Garbigune más cercano", reasonType: "nearest", needsReview: false };
  const origin = originMunicipality || accountMunicipality || "";
  const originNorm = normalizedText(origin);
  const siteNorm = siteMunicipality(site);
  if (originNorm && siteNorm && (originNorm === siteNorm || siteNorm.includes(originNorm) || originNorm.includes(siteNorm))) {
    return { reason: "Mismo municipio", reasonType: "same_municipality", needsReview: false };
  }
  if (hasConvenio(origin)) {
    return { reason: "Convenio municipal", reasonType: "convenio", needsReview: false };
  }
  if (["RAEE", "Peligrosos y aceites"].includes(family) || String(subfamily || "").includes("RCD")) {
    return { reason: "Residuo especializado", reasonType: "special_waste", needsReview: extraTonKm >= 10 };
  }
  if (extraKm > 0 && extraKm <= 3 && extraTonKm < 2) {
    return { reason: "Desvío bajo", reasonType: "low_deviation", needsReview: false };
  }
  return { reason: "Revisar", reasonType: "review", needsReview: true };
}

function standardDeviation(values) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (nums.length < 2) return 0;
  const avg = nums.reduce((total, value) => total + value, 0) / nums.length;
  const variance = nums.reduce((total, value) => total + (value - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function groupRows(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const label = row[key] || "SIN DATO";
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(row);
  });
  return map;
}

function topShareLabel(rows, key) {
  const total = rows.length;
  const top = countRecords(rows, key, "label", "count", 1)[0];
  if (!top || !total) return "";
  return `${top.label} (${number((top.count / total) * 100, 1)}%)`;
}

function countRecords(rows, labelKey, labelName = labelKey, valueName = "count", limit = null) {
  const counted = [...groupRows(rows, labelKey)]
    .map(([label, group]) => ({ [labelName]: label, [valueName]: group.length }))
    .sort((a, b) => b[valueName] - a[valueName]);
  return limit ? counted.slice(0, limit) : counted;
}

function pctChange(current, previous) {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function distanceKm(fromCoord, toCoord) {
  if (!fromCoord || !toCoord) return 0;
  const [fromLon, fromLat] = fromCoord.map(Number);
  const [toLon, toLat] = toCoord.map(Number);
  if (![fromLon, fromLat, toLon, toLat].every(Number.isFinite)) return 0;
  const radius = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dateParts(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return { year, month, day };
}

function daysInYearMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dateFromParts(year, month, day) {
  const safeDay = Math.min(day, daysInYearMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function shiftMonthDate(date, months) {
  const { year, month, day } = dateParts(date);
  const target = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(target / 12);
  const targetMonth = (target % 12) + 1;
  return dateFromParts(targetYear, targetMonth, day);
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function percentileRank(values, value) {
  if (!values.length) return 0;
  const belowOrEqual = values.filter((item) => item <= value).length;
  return Number(((belowOrEqual / values.length) * 100).toFixed(0));
}

function addPercentiles(rows, metric, outputKey) {
  const values = rows.map((row) => Number(row[metric]) || 0).sort((a, b) => a - b);
  return rows.map((row) => ({ ...row, [outputKey]: percentileRank(values, Number(row[metric]) || 0) }));
}

function confidenceLabel(score) {
  if (score >= 75) return "Alta";
  if (score >= 45) return "Media";
  return "Baja";
}

function confidenceScore(parts) {
  const weighted = parts.reduce((total, part) => total + Math.min(part.value / part.target, 1) * part.weight, 0);
  const score = Math.round(weighted * 100);
  return { confidence_score: score, confidence: confidenceLabel(score) };
}

function driverClusterFor(row) {
  if (!row || row.work_days < driverMinDays || row.confidence_score < 45) return "low_sample";
  if (row.normalized_score < 85 || row.adjusted_load_index < 80) return "review";
  if (row.normalized_score >= 115 && row.services_day_percentile >= 65) return "high_productivity";
  if (row.kg_per_service >= row.expected_kg_per_service * 1.18 && row.adjusted_load_index >= 112) return "high_load";
  if (row.total_services >= 250 && row.work_days >= 60) return "intensive";
  if (row.services_day_cv <= 30 && row.confidence_score >= 75) return "stable_regular";
  if (row.services_day_cv >= 65) return "variable";
  return "stable_regular";
}

function applyDriverClusters(rows) {
  return rows.map((row) => {
    const clusterKey = driverClusterFor(row);
    const cluster = DRIVER_CLUSTER_DEFS[clusterKey] || DRIVER_CLUSTER_DEFS.variable || { label: "Perfil operativo", color: "#5b7480", description: "", action: "" };
    return {
      ...row,
      cluster_key: clusterKey,
      cluster_label: cluster.label,
      cluster_color: cluster.color,
      cluster_description: cluster.description,
      cluster_action: cluster.action,
    };
  });
}

function outliers(rows, metric, labelKey, kind, limit = 8) {
  const values = rows.map((row) => Number(row[metric]) || 0).sort((a, b) => a - b);
  if (values.length < 4) return [];
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  const iqr = q3 - q1;
  const high = q3 + iqr * 1.5;
  const low = q1 - iqr * 1.5;
  return rows
    .filter((row) => (Number(row[metric]) || 0) > high || (Number(row[metric]) || 0) < low)
    .map((row) => ({
      label: row[labelKey],
      metric,
      kind,
      value: Number(row[metric]) || 0,
      direction: (Number(row[metric]) || 0) > high ? "alto" : "bajo",
      threshold: (Number(row[metric]) || 0) > high ? high : low,
    }))
    .sort((a, b) => Math.abs(b.value - b.threshold) - Math.abs(a.value - a.threshold))
    .slice(0, limit);
}

function monthlyComparatives(records, byMonth) {
  const last = byMonth[byMonth.length - 1];
  if (!last) return { lastMonth: "-", momTons: null, yoyTons: null, momTrips: null, yoyTrips: null, isPartialMonth: false };
  const currentRows = records.filter((row) => row.month === last.month);
  const dates = uniqueValues(currentRows, "date");
  const currentFrom = dates[0];
  const currentTo = dates[dates.length - 1];
  const { year, month, day: startDay } = dateParts(currentFrom);
  const endDay = dateParts(currentTo).day;
  const monthDays = daysInYearMonth(year, month);
  const isPartialMonth = startDay > 1 || endDay < monthDays;
  const currentKg = sum(currentRows, "kg");
  const currentTrips = currentRows.length;
  const previousMonthBounds = monthBounds(addMonths(last.month, -1));
  const previousYearBounds = monthBounds(addMonths(last.month, -12));
  const momWindow = isPartialMonth
    ? { from: shiftMonthDate(currentFrom, -1), to: shiftMonthDate(currentTo, -1) }
    : { from: previousMonthBounds.first, to: previousMonthBounds.last };
  const yoyWindow = isPartialMonth
    ? { from: shiftMonthDate(currentFrom, -12), to: shiftMonthDate(currentTo, -12) }
    : { from: previousYearBounds.first, to: previousYearBounds.last };
  const momRows = filteredPesadas(momWindow);
  const yoyRows = filteredPesadas(yoyWindow);
  const momKg = sum(momRows, "kg");
  const yoyKg = sum(yoyRows, "kg");
  return {
    lastMonth: last.month,
    currentFrom,
    currentTo,
    isPartialMonth,
    comparisonBasis: isPartialMonth ? "Días equivalentes" : "Mes completo",
    momWindow,
    yoyWindow,
    momTons: momRows.length ? pctChange(currentKg, momKg) : null,
    yoyTons: yoyRows.length ? pctChange(currentKg, yoyKg) : null,
    momTrips: momRows.length ? pctChange(currentTrips, momRows.length) : null,
    yoyTrips: yoyRows.length ? pctChange(currentTrips, yoyRows.length) : null,
  };
}

function buildMatrix(rows, rowKey, colKey, rowSource, colSource, rowLimit = 10, colLimit = 8) {
  const rowLabels = rowSource.slice(0, rowLimit).map((row) => row[rowKey]);
  const colLabels = colSource.slice(0, colLimit).map((row) => row[colKey]);
  return rowLabels.map((label) => {
    const item = { [rowKey]: label };
    colLabels.forEach((column) => {
      item[column] = Number((sum(rows.filter((row) => row[rowKey] === label && row[colKey] === column), "kg") / 1000).toFixed(1));
    });
    return item;
  });
}

function aggregatePesadas(records, benchmarkRecords = records) {
  const totalKg = sum(records, "kg");
  const totalTrips = records.length;
  let siteRows = [...groupRows(records, "site")].map(([site, rows]) => {
    const kg = sum(rows, "kg");
    return {
      site,
      base: uniqueValues(rows, "base").join(" · "),
      route: uniqueValues(rows, "route").join(" · "),
      tons: Number((kg / 1000).toFixed(1)),
      trips: rows.length,
      kg_per_trip: Math.round(kg / rows.length),
    };
  }).sort((a, b) => b.tons - a.tons);
  siteRows = addPercentiles(siteRows, "kg_per_trip", "kg_trip_percentile");
  const wasteRows = [...groupRows(records, "waste")].map(([waste, rows]) => {
    const kg = sum(rows, "kg");
    return { waste, tons: Number((kg / 1000).toFixed(1)), trips: rows.length, share: totalKg ? Number(((kg / totalKg) * 100).toFixed(1)) : 0 };
  }).sort((a, b) => b.tons - a.tons);
  const byMonth = [...groupRows(records, "month")].map(([month, rows]) => {
    const kg = sum(rows, "kg");
    return { month, tons: Number((kg / 1000).toFixed(1)), trips: rows.length, kg_per_trip: Math.round(kg / rows.length) };
  }).sort((a, b) => a.month.localeCompare(b.month));
  const byMonthWaste = [...groupRows(records, "month")].map(([month, rows]) => {
    const item = { month };
    [...groupRows(rows, "waste")].forEach(([waste, wasteGroup]) => {
      item[waste] = Number((sum(wasteGroup, "kg") / 1000).toFixed(1));
    });
    return item;
  }).sort((a, b) => a.month.localeCompare(b.month));
  const routeRows = [...groupRows(records, "route")].map(([route, rows]) => {
    const kg = sum(rows, "kg");
    const sites = uniqueValues(rows, "site").length;
    return {
      route,
      base: uniqueValues(rows, "base").join(" · "),
      tons: Number((kg / 1000).toFixed(1)),
      trips: rows.length,
      kg_per_trip: Math.round(kg / rows.length),
      sites,
      ...confidenceScore([
        { value: rows.length, target: 120, weight: 0.7 },
        { value: sites, target: 4, weight: 0.3 },
      ]),
    };
  }).sort((a, b) => b.tons - a.tons);
  const baseRows = [...groupRows(records, "base")].map(([base, rows]) => {
    const kg = sum(rows, "kg");
    return {
      base,
      tons: Number((kg / 1000).toFixed(1)),
      trips: rows.length,
      kg_per_trip: Math.round(kg / rows.length),
      sites: uniqueValues(rows, "site").length,
      routes: uniqueValues(rows, "route").length,
    };
  }).sort((a, b) => b.tons - a.tons);

  const vehicleMeta = new Map(data.fleet.vehicles.map((row) => [row.vehicle, row]));
  let vehicleRows = [...groupRows(records, "vehicle")].map(([vehicle, rows]) => {
    const kg = sum(rows, "kg");
    const meta = vehicleMeta.get(vehicle) || {};
    return {
      vehicle,
      fuel: meta.fuel,
      tons: Number((kg / 1000).toFixed(1)),
      trips: rows.length,
      kg_per_trip: Math.round(kg / rows.length),
      ...confidenceScore([
        { value: rows.length, target: 180, weight: 0.75 },
        { value: uniqueValues(rows, "date").length, target: 20, weight: 0.25 },
      ]),
      incidents: meta.incidents || 0,
      incidents_per_1000_trips: rows.length ? Number(((meta.incidents || 0) / rows.length * 1000).toFixed(1)) : 0,
      incidents_per_1000_tons: kg ? Number(((meta.incidents || 0) / (kg / 1000) * 1000).toFixed(1)) : 0,
      assigned_bases: meta.assigned_bases || "",
      assigned_routes: meta.assigned_routes || "",
      observed_bases: uniqueValues(rows, "base").join(" · "),
      observed_routes: uniqueValues(rows, "route").join(" · "),
      age_years: meta.age_years,
    };
  }).sort((a, b) => b.tons - a.tons);
  vehicleRows = addPercentiles(vehicleRows, "kg_per_trip", "kg_trip_percentile");
  const activeVehicleSet = new Set(vehicleRows.map((row) => row.vehicle));
  const activeIncidentSet = new Set(rawIncidencias.filter((row) => row.date >= globalFilters.from && row.date <= globalFilters.to && activeVehicleSet.has(row.plate)).map((row) => row.plate));
  vehicleRows = vehicleRows.map((row) => {
    const incidents = rawIncidencias.filter((incident) => incident.date >= globalFilters.from && incident.date <= globalFilters.to && incident.plate === row.vehicle).length;
    return {
      ...row,
      incidents,
      incidents_per_1000_trips: row.trips ? Number((incidents / row.trips * 1000).toFixed(1)) : 0,
      incidents_per_1000_tons: row.tons ? Number((incidents / row.tons * 1000).toFixed(1)) : 0,
      incident_window: activeIncidentSet.has(row.vehicle) ? `${globalFilters.from} · ${globalFilters.to}` : "",
    };
  });
  const filteredIncidents = rawIncidencias.filter((row) => row.date >= globalFilters.from && row.date <= globalFilters.to && activeVehicleSet.has(row.plate));
  const serviceMonths = new Map(byMonth.map((row) => [row.month, row.trips]));
  const incidentMonths = new Map(countRecords(filteredIncidents, "month", "month", "incidents").map((row) => [row.month, row.incidents]));
  const incidentTrend = [...new Set([...serviceMonths.keys(), ...incidentMonths.keys()])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const incidents = incidentMonths.get(month) || 0;
      const services = serviceMonths.get(month) || 0;
      return {
        month,
        incidents,
        services,
        incidents_per_1000_services: services ? Number(((incidents / services) * 1000).toFixed(1)) : 0,
      };
    });
  const filteredFuelMix = countRecords(vehicleRows.filter((row) => row.fuel), "fuel", "fuel", "count");
  const benchmarkKg = sum(benchmarkRecords, "kg");
  const globalKgPerService = benchmarkRecords.length ? benchmarkKg / benchmarkRecords.length : totalTrips ? totalKg / totalTrips : 0;
  const wasteAvg = new Map([...groupRows(benchmarkRecords, "waste")].map(([waste, rows]) => [waste, sum(rows, "kg") / rows.length]));
  const contextAvg = new Map(
    [...groupRows(benchmarkRecords, "route")].flatMap(([route, routeGroup]) =>
      [...groupRows(routeGroup, "site")].flatMap(([site, siteRows]) =>
        [...groupRows(siteRows, "waste")].map(([waste, contextRows]) => [`${route}||${site}||${waste}`, sum(contextRows, "kg") / contextRows.length]),
      ),
    ),
  );
  const siteWasteAvg = new Map(
    [...groupRows(benchmarkRecords, "site")].flatMap(([site, siteRows]) =>
      [...groupRows(siteRows, "waste")].map(([waste, contextRows]) => [`${site}||${waste}`, sum(contextRows, "kg") / contextRows.length]),
    ),
  );

  let driverRows = [...groupRows(records, "driver")].map(([driver, rows]) => {
    const kg = sum(rows, "kg");
    const expectedKg = rows.reduce(
      (total, row) => total + (contextAvg.get(`${row.route}||${row.site}||${row.waste}`) || siteWasteAvg.get(`${row.site}||${row.waste}`) || wasteAvg.get(row.waste) || globalKgPerService),
      0,
    );
    const days = uniqueValues(rows, "date");
    const daily = [...groupRows(rows, "date")].map(([, dayRows]) => ({ services: dayRows.length, kg: sum(dayRows, "kg") }));
    const servicesPerDayValues = daily.map((row) => row.services);
    const dailyKgValues = daily.map((row) => row.kg);
    const servicesStd = standardDeviation(servicesPerDayValues);
    const dailyKgStd = standardDeviation(dailyKgValues);
    const servicesAvg = days.length ? rows.length / days.length : 0;
    const dailyKgAvg = daily.length ? sum(daily, "kg") / daily.length : 0;
    return {
      driver,
      total_kg: Math.round(kg),
      total_services: rows.length,
      work_days: days.length,
      ...confidenceScore([
        { value: days.length, target: driverMinDays, weight: 0.45 },
        { value: rows.length, target: 80, weight: 0.35 },
        { value: uniqueValues(rows, "route").length, target: 2, weight: 0.1 },
        { value: uniqueValues(rows, "waste").length, target: 4, weight: 0.1 },
      ]),
      first_day: days[0],
      last_day: days[days.length - 1],
      sites: uniqueValues(rows, "site").length,
      routes: uniqueValues(rows, "route").length,
      bases: uniqueValues(rows, "base").length,
      waste_types: uniqueValues(rows, "waste").length,
      vehicles: uniqueValues(rows, "vehicle").length,
      main_route: topShareLabel(rows, "route"),
      main_waste: topShareLabel(rows, "waste"),
      main_vehicle: topShareLabel(rows, "vehicle"),
      tons: Number((kg / 1000).toFixed(1)),
      kg_per_service: Math.round(kg / rows.length),
      expected_kg_per_service: rows.length ? Math.round(expectedKg / rows.length) : 0,
      adjusted_kg_delta: Math.round(kg - expectedKg),
      adjusted_load_index: expectedKg ? Number(((kg / expectedKg) * 100).toFixed(1)) : 0,
      services_per_day: days.length ? Number((rows.length / days.length).toFixed(2)) : 0,
      tons_per_day: days.length ? Number((kg / 1000 / days.length).toFixed(2)) : 0,
      services_day_std: Number(servicesStd.toFixed(2)),
      services_day_cv: servicesAvg ? Number(((servicesStd / servicesAvg) * 100).toFixed(1)) : 0,
      daily_kg_cv: dailyKgAvg ? Number(((dailyKgStd / dailyKgAvg) * 100).toFixed(1)) : 0,
      max_services_day: Math.max(...daily.map((row) => row.services), 0),
      avg_daily_kg: daily.length ? Math.round(sum(daily, "kg") / daily.length) : 0,
      max_daily_kg: Math.max(...daily.map((row) => row.kg), 0),
    };
  });
  const benchmarkDriverRows = [...groupRows(benchmarkRecords, "driver")].map(([, rows]) => {
    const days = uniqueValues(rows, "date").length;
    return { work_days: days, services_per_day: days ? rows.length / days : 0 };
  });
  const comparableDrivers = benchmarkDriverRows.filter((row) => row.work_days >= 10);
  const avgServicesPerDay = comparableDrivers.length ? sum(comparableDrivers, "services_per_day") / comparableDrivers.length : 0;
  driverRows = driverRows
    .map((row) => {
      const serviceDayIndex = avgServicesPerDay ? Number(((row.services_per_day / avgServicesPerDay) * 100).toFixed(1)) : 0;
      return {
        ...row,
        service_day_index: serviceDayIndex,
        normalized_score: Number((row.adjusted_load_index * 0.55 + serviceDayIndex * 0.45).toFixed(1)),
      };
    })
    .sort((a, b) => b.total_services - a.total_services || b.tons - a.tons);
  driverRows = applyDriverClusters(addPercentiles(addPercentiles(driverRows, "normalized_score", "score_percentile"), "services_per_day", "services_day_percentile"));
  const clusterRows = Object.entries(DRIVER_CLUSTER_DEFS)
    .map(([key, definition]) => {
      const clusterDrivers = driverRows.filter((row) => row.cluster_key === key);
      const kg = sum(clusterDrivers, "total_kg");
      return {
        key,
        profile: definition.label,
        color: definition.color,
        drivers: clusterDrivers.length,
        comparable: clusterDrivers.filter((row) => row.work_days >= driverMinDays).length,
        services: sum(clusterDrivers, "total_services"),
        work_days: sum(clusterDrivers, "work_days"),
        tons: Number((kg / 1000).toFixed(1)),
        avg_score: clusterDrivers.length ? Number((sum(clusterDrivers, "normalized_score") / clusterDrivers.length).toFixed(1)) : 0,
        avg_services_day: clusterDrivers.length ? Number((sum(clusterDrivers, "services_per_day") / clusterDrivers.length).toFixed(1)) : 0,
        avg_kg_service: clusterDrivers.length ? Math.round(sum(clusterDrivers, "kg_per_service") / clusterDrivers.length) : 0,
        description: definition.description,
        action: definition.action,
      };
    })
    .filter((row) => row.drivers)
    .sort((a, b) => b.drivers - a.drivers || b.services - a.services);
  const allOutliers = [
    ...outliers(siteRows, "kg_per_trip", "site", "Garbigune kg/serv. salida"),
    ...outliers(vehicleRows, "kg_per_trip", "vehicle", "Vehículo kg/serv. salida"),
    ...outliers(driverRows.filter((row) => row.work_days >= driverMinDays), "normalized_score", "driver", "Conductor score"),
    ...outliers(driverRows.filter((row) => row.work_days >= driverMinDays), "services_per_day", "driver", "Conductor serv./día"),
  ];

  return {
    generatedAt: data.generatedAt,
    coverage: data.coverage,
    kpis: {
      tons: Number((totalKg / 1000).toFixed(1)),
      trips: totalTrips,
      kgPerTrip: totalTrips ? Math.round(totalKg / totalTrips) : 0,
      activeVehicles: uniqueValues(records, "vehicle").length,
      drivers: uniqueValues(records, "driver").length,
      sites: uniqueValues(records, "site").length,
      routes: uniqueValues(records, "route").length,
      bases: uniqueValues(records, "base").length,
      wasteTypes: uniqueValues(records, "waste").length,
      refuerzos: data.kpis.refuerzos,
      incidents: filteredIncidents.length,
      incidentsPerVehicle: vehicleRows.length ? Number((filteredIncidents.length / vehicleRows.length).toFixed(1)) : 0,
    },
    summary: {
      byMonth,
      byMonthWaste,
      topSites: siteRows.slice(0, 12),
      topWaste: wasteRows.slice(0, 12),
    },
    comparatives: {
      monthly: monthlyComparatives(records, byMonth),
      outliers: allOutliers,
      counts: {
        outliers: allOutliers.length,
        siteOutliers: allOutliers.filter((row) => row.kind.startsWith("Garbigune")).length,
        vehicleOutliers: allOutliers.filter((row) => row.kind.startsWith("Vehículo")).length,
        driverOutliers: allOutliers.filter((row) => row.kind.startsWith("Conductor")).length,
      },
    },
    sitesWaste: {
      sites: siteRows,
      waste: wasteRows,
      routes: routeRows,
      bases: baseRows,
      matrix: buildMatrix(records, "site", "waste", siteRows, wasteRows, 10, 8),
      detailSample: data.sitesWaste.detailSample,
    },
    fleet: {
      ...data.fleet,
      vehicles: vehicleRows,
      incidentTrend,
      fuelMix: filteredFuelMix,
      incidentTypes: countRecords(filteredIncidents, "type", "type", "count"),
      incidentSubgroups: countRecords(filteredIncidents, "subgroup", "subgroup", "count", 10),
      workshops: countRecords(filteredIncidents, "workshop", "workshop", "count", 8),
    },
    drivers: {
      drivers: driverRows,
      clusters: clusterRows,
      topByServices: driverRows.slice(0, 12),
      topByLoad: [...driverRows].sort((a, b) => b.tons - a.tons).slice(0, 12),
      comparableDrivers: driverRows.filter((row) => row.work_days >= driverMinDays),
      excludedDrivers: driverRows.filter((row) => row.work_days < driverMinDays),
      topByDailyProductivity: driverRows.filter((row) => row.work_days >= driverMinDays).sort((a, b) => b.services_per_day - a.services_per_day).slice(0, 12),
      topByNormalizedEfficiency: driverRows.filter((row) => row.work_days >= driverMinDays).sort((a, b) => b.normalized_score - a.normalized_score).slice(0, 12),
      wasteComposition: buildMatrix(records, "driver", "waste", driverRows, wasteRows, 12, 8),
    },
    resources: data.resources,
    capture: aggregateCapture(),
  };
}

function option(label, value = label) {
  return el("option", { value, text: label });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, columns, rows) {
  const lines = [
    columns.map((column) => csvEscape(column.label)).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const raw = column.get ? column.get(row) : row[column.key];
          return csvEscape(column.format ? column.format(raw, row) : raw);
        })
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function fillSelect(id, values) {
  const select = document.querySelector(id);
  select.innerHTML = "";
  select.append(option("Todos", ""));
  values.forEach((value) => select.append(option(value)));
}

function fillDimensionSelect(id, selected) {
  const select = document.querySelector(id);
  if (!select) return;
  select.innerHTML = "";
  Object.entries(matrixDimensions).forEach(([value, label]) => {
    select.append(option(label, value));
  });
  select.value = selected;
}

function monthName(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function addMonths(month, delta) {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month) {
  const first = `${month}-01`;
  const date = new Date(`${month}-01T00:00:00`);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return { first, last: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function clampDate(date) {
  if (date < globalFilters.minDate) return globalFilters.minDate;
  if (date > globalFilters.maxDate) return globalFilters.maxDate;
  return date;
}

function renderMonthPicker() {
  const root = document.querySelector("#month-grid");
  if (!root || !monthPickerYear) return;
  document.querySelector("#month-picker-title").textContent = monthPickerYear;
  document.querySelector("#month-range-label").textContent = `${globalFilters.from.slice(0, 7)} · ${globalFilters.to.slice(0, 7)}`;
  root.innerHTML = "";
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  labels.forEach((label, index) => {
    const month = `${monthPickerYear}-${String(index + 1).padStart(2, "0")}`;
    const { first, last } = monthBounds(month);
    const disabled = last < globalFilters.minDate || first > globalFilters.maxDate;
    const startMonth = globalFilters.from.slice(0, 7);
    const endMonth = globalFilters.to.slice(0, 7);
    const inRange = month >= startMonth && month <= endMonth;
    const classes = [
      inRange ? "active" : "",
      month === startMonth ? "range-start" : "",
      month === endMonth ? "range-end" : "",
    ].filter(Boolean).join(" ");
    const button = el("button", { class: classes, type: "button", text: label, "data-month": month });
    button.disabled = disabled;
    button.addEventListener("click", () => {
      const bounds = monthBounds(month);
      if (selectingMonthStart || month > globalFilters.to.slice(0, 7)) {
        globalFilters.from = clampDate(bounds.first);
        if (month > globalFilters.to.slice(0, 7)) globalFilters.to = clampDate(bounds.last);
        selectingMonthStart = false;
      } else {
        globalFilters.to = clampDate(bounds.last);
        if (globalFilters.to < globalFilters.from) [globalFilters.from, globalFilters.to] = [globalFilters.to, globalFilters.from];
        selectingMonthStart = true;
      }
      calendarMonth = month;
      selectingRangeStart = true;
      applyGlobalFilters();
    });
    root.append(button);
  });
}

function dateInRange(date) {
  const from = globalFilters.from <= globalFilters.to ? globalFilters.from : globalFilters.to;
  const to = globalFilters.from <= globalFilters.to ? globalFilters.to : globalFilters.from;
  return date >= from && date <= to;
}

function renderCalendar() {
  const grid = document.querySelector("#calendar-grid");
  if (!grid || !calendarMonth) return;
  const minDate = globalFilters.minDate;
  const maxDate = globalFilters.maxDate;
  document.querySelector("#calendar-title").textContent = monthName(calendarMonth);
  document.querySelector("#calendar-range-label").textContent = `${globalFilters.from} · ${globalFilters.to}`;
  renderMonthPicker();
  grid.innerHTML = "";

  const first = new Date(`${calendarMonth}-01T00:00:00`);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let i = 0; i < firstWeekday; i += 1) grid.append(el("span", { class: "calendar-empty" }));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
    const disabled = date < minDate || date > maxDate;
    const classes = [
      "calendar-day",
      date === globalFilters.from ? "range-start" : "",
      date === globalFilters.to ? "range-end" : "",
      dateInRange(date) ? "in-range" : "",
    ].filter(Boolean).join(" ");
    const button = el("button", { class: classes, type: "button", text: String(day), "data-date": date });
    if (disabled) button.disabled = true;
    button.addEventListener("click", () => {
      if (selectingRangeStart || date > globalFilters.to) {
        globalFilters.from = date;
        if (date > globalFilters.to) globalFilters.to = date;
        selectingRangeStart = false;
      } else {
        globalFilters.to = date;
        if (globalFilters.to < globalFilters.from) [globalFilters.from, globalFilters.to] = [globalFilters.to, globalFilters.from];
        selectingRangeStart = true;
      }
      applyGlobalFilters();
    });
    grid.append(button);
  }
}

function renderWasteButtons() {
  const root = document.querySelector("#global-waste-buttons");
  if (!root) return;
  root.innerHTML = "";
  globalFilters.allWastes.forEach((waste) => {
    const selected = globalFilters.wastes.has(waste);
    const button = el("button", { class: selected ? "selected" : "", type: "button", text: waste, title: waste });
    button.addEventListener("click", () => {
      if (globalFilters.wastes.has(waste)) globalFilters.wastes.delete(waste);
      else globalFilters.wastes.add(waste);
      applyGlobalFilters();
    });
    root.append(button);
  });
}

function initGlobalFilters() {
  const dates = uniqueValues(rawPesadas, "date");
  const wastes = uniqueValues(rawPesadas, "waste");
  const params = new URLSearchParams(window.location.search);
  const urlWastes = params.get("waste") ? params.get("waste").split("|").filter((item) => wastes.includes(item)) : wastes;
  globalFilters = {
    from: params.get("from") || dates[0],
    to: params.get("to") || dates[dates.length - 1],
    minDate: dates[0],
    maxDate: dates[dates.length - 1],
    site: params.get("site") || "",
    base: params.get("base") || "",
    route: params.get("route") || "",
    wastes: new Set(urlWastes.length ? urlWastes : wastes),
    allWastes: wastes,
    vehicle: params.get("vehicle") || "",
    driver: params.get("driver") || "",
  };
  compareMode = params.get("compare") || "previous";
  calendarMonth = globalFilters.to.slice(0, 7);
  monthPickerYear = globalFilters.to.slice(0, 4);

  fillSelect("#global-site", uniqueValues(rawPesadas, "site"));
  fillSelect("#global-base", uniqueValues(rawPesadas, "base"));
  fillSelect("#global-route", uniqueValues(rawPesadas, "route"));
  fillSelect("#global-vehicle", uniqueValues(rawPesadas, "vehicle"));
  fillSelect("#global-driver", uniqueValues(rawPesadas, "driver"));
  fillCaptureSelects();
  fillDimensionSelect("#matrix-row-dimension", configurableMatrix.row);
  fillDimensionSelect("#matrix-col-dimension", configurableMatrix.col);
  initCaptureFiltersFromUrl(params);

  [
    ["#global-base", "base"],
    ["#global-route", "route"],
    ["#global-site", "site"],
    ["#global-vehicle", "vehicle"],
    ["#global-driver", "driver"],
  ].forEach(([selector, key]) => {
    document.querySelector(selector).addEventListener("change", (event) => {
      globalFilters[key] = event.target.value;
      applyGlobalFilters();
    });
  });

  document.querySelector("#waste-select-all").addEventListener("click", () => {
    globalFilters.wastes = new Set(globalFilters.allWastes);
    applyGlobalFilters();
  });
  document.querySelector("#waste-clear-all").addEventListener("click", () => {
    globalFilters.wastes = new Set();
    applyGlobalFilters();
  });
  document.querySelector("#calendar-prev").addEventListener("click", () => {
    calendarMonth = addMonths(calendarMonth, -1);
    monthPickerYear = calendarMonth.slice(0, 4);
    renderCalendar();
  });
  document.querySelector("#calendar-next").addEventListener("click", () => {
    calendarMonth = addMonths(calendarMonth, 1);
    monthPickerYear = calendarMonth.slice(0, 4);
    renderCalendar();
  });
  document.querySelector("#month-prev-year").addEventListener("click", () => {
    monthPickerYear = String(Number(monthPickerYear) - 1);
    renderMonthPicker();
  });
  document.querySelector("#month-next-year").addEventListener("click", () => {
    monthPickerYear = String(Number(monthPickerYear) + 1);
    renderMonthPicker();
  });

  document.querySelector("#global-reset").addEventListener("click", () => {
    globalFilters = { ...globalFilters, from: dates[0], to: dates[dates.length - 1], base: "", route: "", site: "", wastes: new Set(globalFilters.allWastes), vehicle: "", driver: "" };
    calendarMonth = dates[dates.length - 1].slice(0, 7);
    monthPickerYear = dates[dates.length - 1].slice(0, 4);
    selectingRangeStart = true;
    selectingMonthStart = true;
    applyGlobalFilters();
  });
  document.querySelector("#copy-filter-link").addEventListener("click", async () => {
    updateFilterUrl();
    await navigator.clipboard?.writeText(window.location.href);
  });
  document.querySelector("#compare-mode").addEventListener("change", (event) => {
    compareMode = event.target.value;
    applyGlobalFilters();
  });
  document.querySelector("#driver-min-days").addEventListener("change", (event) => {
    driverMinDays = Number(event.target.value) || 10;
    applyGlobalFilters();
  });
  document.querySelectorAll("#incident-breakdown button").forEach((button) => {
    button.addEventListener("click", () => {
      incidentBreakdown = button.dataset.breakdown || "subgroup";
      renderCharts();
    });
  });
  [
    ["#capture-site", "site"],
    ["#capture-family", "wasteFamily"],
    ["#capture-subfamily", "wasteSubfamily"],
    ["#capture-waste", "waste"],
    ["#capture-user", "userType"],
  ].forEach(([selector, key]) => {
    document.querySelector(selector).addEventListener("change", (event) => {
      captureFilters[key] = event.target.value;
      if (key === "wasteFamily") {
        if (captureFilters.wasteSubfamily) {
          const selectedSubfamily = rawAw.find((row) => row.waste_subfamily === captureFilters.wasteSubfamily);
          if (selectedSubfamily?.waste_family !== captureFilters.wasteFamily) captureFilters.wasteSubfamily = "";
        }
        if (captureFilters.waste) {
          const selectedWaste = rawAw.find((row) => row.waste === captureFilters.waste);
          if (selectedWaste?.waste_family !== captureFilters.wasteFamily) captureFilters.waste = "";
        }
      }
      if (key === "wasteSubfamily" && captureFilters.wasteSubfamily) {
        const selectedSubfamily = rawAw.find((row) => row.waste_subfamily === captureFilters.wasteSubfamily);
        captureFilters.wasteFamily = selectedSubfamily?.waste_family || captureFilters.wasteFamily;
        if (captureFilters.waste) {
          const selectedWaste = rawAw.find((row) => row.waste === captureFilters.waste);
          if (selectedWaste?.waste_subfamily !== captureFilters.wasteSubfamily) captureFilters.waste = "";
        }
      }
      if (key === "waste" && captureFilters.waste) {
        const selectedWaste = rawAw.find((row) => row.waste === captureFilters.waste);
        captureFilters.wasteFamily = selectedWaste?.waste_family || captureFilters.wasteFamily;
        captureFilters.wasteSubfamily = selectedWaste?.waste_subfamily || captureFilters.wasteSubfamily;
      }
      applyGlobalFilters();
    });
  });
  document.querySelectorAll("#capture-composition-level button").forEach((button) => {
    button.addEventListener("click", () => {
      captureFilters.compositionLevel = button.dataset.level || "family";
      updateFilterUrl();
      renderCapture();
      renderCharts();
    });
  });
  document.querySelectorAll("#capture-flow-review button").forEach((button) => {
    button.addEventListener("click", () => {
      captureFilters.flowReview = button.dataset.flowReview || "all";
      updateFilterUrl();
      renderCapture();
    });
  });
  document.querySelectorAll("#capture-metric button").forEach((button) => {
    button.addEventListener("click", () => {
      captureFilters.metric = button.dataset.metric || "kg";
      updateFilterUrl();
      renderCapture();
    });
  });
  document.querySelector("#capture-reset").addEventListener("click", () => {
    captureFilters = { site: "", wasteFamily: "", wasteSubfamily: "", waste: "", userType: "", cp: "", metric: "kg", compositionLevel: "family", flowReview: "all" };
    applyGlobalFilters();
  });
  document.querySelector("#capture-priority-export").addEventListener("click", () => {
    exportCapturePriorityCases();
  });
  document.querySelector("#matrix-col-dimension").addEventListener("change", (event) => {
    configurableMatrix.col = event.target.value;
    if (configurableMatrix.row === configurableMatrix.col) configurableMatrix.row = configurableMatrix.col === "site" ? "waste" : "site";
    renderMatrix();
  });
  document.querySelectorAll(".collapse-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(`#${button.dataset.collapseTarget}`);
      const collapsed = target.classList.toggle("collapsed");
      button.textContent = collapsed ? "+" : "−";
      button.setAttribute("aria-expanded", String(!collapsed));
    });
  });
  applyGlobalFilters();
}

function initCaptureFiltersFromUrl(params) {
  const valueIn = (value, values) => (value && (!values.length || values.includes(value)) ? value : "");
  captureFilters.site = valueIn(params.get("aw_site"), uniqueValues(rawAw, "site"));
  captureFilters.wasteFamily = valueIn(params.get("aw_family"), uniqueValues(rawAw, "waste_family"));
  captureFilters.wasteSubfamily = valueIn(params.get("aw_subfamily"), uniqueValues(rawAw, "waste_subfamily"));
  captureFilters.waste = valueIn(params.get("aw_waste"), uniqueValues(rawAw, "waste"));
  captureFilters.userType = valueIn(params.get("aw_user"), uniqueValues(rawAw, "user_type"));
  captureFilters.cp = valueIn(params.get("aw_cp"), uniqueValues(rawAw.map((row) => ({ cp: row.cp || "SIN CP" })), "cp"));
  captureFilters.metric = ["kg", "entries", "rows", "kg_per_km", "entries_per_km"].includes(params.get("aw_metric")) ? params.get("aw_metric") : "kg";
  captureFilters.flowReview = ["all", "off", "nearest", "review"].includes(params.get("aw_flow_review")) ? params.get("aw_flow_review") : "all";
  captureFilters.compositionLevel = ["family", "subfamily", "waste"].includes(params.get("aw_composition")) ? params.get("aw_composition") : "family";
  reconcileCaptureFilters();
}

function fillCaptureSelects() {
  const withSelected = (values, selected) => [...new Set([selected, ...values].filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es"));
  fillSelect("#capture-site", withSelected(uniqueValues(rawAw, "site").length ? uniqueValues(rawAw, "site") : (data.capture?.bySite || []).map((row) => row.site), captureFilters.site));
  fillSelect("#capture-family", withSelected(uniqueValues(rawAw, "waste_family").length ? uniqueValues(rawAw, "waste_family") : (data.capture?.byFamily || []).map((row) => row.family), captureFilters.wasteFamily));
  fillSelect("#capture-subfamily", withSelected(uniqueValues(rawAw, "waste_subfamily").length ? uniqueValues(rawAw, "waste_subfamily") : (data.capture?.bySubfamily || []).map((row) => row.subfamily), captureFilters.wasteSubfamily));
  fillSelect("#capture-waste", withSelected(uniqueValues(rawAw, "waste").length ? uniqueValues(rawAw, "waste") : (data.capture?.waste || []).map((row) => row.waste), captureFilters.waste));
  fillSelect("#capture-user", withSelected(uniqueValues(rawAw, "user_type").length ? uniqueValues(rawAw, "user_type") : (data.capture?.userTypes || []).map((row) => row.user_type), captureFilters.userType));
}

function reconcileCaptureFilters() {
  if (captureFilters.waste) {
    const selectedWaste = rawAw.find((row) => row.waste === captureFilters.waste);
    if (selectedWaste) {
      captureFilters.wasteFamily = selectedWaste.waste_family || captureFilters.wasteFamily;
      captureFilters.wasteSubfamily = selectedWaste.waste_subfamily || captureFilters.wasteSubfamily;
    }
  }
  if (captureFilters.wasteSubfamily) {
    const selectedSubfamily = rawAw.find((row) => row.waste_subfamily === captureFilters.wasteSubfamily);
    if (selectedSubfamily) captureFilters.wasteFamily = selectedSubfamily.waste_family || captureFilters.wasteFamily;
  }
  if (captureFilters.wasteFamily && captureFilters.wasteSubfamily) {
    const selectedSubfamily = rawAw.find((row) => row.waste_subfamily === captureFilters.wasteSubfamily);
    if (selectedSubfamily?.waste_family !== captureFilters.wasteFamily) captureFilters.wasteSubfamily = "";
  }
  if (captureFilters.wasteSubfamily && captureFilters.waste) {
    const selectedWaste = rawAw.find((row) => row.waste === captureFilters.waste);
    if (selectedWaste?.waste_subfamily !== captureFilters.wasteSubfamily) captureFilters.waste = "";
  }
  if (captureFilters.wasteFamily && captureFilters.waste) {
    const selectedWaste = rawAw.find((row) => row.waste === captureFilters.waste);
    if (selectedWaste?.waste_family !== captureFilters.wasteFamily) captureFilters.waste = "";
  }
}

function updateFilterUrl() {
  const params = new URLSearchParams();
  if (globalFilters.from !== globalFilters.minDate) params.set("from", globalFilters.from);
  if (globalFilters.to !== globalFilters.maxDate) params.set("to", globalFilters.to);
  if (globalFilters.base) params.set("base", globalFilters.base);
  if (globalFilters.route) params.set("route", globalFilters.route);
  if (globalFilters.site) params.set("site", globalFilters.site);
  if (globalFilters.vehicle) params.set("vehicle", globalFilters.vehicle);
  if (globalFilters.driver) params.set("driver", globalFilters.driver);
  if (globalFilters.wastes.size !== globalFilters.allWastes.length) params.set("waste", [...globalFilters.wastes].join("|"));
  if (compareMode !== "previous") params.set("compare", compareMode);
  if (captureFilters.site) params.set("aw_site", captureFilters.site);
  if (captureFilters.wasteFamily) params.set("aw_family", captureFilters.wasteFamily);
  if (captureFilters.wasteSubfamily) params.set("aw_subfamily", captureFilters.wasteSubfamily);
  if (captureFilters.waste) params.set("aw_waste", captureFilters.waste);
  if (captureFilters.userType) params.set("aw_user", captureFilters.userType);
  if (captureFilters.cp) params.set("aw_cp", captureFilters.cp);
  if (captureFilters.metric !== "kg") params.set("aw_metric", captureFilters.metric);
  if (captureFilters.flowReview !== "all") params.set("aw_flow_review", captureFilters.flowReview);
  if (captureFilters.compositionLevel !== "family") params.set("aw_composition", captureFilters.compositionLevel);
  const query = params.toString();
  history.replaceState(null, "", `${query ? `?${query}` : ""}${window.location.hash}`);
}

function filteredPesadas(options = {}) {
  const ignore = options.ignore || "";
  const baseFrom = options.from || globalFilters.from;
  const baseTo = options.to || globalFilters.to;
  const from = baseFrom <= baseTo ? baseFrom : baseTo;
  const to = baseFrom <= baseTo ? baseTo : baseFrom;
  return rawPesadas.filter((row) => {
    if (row.date < from || row.date > to) return false;
    if (ignore !== "base" && globalFilters.base && row.base !== globalFilters.base) return false;
    if (ignore !== "route" && globalFilters.route && row.route !== globalFilters.route) return false;
    if (ignore !== "site" && globalFilters.site && row.site !== globalFilters.site) return false;
    if (ignore !== "waste" && !globalFilters.wastes.has(row.waste)) return false;
    if (ignore !== "vehicle" && globalFilters.vehicle && row.vehicle !== globalFilters.vehicle) return false;
    if (ignore !== "driver" && globalFilters.driver && row.driver !== globalFilters.driver) return false;
    return true;
  });
}

function shiftDate(date, days) {
  const item = new Date(`${date}T00:00:00`);
  item.setDate(item.getDate() + days);
  return item.toISOString().slice(0, 10);
}

function shiftYear(date, years) {
  const item = new Date(`${date}T00:00:00`);
  item.setFullYear(item.getFullYear() + years);
  return item.toISOString().slice(0, 10);
}

function comparisonRows() {
  const from = globalFilters.from <= globalFilters.to ? globalFilters.from : globalFilters.to;
  const to = globalFilters.from <= globalFilters.to ? globalFilters.to : globalFilters.from;
  if (compareMode === "mom" || compareMode === "yoy") return [];
  const days = Math.max(1, Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1);
  return filteredPesadas({ from: shiftDate(from, -days), to: shiftDate(to, -days) });
}

function filteredAwRecords() {
  if (!rawAw.length || !globalFilters.from || !globalFilters.to) return [];
  const from = globalFilters.from <= globalFilters.to ? globalFilters.from : globalFilters.to;
  const to = globalFilters.from <= globalFilters.to ? globalFilters.to : globalFilters.from;
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  const site = globalFilters.site || captureFilters.site;
  const awBridge = selectedGlobalAwFamilies();
  return rawAw.filter((row) => {
    if ((row.month || row.date?.slice(0, 7) || "") < fromMonth || (row.month || row.date?.slice(0, 7) || "") > toMonth) return false;
    if (site && row.site !== site) return false;
    if (awBridge.active && awBridge.families.size && !awBridge.families.has(row.waste_family)) return false;
    if (captureFilters.wasteFamily && row.waste_family !== captureFilters.wasteFamily) return false;
    if (captureFilters.wasteSubfamily && row.waste_subfamily !== captureFilters.wasteSubfamily) return false;
    if (captureFilters.waste && row.waste !== captureFilters.waste) return false;
    if (captureFilters.userType && row.user_type !== captureFilters.userType) return false;
    if (captureFilters.cp && (row.cp || "SIN CP") !== captureFilters.cp) return false;
    return true;
  });
}

function aggregateCapture() {
  const rows = filteredAwRecords();
  const awBridge = selectedGlobalAwFamilies();
  const locationMap = new Map((data.capture?.locations || []).map((row) => [row.site_key, row]));
  const allLocations = (data.capture?.locations || [])
    .map((row) => ({ ...row, lat: Number(row.lat), lon: Number(row.lon) }))
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
  const centroidByCp = new Map((captureGeojson?.features || []).map((feature) => [feature.properties?.cp || "", geoCentroid(feature.geometry)]).filter(([, centroid]) => centroid));
  const nearestByCp = new Map();
  centroidByCp.forEach((centroid, cp) => {
    const nearest = allLocations
      .map((location) => ({
        site: location.site,
        site_key: location.site_key,
        distance_km: distanceKm(centroid, [location.lon, location.lat]),
      }))
      .filter((location) => Number.isFinite(location.distance_km) && location.distance_km > 0)
      .sort((a, b) => a.distance_km - b.distance_km)[0];
    if (nearest) nearestByCp.set(cp, nearest);
  });
  const totalKg = sum(rows, "kg");
  const withCpRows = rows.filter((row) => row.cp);
  const geoCpSet = new Set((captureGeojson?.features || []).map((feature) => feature.properties?.cp).filter(Boolean));
  if (!geoCpSet.size) (data.capture?.geoCps || []).forEach((cp) => geoCpSet.add(cp));
  const withGeoRows = rows.filter((row) => row.cp && geoCpSet.has(row.cp));
  let byCp = [...groupRows(rows, "cp")].map(([cp, group]) => {
    const kg = sum(group, "kg");
    const rowCount = sum(group, "rows");
    const entryCount = sum(group, "entries");
    const cpLabel = !cp || cp === "SIN DATO" ? "SIN CP" : cp;
    return {
      cp: cpLabel,
      kg,
      tons: Number((kg / 1000).toFixed(2)),
      entries: entryCount,
      rows: rowCount,
      sites: uniqueValues(group, "site").length,
      wastes: uniqueValues(group, "waste").length,
      waste_families: uniqueValues(group, "waste_family").length,
      waste_subfamilies: uniqueValues(group, "waste_subfamily").length,
      top_site: topLabelBySum(group, "site"),
      top_family: topLabelBySum(group, "waste_family"),
      top_subfamily: topLabelBySum(group, "waste_subfamily"),
      top_waste: topLabelBySum(group, "waste"),
      top_user: topLabelBySum(group, "user_type", "rows"),
      has_geometry: cpLabel !== "SIN CP" ? geoCpSet.has(cpLabel) : false,
    };
  }).sort((a, b) => b.kg - a.kg);
  const bySite = [...groupRows(rows, "site")].map(([site, group]) => {
    const kg = sum(group, "kg");
    const siteKey = group[0]?.site_key;
    const location = locationMap.get(siteKey) || {};
    return {
      site,
      site_key: siteKey,
      kg,
      tons: Number((kg / 1000).toFixed(2)),
      entries: sum(group, "entries"),
      rows: sum(group, "rows"),
      cps: uniqueValues(group.filter((row) => row.cp), "cp").length,
      wastes: uniqueValues(group, "waste").length,
      waste_families: uniqueValues(group, "waste_family").length,
      waste_subfamilies: uniqueValues(group, "waste_subfamily").length,
      lat: Number(location.lat),
      lon: Number(location.lon),
      address: location.direccion || "",
      source_site: location.site || site,
    };
  }).sort((a, b) => b.kg - a.kg);
  const byWaste = [...groupRows(rows, "waste")].map(([waste, group]) => {
    const kg = sum(group, "kg");
    return { waste, family: topLabelBySum(group, "waste_family"), kg, tons: Number((kg / 1000).toFixed(2)), entries: sum(group, "entries"), rows: sum(group, "rows"), share: totalKg ? Number(((kg / totalKg) * 100).toFixed(1)) : 0 };
  }).sort((a, b) => b.kg - a.kg);
  const byFamily = [...groupRows(rows, "waste_family")].map(([family, group]) => {
    const kg = sum(group, "kg");
    return {
      family,
      kg,
      tons: Number((kg / 1000).toFixed(2)),
      entries: sum(group, "entries"),
      rows: sum(group, "rows"),
      wastes: uniqueValues(group, "waste").length,
      share: totalKg ? Number(((kg / totalKg) * 100).toFixed(1)) : 0,
      top_waste: topLabelBySum(group, "waste"),
    };
  }).sort((a, b) => b.kg - a.kg);
  const bySubfamily = [...groupRows(rows, "waste_subfamily")].map(([subfamily, group]) => {
    const kg = sum(group, "kg");
    return {
      subfamily,
      family: topLabelBySum(group, "waste_family"),
      kg,
      tons: Number((kg / 1000).toFixed(2)),
      entries: sum(group, "entries"),
      rows: sum(group, "rows"),
      wastes: uniqueValues(group, "waste").length,
      share: totalKg ? Number(((kg / totalKg) * 100).toFixed(1)) : 0,
      top_waste: topLabelBySum(group, "waste"),
    };
  }).sort((a, b) => b.kg - a.kg);
  const familyBase = new Map((data.capture?.familyLegend || []).map((item) => [item.family, item]));
  const familyLegend = byFamily.map((row) => {
    const base = familyBase.get(row.family) || {};
    return {
      ...base,
      family: row.family,
      tons: row.tons,
      share: row.share,
      activeWastes: row.wastes,
      description: base.description || "Familia AW editable desde la tabla de clasificación.",
      examples: base.examples || row.top_waste || "",
    };
  });
  const byUser = [...groupRows(rows, "user_type")].map(([user_type, group]) => {
    const kg = sum(group, "kg");
    return { user_type: user_type || "SIN DATO", kg, tons: Number((kg / 1000).toFixed(2)), entries: sum(group, "entries"), rows: sum(group, "rows") };
  }).sort((a, b) => b.kg - a.kg);
  const flowGroups = new Map();
  rows.filter((row) => row.cp).forEach((row) => {
    const key = `${row.cp}||${row.site}`;
    if (!flowGroups.has(key)) flowGroups.set(key, []);
    flowGroups.get(key).push(row);
  });
  const flows = [...flowGroups].map(([key, group]) => {
    const [cp, site] = key.split("||");
    const kg = sum(group, "kg");
    const location = locationMap.get(group[0]?.site_key) || {};
    const distance = distanceKm(centroidByCp.get(cp), [Number(location.lon), Number(location.lat)]);
    const nearest = nearestByCp.get(cp) || {};
    const nearestDistance = Number(nearest.distance_km) || 0;
    const nearestSite = nearest.site || "";
    const distanceDelta = distance && nearestDistance ? distance - nearestDistance : 0;
    const isNearest = Boolean(nearestSite && group[0]?.site_key && nearest.site_key === group[0]?.site_key);
    const extraKm = !isNearest && nearestDistance ? Math.max(distanceDelta, 0) : 0;
    const extraTonKm = (kg / 1000) * extraKm;
    const severityRank = extraTonKm >= 10 || (extraKm >= 20 && kg >= 500) ? 3 : extraTonKm >= 2 || extraKm >= 10 ? 2 : extraKm > 0 ? 1 : 0;
    const severity = severityRank === 3 ? "Alta" : severityRank === 2 ? "Media" : severityRank === 1 ? "Leve" : isNearest ? "Más cercano" : "Sin comparar";
    const originMunicipality = topLabelBySum(group, "origin_municipality", "rows");
    const accountMunicipality = topLabelBySum(group, "account_municipality", "rows");
    const topFamily = topLabelBySum(group, "waste_family");
    const topSubfamily = topLabelBySum(group, "waste_subfamily");
    const entryCount = sum(group, "entries");
    const reason = probableFlowReason({
      isNearest,
      extraKm,
      extraTonKm,
      originMunicipality,
      accountMunicipality,
      site,
      family: topFamily,
      subfamily: topSubfamily,
    });
    return {
      cp,
      site,
      site_key: group[0]?.site_key,
      origin_municipality: originMunicipality,
      account_municipality: accountMunicipality,
      kg,
      tons: Number((kg / 1000).toFixed(2)),
      entries: entryCount,
      rows: sum(group, "rows"),
      distance_km: Number(distance.toFixed(1)),
      nearest_site: nearestSite,
      nearest_distance_km: nearestDistance ? Number(nearestDistance.toFixed(1)) : 0,
      distance_delta_km: nearestDistance ? Number(distanceDelta.toFixed(1)) : 0,
      is_nearest: isNearest,
      extra_km: Number(extraKm.toFixed(1)),
      extra_ton_km: Number(extraTonKm.toFixed(2)),
      severity,
      severity_rank: severityRank,
      probable_reason: reason.reason,
      reason_type: reason.reasonType,
      needs_review: reason.needsReview,
      kg_per_km: distance ? Number((kg / distance).toFixed(1)) : 0,
      entries_per_km: distance ? Number((entryCount / distance).toFixed(2)) : 0,
      top_family: topFamily,
      top_subfamily: topSubfamily,
      top_waste: topLabelBySum(group, "waste"),
      top_user: topLabelBySum(group, "user_type", "rows"),
    };
  }).sort((a, b) => b.kg - a.kg);
  const flowByCp = new Map();
  flows.forEach((flow) => {
    if (!flowByCp.has(flow.cp)) flowByCp.set(flow.cp, []);
    flowByCp.get(flow.cp).push(flow);
  });
  byCp = byCp.map((row) => {
    const cpFlows = flowByCp.get(row.cp) || [];
    const totalFlowKg = sum(cpFlows, "kg");
    const weightedDistance = totalFlowKg ? cpFlows.reduce((total, flow) => total + flow.distance_km * flow.kg, 0) / totalFlowKg : 0;
    return {
      ...row,
      avg_distance_km: Number(weightedDistance.toFixed(1)),
      kg_per_km: weightedDistance ? Number((row.kg / weightedDistance).toFixed(1)) : 0,
      entries_per_km: weightedDistance ? Number((row.entries / weightedDistance).toFixed(2)) : 0,
    };
  });
  const flowBySite = new Map();
  flows.forEach((flow) => {
    if (!flowBySite.has(flow.site)) flowBySite.set(flow.site, []);
    flowBySite.get(flow.site).push(flow);
  });
  bySite.forEach((row) => {
    const siteFlows = flowBySite.get(row.site) || [];
    const totalFlowKg = sum(siteFlows, "kg");
    const weightedDistance = totalFlowKg ? siteFlows.reduce((total, flow) => total + flow.distance_km * flow.kg, 0) / totalFlowKg : 0;
    row.avg_distance_km = Number(weightedDistance.toFixed(1));
    row.kg_per_km = weightedDistance ? Number((row.kg / weightedDistance).toFixed(1)) : 0;
    row.entries_per_km = weightedDistance ? Number((row.entries / weightedDistance).toFixed(2)) : 0;
  });
  const offNearestFlows = flows.filter((flow) => flow.nearest_site && !flow.is_nearest);
  const offNearestKg = sum(offNearestFlows, "kg");
  const extraTonKm = sum(offNearestFlows, "extra_ton_km");
  const offNearestCps = uniqueValues(offNearestFlows, "cp").length;
  const weightedExtraKm = offNearestKg ? offNearestFlows.reduce((total, flow) => total + flow.extra_km * flow.kg, 0) / offNearestKg : 0;
  const reviewFlows = offNearestFlows.filter((flow) => flow.needs_review);
  const reviewKg = sum(reviewFlows, "kg");
  return {
    meta: {
      ...(data.capture?.meta || {}),
      filteredRows: sum(rows, "rows"),
      filteredEntries: sum(rows, "entries"),
      filteredKg: totalKg,
      filteredTons: Number((totalKg / 1000).toFixed(2)),
      cpRowsShare: percentage(sum(withCpRows, "rows"), sum(rows, "rows")),
      cpKgShare: percentage(sum(withCpRows, "kg"), totalKg),
      geoKgShare: percentage(sum(withGeoRows, "kg"), totalKg),
      nearestFlowCount: flows.filter((flow) => flow.nearest_site).length,
      offNearestFlowCount: offNearestFlows.length,
      offNearestKg,
      offNearestKgShare: percentage(offNearestKg, totalKg),
      offNearestCps,
      extraTonKm: Number(extraTonKm.toFixed(2)),
      weightedExtraKm: Number(weightedExtraKm.toFixed(1)),
      reviewFlowCount: reviewFlows.length,
      reviewKg,
      reviewKgShare: percentage(reviewKg, totalKg),
      globalWasteBridgeActive: awBridge.active,
      globalWasteAwFamilies: [...awBridge.families].sort((a, b) => a.localeCompare(b, "es")),
      globalWasteMapped: awBridge.mappedWastes,
      globalWasteUnmapped: awBridge.unmappedWastes,
      activeSiteSource: globalFilters.site ? "Filtro global de garbigune" : captureFilters.site ? "Filtro local AW" : "Todos",
      activeCp: captureFilters.cp,
    },
    records: rows,
    byCp,
    bySite,
    byFamily,
    bySubfamily,
    familyLegend,
    byWaste,
    byUser,
    flows,
    locations: data.capture?.locations || [],
    cpGeojson: captureGeojson || { type: "FeatureCollection", features: [] },
  };
}

function syncGlobalFilterUi(rows) {
  document.querySelector("#global-site").value = globalFilters.site;
  document.querySelector("#global-base").value = globalFilters.base;
  document.querySelector("#global-route").value = globalFilters.route;
  document.querySelector("#global-vehicle").value = globalFilters.vehicle;
  document.querySelector("#global-driver").value = globalFilters.driver;
  document.querySelector("#compare-mode").value = compareMode;
  renderWasteButtons();
  renderCalendar();
  renderFilterChips();
  updateFilterUrl();
  const kg = sum(rows, "kg");
  const selectedWastes = globalFilters.wastes.size;
  const active = [
    globalFilters.base && `Base: ${globalFilters.base}`,
    globalFilters.route && `Ruta: ${shortLabel(globalFilters.route, 26)}`,
    globalFilters.site && `Garbigune: ${globalFilters.site}`,
    selectedWastes !== globalFilters.allWastes.length && `Residuos: ${selectedWastes}/${globalFilters.allWastes.length}`,
    globalFilters.vehicle && `Vehículo: ${globalFilters.vehicle}`,
    globalFilters.driver && `Conductor: ${globalFilters.driver}`,
  ].filter(Boolean);
  document.querySelector("#global-filter-summary").textContent =
    `${number(rows.length)} serv. salida · ${number(kg / 1000, 1)} t salida` + (active.length ? ` · ${active.join(" · ")}` : " · Todos los datos");
}

function clearFilter(key, value = "") {
  if (key === "date") {
    globalFilters.from = globalFilters.minDate;
    globalFilters.to = globalFilters.maxDate;
  } else if (key === "waste") {
    if (value) globalFilters.wastes.delete(value);
    else globalFilters.wastes = new Set(globalFilters.allWastes);
  } else {
    globalFilters[key] = "";
  }
  applyGlobalFilters();
}

function renderFilterChips() {
  const root = document.querySelector("#active-filter-chips");
  root.innerHTML = "";
  const chips = [];
  if (globalFilters.from !== globalFilters.minDate || globalFilters.to !== globalFilters.maxDate) chips.push(["date", `Fechas: ${globalFilters.from} · ${globalFilters.to}`]);
  if (globalFilters.base) chips.push(["base", `Base: ${globalFilters.base}`]);
  if (globalFilters.route) chips.push(["route", `Ruta: ${shortLabel(globalFilters.route, 40)}`]);
  if (globalFilters.site) chips.push(["site", `Garbigune: ${globalFilters.site}`]);
  if (globalFilters.vehicle) chips.push(["vehicle", `Vehículo: ${globalFilters.vehicle}`]);
  if (globalFilters.driver) chips.push(["driver", `Conductor: ${globalFilters.driver}`]);
  if (globalFilters.wastes.size !== globalFilters.allWastes.length) chips.push(["waste", `Residuos: ${globalFilters.wastes.size}/${globalFilters.allWastes.length}`]);
  if (!chips.length) chips.push(["", "Todos los datos"]);
  chips.forEach(([key, label]) => {
    const chip = el("span", { class: "filter-chip" }, [document.createTextNode(label)]);
    if (key) {
      const button = el("button", { type: "button", text: "×", title: "Quitar filtro" });
      button.addEventListener("click", () => clearFilter(key));
      chip.append(button);
    }
    root.append(chip);
  });
}

function resetMonthlyControls() {
  document.querySelector('[data-chart-for="#monthly-chart"]')?.remove();
}

function renderDashboard() {
  renderPanelSummaries();
  renderKpis();
  renderExecutiveConclusions();
  renderTabConclusions();
  resetMonthlyControls();
  renderCharts();
  renderComparatives();
  renderDiagnostics();
  renderQualityNotes();
  renderSites();
  renderCapture();
  renderFleet();
  renderDrivers();
  renderResources();
  renderNotes();
}

function applyGlobalFilters() {
  const rows = filteredPesadas();
  const benchmarkRows = globalFilters.driver ? filteredPesadas({ ignore: "driver" }) : rows;
  view = aggregatePesadas(rows, benchmarkRows);
  syncGlobalFilterUi(rows);
  renderDashboard();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

function executiveAlerts() {
  const alerts = [];
  const rows = filteredPesadas();
  const totalTons = view.kpis.tons || 0;
  const topSite = view.summary.topSites[0];
  const topWaste = view.summary.topWaste[0];
  const topRoute = view.sitesWaste.routes?.[0];
  const monthly = view.comparatives?.monthly || {};
  const outlierCount = view.comparatives?.counts?.outliers || 0;
  const noRouteRows = rows.filter((row) => row.route === "SIN RUTA");
  const noRouteShare = rows.length ? (noRouteRows.length / rows.length) * 100 : 0;
  const fleetRisk = view.fleet.vehicles
    .filter((row) => row.trips >= 20 && row.incidents > 0)
    .sort((a, b) => b.incidents_per_1000_trips - a.incidents_per_1000_trips)[0];
  const lowDriver = view.drivers.drivers
    .filter((row) => row.work_days >= driverMinDays && row.normalized_score)
    .sort((a, b) => a.normalized_score - b.normalized_score)[0];

  if (!rows.length) {
    return [
      {
        severity: "critical",
        title: "Sin actividad en el filtro",
        metric: "0 servicios salida",
        body: "El filtro activo no devuelve pesadas, por lo que los rankings y ratios no son interpretables.",
        action: "Ampliar fechas o retirar filtros hasta recuperar una muestra operativa.",
      },
    ];
  }

  if (topWaste?.share >= 40) {
    alerts.push({
      severity: "warning",
      title: "Alta dependencia de una fracción",
      metric: `${topWaste.waste} · ${number(topWaste.share, 1)}%`,
      body: `${topWaste.waste} concentra una parte muy alta del peso de salidas filtrado; puede dominar kg/servicio, rutas y score de conductores.`,
      action: "Revisar la planificación por residuo y comparar eficiencia excluyendo esta fracción para no sesgar decisiones.",
    });
  }

  if (topSite && totalTons && (topSite.tons / totalTons) * 100 >= 15) {
    alerts.push({
      severity: "warning",
      title: "Carga concentrada en un garbigune",
      metric: `${topSite.site} · ${number((topSite.tons / totalTons) * 100, 1)}%`,
      body: `${topSite.site} concentra ${number(topSite.tons, 1)} t y puede estar marcando la presión operativa del periodo.`,
      action: "Contrastar frecuencia, mix de residuos y ruta asociada para decidir si requiere refuerzo o ajuste de calendario.",
    });
  }

  if (topRoute && totalTons && (topRoute.tons / totalTons) * 100 >= 20) {
    alerts.push({
      severity: "info",
      title: "Ruta dominante",
      metric: `${shortLabel(topRoute.route, 28)} · ${number((topRoute.tons / totalTons) * 100, 1)}%`,
      body: `La ruta principal concentra ${number(topRoute.tons, 1)} t de salida y ${number(topRoute.trips)} servicios de salida.`,
      action: "Usar el filtro de ruta para revisar garbigunes, residuos y vehículos que explican esa carga.",
    });
  }

  if (monthly.momTons !== null && monthly.momTons !== undefined && Math.abs(monthly.momTons) >= 20) {
    alerts.push({
      severity: monthly.momTons > 0 ? "warning" : "info",
      title: monthly.momTons > 0 ? "Repunte mensual de carga" : "Descenso mensual de carga",
      metric: `MoM ${trend(monthly.momTons)}`,
      body: `El último mes disponible cambia ${trend(monthly.momTons)} en t salidas frente al mes anterior${monthly.isPartialMonth ? " usando días equivalentes" : ""}.`,
      action: "Comprobar si el cambio se explica por estacionalidad, residuos pesados, refuerzos o incidencias de flota.",
    });
  }

  if (fleetRisk && fleetRisk.incidents_per_1000_trips >= 20) {
    alerts.push({
      severity: "warning",
      title: "Vehículo con presión de incidencias",
      metric: `${fleetRisk.vehicle} · ${number(fleetRisk.incidents_per_1000_trips, 1)} inc./1000 serv.`,
      body: `${fleetRisk.vehicle} combina actividad operativa con una ratio alta de incidencias en el periodo filtrado.`,
      action: "Revisar subgrupos de avería, ruta observada y asignación para priorizar mantenimiento preventivo.",
    });
  }

  if (outlierCount >= 3) {
    alerts.push({
      severity: "warning",
      title: "Varios outliers operativos",
      metric: `${number(outlierCount)} detectados`,
      body: "El filtro activo contiene valores extremos en kg/servicio de salida, score de conductor o servicios de salida/día.",
      action: "Abrir la tabla de outliers y revisar primero los casos con mayor distancia al umbral IQR.",
    });
  } else if (outlierCount > 0) {
    alerts.push({
      severity: "info",
      title: "Outliers puntuales",
      metric: `${number(outlierCount)} detectado${outlierCount === 1 ? "" : "s"}`,
      body: "Hay algún valor extremo, pero no parece dominar el periodo filtrado.",
      action: "Validar si responde a una operativa excepcional o a un dato que conviene corregir.",
    });
  }

  if (lowDriver && lowDriver.normalized_score < 85) {
    alerts.push({
      severity: "info",
      title: "Conductor bajo referencia contextual",
      metric: `${lowDriver.driver} · ${number(lowDriver.normalized_score, 1)} pts`,
      body: "El score compara carga transportada y servicios de salida/día contra el contexto de ruta, garbigune y residuo.",
      action: "Revisar su perfil antes de concluir desempeño: rutas frecuentes, vehículo usado y número de días trabajados.",
    });
  }

  if (noRouteShare > 0) {
    alerts.push({
      severity: noRouteShare >= 1 ? "warning" : "info",
      title: "Pesadas pendientes de ruta",
      metric: `${number(noRouteRows.length)} serv. · ${number(noRouteShare, 1)}%`,
      body: "Hay registros no asignados a ruta, normalmente ubicaciones especiales o datos no estándar.",
      action: "Clasificar las localizaciones SIN RUTA si se quieren usar en análisis de productividad por base/ruta.",
    });
  }

  if (!alerts.length) {
    alerts.push({
      severity: "success",
      title: "Sin alertas prioritarias",
      metric: `${number(rows.length)} servicios salida`,
      body: "No se detectan concentraciones, outliers o problemas de calidad relevantes con el filtro activo.",
      action: "Mantener seguimiento periódico y revisar por ruta o residuo si se busca una lectura más específica.",
    });
  }

  const order = { critical: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 5);
}

function conclusionBadge(kind) {
  return READING_KIND_LABELS[kind] || "Lectura";
}

function executiveConclusions() {
  const rows = filteredPesadas();
  const totalTons = view.kpis.tons || 0;
  const monthly = view.comparatives?.monthly || {};
  const topSite = view.summary.topSites[0];
  const topWaste = view.summary.topWaste[0];
  const topRoute = view.sitesWaste.routes?.[0];
  const bestDriver = view.drivers.topByNormalizedEfficiency?.[0];
  const lowDriver = view.drivers.drivers
    .filter((row) => row.work_days >= driverMinDays && row.normalized_score)
    .sort((a, b) => a.normalized_score - b.normalized_score)[0];
  const fleetRisk = view.fleet.vehicles
    .filter((row) => row.trips >= 20 && row.incidents > 0)
    .sort((a, b) => b.incidents_per_1000_trips - a.incidents_per_1000_trips)[0];
  const noRouteRows = rows.filter((row) => row.route === "SIN RUTA");
  const conclusions = [];

  if (!rows.length) {
    return [
      {
        kind: "attention",
        title: "El filtro activo no tiene actividad",
        metric: "0 servicios de salida",
        body: "No hay pesadas para interpretar tendencias, rankings o eficiencia.",
        action: "Ampliar el periodo o retirar filtros hasta recuperar muestra operativa.",
      },
    ];
  }

  if (monthly.isPartialMonth) {
    conclusions.push({
      kind: "context",
      title: "La comparativa temporal usa días equivalentes",
      metric: `${monthly.currentFrom} · ${monthly.currentTo}`,
      body: `El último mes está incompleto; MoM y YoY se calculan contra ventanas equivalentes para evitar falsas caídas por corte de datos.`,
      action: `Leer MoM contra ${monthly.momWindow?.from || "s/d"} · ${monthly.momWindow?.to || "s/d"} y YoY contra ${monthly.yoyWindow?.from || "s/d"} · ${monthly.yoyWindow?.to || "s/d"}.`,
    });
  }

  if (topWaste) {
    conclusions.push({
      kind: topWaste.share >= 40 ? "attention" : "context",
      title: "El mix de residuos condiciona la operación",
      metric: `${topWaste.waste} · ${number(topWaste.share, 1)}%`,
      body: `${topWaste.waste} es la fracción dominante del peso de salida y puede explicar variaciones en kg/servicio, rutas y productividad.`,
      action: "Comparar el resumen con y sin esta fracción antes de tomar decisiones de eficiencia.",
    });
  }

  if (topSite && totalTons) {
    const siteShare = (topSite.tons / totalTons) * 100;
    conclusions.push({
      kind: siteShare >= 15 ? "attention" : "context",
      title: "La carga se concentra en pocos puntos",
      metric: `${topSite.site} · ${number(siteShare, 1)}%`,
      body: `${topSite.site} lidera las salidas transportadas con ${number(topSite.tons, 1)} t y ${number(topSite.trips)} servicios.`,
      action: "Revisar si el calendario, el vehículo asignado o la frecuencia de recogida están alineados con esa presión.",
    });
  }

  if (topRoute && totalTons) {
    conclusions.push({
      kind: "context",
      title: "La ruta principal explica una parte relevante del periodo",
      metric: `${shortLabel(topRoute.route, 32)} · conf. ${topRoute.confidence || "-"} (${number(topRoute.confidence_score || 0)}%)`,
      body: `La ruta concentra ${number(topRoute.tons, 1)} t de salida, ${number((topRoute.tons / totalTons) * 100, 1)}% del periodo y conecta ${number(topRoute.sites)} garbigunes.`,
      action: "Usar la matriz ruta x residuo o ruta x garbigune para identificar qué combinación mueve el volumen.",
    });
  }

  if (fleetRisk) {
    conclusions.push({
      kind: fleetRisk.incidents_per_1000_trips >= 20 ? "attention" : "context",
      title: "Flota: vigilar vehículos con incidencias relativas",
      metric: `${fleetRisk.vehicle} · conf. ${fleetRisk.confidence || "-"} (${number(fleetRisk.confidence_score || 0)}%)`,
      body: `${fleetRisk.vehicle} combina actividad de salida e incidencias en el periodo filtrado.`,
      action: "Cruzar con subgrupos de avería y ruta observada antes de decidir mantenimiento preventivo.",
    });
  }

  if (bestDriver) {
    conclusions.push({
      kind: "opportunity",
      title: "Conductores: hay referencia operativa comparable",
      metric: `${bestDriver.driver} · conf. ${bestDriver.confidence || "-"} (${number(bestDriver.confidence_score || 0)}%)`,
      body: `El score ajustado compara carga y servicios de salida/día contra el contexto de ruta, garbigune y residuo.`,
      action: lowDriver ? `Contrastar con ${lowDriver.driver} antes de concluir desempeño individual; revisar perfil operativo y muestra.` : "Usar el perfil operativo para identificar prácticas replicables.",
    });
  }

  if (noRouteRows.length) {
    conclusions.push({
      kind: noRouteRows.length / rows.length >= 0.01 ? "quality" : "context",
      title: "Quedan salidas sin ruta asignada",
      metric: `${number(noRouteRows.length)} serv. · ${number((noRouteRows.length / rows.length) * 100, 1)}%`,
      body: "Los registros SIN RUTA pueden distorsionar análisis por base/ruta si crecen o se concentran en ubicaciones especiales.",
      action: "Clasificar las localizaciones pendientes cuando se usen rutas para decisiones de productividad.",
    });
  }

  if (!conclusions.some((item) => item.kind === "attention" || item.kind === "quality")) {
    conclusions.push({
      kind: "stable",
      title: "No se observan señales críticas en el filtro activo",
      metric: `${number(rows.length)} serv. salida`,
      body: "La lectura principal no muestra concentración extrema, presión de flota alta o problemas de calidad relevantes.",
      action: "Usar filtros de ruta, garbigune o residuo para buscar oportunidades de mejora más específicas.",
    });
  }

  const order = { attention: 0, opportunity: 1, quality: 2, context: 3, stable: 4 };
  return conclusions.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 5);
}

function renderExecutiveConclusions() {
  const root = document.querySelector("#executive-conclusions");
  if (!root) return;
  renderConclusionCards(root, executiveConclusions());
}

function renderConclusionCards(root, conclusions) {
  root.innerHTML = "";
  conclusions.forEach((item) => {
    root.append(
      el("article", { class: `executive-conclusion ${item.kind}` }, [
        el("div", { class: "conclusion-top" }, [
          el("span", { class: "conclusion-badge", text: conclusionBadge(item.kind) }),
          el("strong", { text: item.metric }),
        ]),
        el("h3", { text: item.title }),
        el("p", { text: item.body }),
        el("span", { class: "conclusion-action", text: item.action }),
      ]),
    );
  });
}

function renderTabConclusions() {
  const targets = {
    "#sites-conclusions": sitesConclusions(),
    "#capture-conclusions": captureConclusions(),
    "#fleet-conclusions": fleetConclusions(),
    "#drivers-conclusions": driversConclusions(),
    "#resources-conclusions": resourcesConclusions(),
  };
  Object.entries(targets).forEach(([selector, conclusions]) => {
    const root = document.querySelector(selector);
    if (root) renderConclusionCards(root, conclusions.slice(0, 5));
  });
}

function sitesConclusions() {
  const totalTons = view.kpis.tons || 0;
  const topSite = view.sitesWaste.sites?.[0];
  const topWaste = view.sitesWaste.waste?.[0];
  const topRoute = view.sitesWaste.routes?.[0];
  const topBase = view.sitesWaste.bases?.[0];
  const noRoute = (view.sitesWaste.routes || []).find((row) => row.route === "SIN RUTA");
  const conclusions = [];

  if (!totalTons) return emptyPanelConclusion("Sin salidas transportadas", "0 t", "No hay pesadas para construir matrices de garbigune, ruta o residuo.", "Ampliar el periodo o retirar filtros.");

  if (topSite) {
    const share = percentage(topSite.tons, totalTons);
    conclusions.push({
      kind: share >= 15 ? "attention" : "context",
      title: "Garbigune con mayor presión de salida",
      metric: `${topSite.site} · ${number(share, 1)}%`,
      body: `${topSite.site} lidera con ${number(topSite.tons, 1)} t y ${number(topSite.trips)} servicios de salida.`,
      action: "Usar la matriz configurable para ver qué residuo o ruta explica esa presión.",
    });
  }

  if (topWaste) {
    conclusions.push({
      kind: topWaste.share >= 40 ? "attention" : "context",
      title: "Residuo dominante en la pestaña",
      metric: `${topWaste.waste} · ${number(topWaste.share, 1)}%`,
      body: "La composición de residuos puede cambiar la lectura de kg/servicio y de productividad por punto.",
      action: "Comparar la matriz con filas por garbigune y columnas por residuo antes de ajustar frecuencias.",
    });
  }

  if (topRoute) {
    conclusions.push({
      kind: "opportunity",
      title: "Ruta principal para profundizar",
      metric: `${shortLabel(topRoute.route, 28)} · ${number(topRoute.tons, 1)} t`,
      body: `Conecta ${number(topRoute.sites)} garbigunes y registra ${number(topRoute.trips)} servicios de salida con confianza ${topRoute.confidence || "-"}.`,
      action: "Cambiar la matriz a ruta x garbigune o ruta x residuo para localizar combinaciones críticas.",
    });
  }

  if (topBase) {
    conclusions.push({
      kind: "context",
      title: "Base operativa de mayor volumen",
      metric: `${shortLabel(topBase.base, 28)} · ${number(topBase.tons, 1)} t`,
      body: `Agrupa ${number(topBase.sites)} garbigunes y ${number(topBase.routes)} rutas en el filtro activo.`,
      action: "Revisar si la base concentra residuos pesados o muchas salidas de baja carga.",
    });
  }

  if (noRoute?.trips) {
    conclusions.push({
      kind: noRoute.trips >= 20 ? "quality" : "context",
      title: "Registros pendientes de ruta",
      metric: `${number(noRoute.trips)} serv. SIN RUTA`,
      body: "Estos servicios pueden aparecer en matrices y rankings, pero no aportan lectura operativa por ruta.",
      action: "Priorizar su clasificación si el análisis se usará para rediseñar rutas.",
    });
  }

  return ensureMinimumConclusions(conclusions, `${number(view.kpis.sites)} garbigunes visibles`, "La pestaña permite leer concentración territorial, mix de residuos y estructura ruta/base.", "Cambiar filas y columnas de la matriz para validar la conclusión principal.");
}

function captureConclusions() {
  const meta = view.capture?.meta || {};
  const topCp = view.capture?.byCp?.[0];
  const topSite = view.capture?.bySite?.[0];
  const topFamily = view.capture?.byFamily?.[0];
  const priority = capturePriorityCases();
  const mapped = Number(data.capture?.meta?.mappedWasteTypes || 0);
  const unmapped = Number(data.capture?.meta?.unmappedWasteTypes || 0);
  const awBridge = selectedGlobalAwFamilies();
  const conclusions = [];

  if (!meta.filteredTons) return emptyPanelConclusion("Sin entradas AW en el filtro", "0 t entrada", "No hay registros AW para el filtro activo.", "Ampliar fechas o retirar filtros locales de Captación AW.");

  if (awBridge.active) {
    conclusions.push({
      kind: awBridge.families.size ? "context" : "quality",
      title: "Filtro global de residuos aplicado a AW",
      metric: awBridge.families.size ? `${number(awBridge.families.size)} familias AW` : "Sin equivalencia AW",
      body: awBridge.families.size
        ? `Captación AW queda restringida a: ${[...awBridge.families].sort((a, b) => a.localeCompare(b, "es")).join(", ")}.`
        : "Los residuos globales seleccionados no tienen equivalencia definida en familias AW.",
      action: awBridge.families.size ? "Usar los selectores locales AW solo para afinar dentro de esa equivalencia." : "Revisar la tabla de equivalencias si se quiere aplicar este filtro a AW.",
    });
  }

  if (topCp) {
    conclusions.push({
      kind: "context",
      title: "Código postal que más aporta",
      metric: `CP ${topCp.cp} · ${number(topCp.tons, 2)} t`,
      body: `${number(topCp.entries)} entradas hacia ${number(topCp.sites)} garbigunes; destino principal ${topCp.top_site || "-"}.`,
      action: "Clicar el CP en el mapa o filtrar por ese CP para revisar su composición y destinos.",
    });
  }

  if (topSite) {
    conclusions.push({
      kind: "opportunity",
      title: "Garbigune con mayor captación AW",
      metric: `${topSite.site} · ${number(topSite.tons, 1)} t`,
      body: `Recibe entradas desde ${number(topSite.cps)} CP y concentra ${number(percentage(topSite.kg, meta.filteredKg || 0), 1)}% del peso AW visible.`,
      action: "Comparar con el garbigune más cercano para separar captación natural de flujos revisables.",
    });
  }

  if (topFamily) {
    conclusions.push({
      kind: topFamily.share >= 40 ? "attention" : "context",
      title: "Familia AW dominante",
      metric: `${topFamily.family} · ${number(topFamily.share, 1)}%`,
      body: `${topFamily.top_waste || "El residuo principal"} explica buena parte de la composición de entrada.`,
      action: "Cambiar el nivel a subfamilia o residuo para evitar decisiones demasiado agregadas.",
    });
  }

  conclusions.push({
    kind: meta.reviewFlowCount ? "attention" : "stable",
    title: "Flujos CP → Garbigune a revisar",
    metric: `${number(meta.reviewFlowCount || 0)} flujos · ${number((meta.reviewKg || 0) / 1000, 2)} t`,
    body: `${number(meta.offNearestKgShare || 0, 1)}% del peso comparable no va al garbigune geográficamente más cercano.`,
    action: priority.length ? "Abrir casos prioritarios o exportar CSV para revisión operativa." : "Mantener seguimiento; no hay casos prioritarios con el filtro activo.",
  });

  conclusions.push({
    kind: unmapped ? "quality" : "stable",
    title: "Taxonomía AW completa",
    metric: `${number(mapped)} clasificados · ${number(unmapped)} pendientes`,
    body: "La lectura por familias/subfamilias ya evita que residuos relevantes caigan en SIN FAMILIA.",
    action: "Mantener actualizada la tabla editable si aparecen nuevos residuos en AW.",
  });

  return conclusions.slice(0, 5);
}

function fleetConclusions() {
  const vehicles = view.fleet.vehicles || [];
  const incidents = view.kpis.incidents || 0;
  const highRisk = vehicles.filter((row) => row.trips >= 20 && row.incidents > 0).sort((a, b) => b.incidents_per_1000_trips - a.incidents_per_1000_trips)[0];
  const topVehicle = vehicles[0];
  const topType = view.fleet.incidentTypes?.[0];
  const topSubgroup = view.fleet.incidentSubgroups?.[0];
  const topWorkshop = view.fleet.workshops?.[0];
  const latestTrend = [...(view.fleet.incidentTrend || [])].filter((row) => row.incidents || row.services).sort((a, b) => b.month.localeCompare(a.month))[0];
  const conclusions = [];

  if (!vehicles.length) return emptyPanelConclusion("Sin vehículos activos", "0 vehículos", "El filtro no contiene salidas con vehículo asociado.", "Ampliar periodo o retirar filtros de vehículo.");

  if (highRisk) {
    conclusions.push({
      kind: highRisk.incidents_per_1000_trips >= 20 ? "attention" : "context",
      title: "Vehículo con mayor presión relativa",
      metric: `${highRisk.vehicle} · ${number(highRisk.incidents_per_1000_trips, 1)} inc./1000 serv.`,
      body: `${number(highRisk.incidents)} incidencias sobre ${number(highRisk.trips)} servicios de salida; confianza ${highRisk.confidence || "-"}.`,
      action: "Cruzar con tipo de avería, taller y ruta observada antes de priorizar mantenimiento.",
    });
  }

  if (topVehicle) {
    conclusions.push({
      kind: "opportunity",
      title: "Vehículo de mayor actividad",
      metric: `${topVehicle.vehicle} · ${number(topVehicle.tons, 1)} t`,
      body: `Registra ${number(topVehicle.trips)} servicios y ${number(topVehicle.kg_per_trip)} kg/servicio de salida.`,
      action: "Comparar actividad con incidencias para distinguir uso intensivo de riesgo mecánico.",
    });
  }

  if (topType || topSubgroup) {
    conclusions.push({
      kind: incidents ? "context" : "stable",
      title: "Composición de averías",
      metric: topSubgroup ? `${topSubgroup.subgroup} · ${number(topSubgroup.count)}` : `${topType?.type || "-"} · ${number(topType?.count || 0)}`,
      body: incidents ? "La gráfica apilada permite distinguir si el patrón depende de subgrupos o de talleres." : "No hay incidencias en el filtro activo.",
      action: "Alternar Subgrupos/Talleres en Tipos de avería para identificar la causa más operativa.",
    });
  }

  if (latestTrend) {
    conclusions.push({
      kind: latestTrend.incidents_per_1000_services >= 20 ? "attention" : "context",
      title: "Último mes con señal de flota",
      metric: `${latestTrend.month} · ${number(latestTrend.incidents)} incid.`,
      body: `${number(latestTrend.incidents_per_1000_services, 1)} incidencias por 1000 servicios de salida.`,
      action: "Comprobar si coincide con repuntes de servicio, vehículos concretos o talleres recurrentes.",
    });
  }

  if (topWorkshop) {
    conclusions.push({
      kind: "context",
      title: "Taller con más intervenciones",
      metric: `${shortLabel(topWorkshop.workshop, 24)} · ${number(topWorkshop.count)}`,
      body: "Sirve para revisar concentración de resolución, no necesariamente peor desempeño.",
      action: "Cruzar con subgrupo de avería antes de comparar proveedores.",
    });
  }

  return ensureMinimumConclusions(conclusions, `${number(vehicles.length)} vehículos activos`, "La lectura de flota combina uso de salida e incidencias registradas.", "Usar ratios por 1000 servicios para evitar sesgos por actividad.");
}

function driversConclusions() {
  const comparable = view.drivers.comparableDrivers || [];
  const excluded = view.drivers.excludedDrivers || [];
  const best = view.drivers.topByNormalizedEfficiency?.[0];
  const topServices = view.drivers.topByServices?.[0];
  const topLoad = view.drivers.topByLoad?.[0];
  const stable = [...comparable].sort((a, b) => a.services_day_cv - b.services_day_cv)[0];
  const lowConfidence = (view.drivers.drivers || []).filter((row) => row.confidence_score < 50).length;
  const topCluster = view.drivers.clusters?.[0];
  const reviewCluster = (view.drivers.clusters || []).find((row) => row.key === "review");
  const conclusions = [];

  if (!view.drivers.drivers?.length) return emptyPanelConclusion("Sin conductores", "0 conductores", "No hay salidas con conductor en el filtro activo.", "Ampliar periodo o retirar filtro de conductor.");

  conclusions.push({
    kind: excluded.length ? "quality" : "stable",
    title: "Muestra comparable de conductores",
    metric: `${number(comparable.length)} comparables · ${number(excluded.length)} excluidos`,
    body: `El mínimo activo es ${number(driverMinDays)} días; los excluidos no deben usarse para conclusiones de productividad.`,
    action: "Cambiar el mínimo de días si se busca una lectura más inclusiva o más robusta.",
  });

  if (topCluster) {
    conclusions.push({
      kind: topCluster.key === "review" || topCluster.key === "low_sample" ? "quality" : "context",
      title: "Perfil operativo más frecuente",
      metric: `${topCluster.profile} · ${number(topCluster.drivers)} cond.`,
      body: `${number(topCluster.services)} servicios y ${number(topCluster.tons, 1)} t de salida dentro del filtro activo.`,
      action: topCluster.action,
    });
  }

  if (best) {
    conclusions.push({
      kind: "opportunity",
      title: "Referencia ajustada del periodo",
      metric: `${best.driver} · ${number(best.normalized_score, 1)} pts`,
      body: `Combina índice de carga ${number(best.adjusted_load_index, 1)} y ${number(best.services_per_day, 1)} servicios/día.`,
      action: "Revisar su ruta, residuo y vehículo principal para identificar prácticas replicables.",
    });
  }

  if (topServices) {
    conclusions.push({
      kind: "context",
      title: "Mayor actividad no equivale siempre a eficiencia",
      metric: `${topServices.driver} · ${number(topServices.total_services)} serv.`,
      body: `Trabaja ${number(topServices.work_days)} días y mueve ${number(topServices.kg_per_service)} kg/servicio.`,
      action: "Leerlo junto al scatter de servicios x días para separar volumen, frecuencia y estabilidad.",
    });
  }

  if (topLoad) {
    conclusions.push({
      kind: "context",
      title: "Perfil de carga más pesado",
      metric: `${topLoad.driver} · ${number(topLoad.tons, 1)} t`,
      body: `Residuo principal: ${shortLabel(topLoad.main_waste || "-", 28)}; ruta principal: ${shortLabel(topLoad.main_route || "-", 28)}.`,
      action: "Comparar kg/servicio con carga esperada para no premiar solo contextos más pesados.",
    });
  }

  if (stable) {
    conclusions.push({
      kind: "stable",
      title: "Conductor más estable",
      metric: `${stable.driver} · CV ${number(stable.services_day_cv, 1)}%`,
      body: "La estabilidad mide dispersión de servicios de salida/día; ayuda a detectar perfiles previsibles.",
      action: "Usar esta señal para planificación, no como ranking aislado de desempeño.",
    });
  }

  if (lowConfidence) {
    conclusions.push({
      kind: "quality",
      title: "Conductores con baja confianza",
      metric: `${number(lowConfidence)} perfiles`,
      body: "La confianza baja suele deberse a pocos días, pocos servicios o cobertura operativa estrecha.",
      action: "Evitar conclusiones individuales en perfiles con poca muestra.",
    });
  }

  if (reviewCluster?.drivers) {
    conclusions.push({
      kind: "attention",
      title: "Perfiles marcados para revisar",
      metric: `${number(reviewCluster.drivers)} conductores`,
      body: "El cluster Revisar agrupa señales de score bajo o carga ajustada baja frente al contexto.",
      action: "Revisar muestra, rutas, residuos y asignaciones antes de interpretarlo como desempeño individual.",
    });
  }

  return conclusions.slice(0, 5);
}

function resourcesConclusions() {
  const refPlace = view.resources.refuerzosByPlace?.[0];
  const refYearRows = view.resources.refuerzosByYear || [];
  const lastRefYear = [...refYearRows].sort((a, b) => String(b.year).localeCompare(String(a.year)))[0];
  const mobileTotal = sum(view.resources.mobileDestinations || [], "count");
  const topMobileDest = view.resources.mobileDestinations?.[0];
  const convenios = view.resources.convenios?.byStatus || [];
  const signed = convenios.find((row) => row.status === "Convenio firmado") || {};
  const qualityIssues = (data.quality?.checks || []).filter((row) => row.status !== "ok");
  const mobileMeta = view.resources.mobile?.meta || {};
  const conclusions = [];

  if (refPlace) {
    conclusions.push({
      kind: "context",
      title: "Centro con más refuerzos",
      metric: `${shortLabel(refPlace.place, 26)} · ${number(refPlace.count)}`,
      body: "Concentra la señal histórica de refuerzos y puede apuntar a presión de calendario o cobertura.",
      action: "Contrastar con salidas, incidencias y estacionalidad antes de redimensionar recursos.",
    });
  }

  if (lastRefYear) {
    conclusions.push({
      kind: "context",
      title: "Último año de refuerzos",
      metric: `${lastRefYear.year} · ${number(lastRefYear.count)} registros`,
      body: "La serie se muestra en orden cronológico para leer evolución, no ranking.",
      action: "Cambiar el sentido temporal solo para revisar años recientes primero.",
    });
  }

  conclusions.push({
    kind: mobileMeta.integrationMode === "movements_only" ? "quality" : "opportunity",
    title: "Garbigune móvil separado",
    metric: `${number(mobileTotal)} movimientos`,
    body: topMobileDest ? `Destino principal: ${topMobileDest.destination} con ${number(topMobileDest.count)} movimientos.` : "No hay movimientos móviles visibles.",
    action: mobileMeta.hasWeight && mobileMeta.hasWaste ? "Valorar integración futura con residuos si se confirma comparabilidad." : "Mantenerlo separado mientras no haya peso/residuo comparable.",
  });

  if (signed.municipalities !== undefined) {
    conclusions.push({
      kind: "context",
      title: "Cobertura municipal conveniada",
      metric: `${number(signed.municipalities || 0)} municipios firmados`,
      body: `${number(signed.population || 0)} habitantes asociados a convenios firmados según la fuente disponible.`,
      action: "Usar esta lectura como contexto territorial, no como medida de toneladas o servicios.",
    });
  }

  conclusions.push({
    kind: qualityIssues.length ? "quality" : "stable",
    title: "Calidad de datos automática",
    metric: qualityIssues.length ? `${number(qualityIssues.length)} checks a revisar` : "Checks OK",
    body: qualityIssues.length ? qualityIssues.map((row) => row.check).slice(0, 3).join(" · ") : "El reporte automático no detecta bloqueos críticos en las fuentes principales.",
    action: "Abrir la tabla de checks antes de usar el dashboard para decisiones operativas sensibles.",
  });

  return ensureMinimumConclusions(conclusions, "Recursos como contexto", "Esta pestaña mezcla capacidad, móvil, convenios y calidad; no todo es comparable con toneladas de salida.", "Mantener separadas las taxonomías para evitar sumar magnitudes distintas.");
}

function emptyPanelConclusion(title, metric, body, action) {
  return [{ kind: "attention", title, metric, body, action }];
}

function ensureMinimumConclusions(conclusions, metric, body, action) {
  if (conclusions.length >= 3) return conclusions.slice(0, 5);
  return [
    ...conclusions,
    {
      kind: "stable",
      title: "Lectura de apoyo",
      metric,
      body,
      action,
    },
  ].slice(0, 5);
}

function renderPanelSummaries() {
  const topSite = view.summary.topSites[0] || { site: "-", tons: 0 };
  const topWaste = view.summary.topWaste[0] || { waste: "-", share: 0 };
  const topVehicle = view.fleet.vehicles[0] || { vehicle: "-", tons: 0 };
  const topDriver = view.drivers.drivers[0] || { driver: "-", total_services: 0, services_per_day: 0, kg_per_service: 0 };
  const topEffDriver = view.drivers.topByNormalizedEfficiency?.[0] || topDriver;
  const topRefPlace = view.resources.refuerzosByPlace[0] || { place: "-", count: 0 };
  const mobileMovements = sum(view.resources.mobileDestinations || [], "count");
  const topRoute = view.sitesWaste.routes?.[0] || { route: "-", tons: 0 };
  const convenios = view.resources.convenios?.byStatus || [];
  const captureMeta = view.capture?.meta || {};
  const topCaptureCp = view.capture?.byCp?.[0] || { cp: "-", tons: 0 };
  const topCaptureSite = view.capture?.bySite?.[0] || { site: "-", tons: 0 };
  const signedConvenios = convenios.find((row) => row.status === "Convenio firmado") || { municipalities: 0, population: 0 };
  const alertRows = executiveAlerts();
  const priorityAlerts = alertRows.filter((row) => ["critical", "warning"].includes(row.severity)).length;
  const monthly = view.comparatives?.monthly || {};
  const cards = {
    "#summary-panel-summary": [
      ["Salidas periodo", `${data.coverage.pesadasFrom} · ${data.coverage.pesadasTo}`],
      ["T salidas", `${number(view.kpis.tons, 1)} t`],
      [monthly.isPartialMonth ? "MoM / YoY parcial" : "MoM / YoY", `${trend(monthly.momTons)} · ${trend(monthly.yoyTons)}`],
      ["Alertas", priorityAlerts ? `${number(priorityAlerts)} prioritarias` : "Sin críticas"],
    ],
    "#sites-panel-summary": [
      ["Garbigunes salida", number(view.kpis.sites)],
      ["Centro salida líder", `${topSite.site} · ${number(topSite.tons, 1)} t`],
      ["Rutas", `${number(view.kpis.routes)} · ${shortLabel(topRoute.route, 24)}`],
      ["Residuo salida líder", `${shortLabel(topWaste.waste, 22)} · ${number(topWaste.share, 1)}%`],
    ],
    "#capture-panel-summary": [
      ["T entradas AW", `${number(captureMeta.filteredTons || 0, 1)} t`],
      ["Entradas AW", number(captureMeta.filteredEntries || 0)],
      ["CP origen líder", `${topCaptureCp.cp} · ${number(topCaptureCp.tons || 0, 1)} t`],
      ["Destino AW líder", `${topCaptureSite.site} · ${number(topCaptureSite.tons || 0, 1)} t`],
    ],
    "#fleet-panel-summary": [
      ["Vehículos activos", number(view.kpis.activeVehicles)],
      ["Mayor carga", `${topVehicle.vehicle} · ${number(topVehicle.tons, 1)} t`],
      ["Incidencias", `${number(view.kpis.incidents)} · filtro activo`],
      ["Flota", `catálogo ${data.coverage.flotaAsOf}`],
    ],
    "#drivers-panel-summary": [
      ["Conductores", number(view.kpis.drivers)],
      ["Más servicios salida", `${topDriver.driver} · ${number(topDriver.total_services)} serv.`],
      ["Mejor score", `${topEffDriver.driver} · ${number(topEffDriver.normalized_score || 0, 1)} pts`],
      ["Carga ajustada", `${number(topEffDriver.adjusted_load_index || 0, 1)} sobre 100`],
    ],
    "#resources-panel-summary": [
      ["Recursos refuerzo", number(view.kpis.refuerzos)],
      ["Lugar refuerzo", `${shortLabel(topRefPlace.place, 28)} · ${number(topRefPlace.count)}`],
      ["Movimientos móvil", number(mobileMovements)],
      ["Recursos convenio", `${number(signedConvenios.municipalities)} firmados`],
    ],
  };

  Object.entries(cards).forEach(([target, items]) => {
    const root = document.querySelector(target);
    if (!root) return;
    root.innerHTML = "";
    items.forEach(([label, value]) => {
      root.append(el("div", { class: "summary-chip" }, [el("span", { text: label }), el("strong", { text: value })]));
    });
  });
}

function getComparable(row, column) {
  const value = column.get ? column.get(row) : row[column.key];
  if (column.num) return Number(value) || 0;
  return String(value ?? "").toLocaleLowerCase("es-ES");
}

function rowMatches(row, columns, query) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase("es-ES");
  return columns.some((column) => String(column.get ? column.get(row) : row[column.key] ?? "").toLocaleLowerCase("es-ES").includes(normalized));
}

function ensureTableControls(target, columns, rows) {
  const table = document.querySelector(target);
  const wrap = table.closest(".table-wrap");
  if (!wrap || wrap.previousElementSibling?.dataset?.controlsFor === target) return;

  const controls = el("div", { class: "controls", "data-controls-for": target }, [
    el("label", { class: "control" }, [
      el("span", { text: "Filtrar" }),
      el("input", { type: "search", placeholder: "Buscar en la tabla", "data-role": "table-search" }),
    ]),
    el("label", { class: "control small" }, [
      el("span", { text: "Filas" }),
      el("select", { "data-role": "table-limit" }, [
        el("option", { value: "10", text: "10" }),
        el("option", { value: "25", text: "25" }),
        el("option", { value: "50", text: "50" }),
        el("option", { value: "all", text: "Todas" }),
      ]),
    ]),
    el("button", { class: "reset-button", type: "button", text: "Restablecer" }),
    el("button", { class: "export-button", type: "button", text: "Exportar CSV" }),
    el("div", { class: "control-summary", text: `${rows.length} registros` }),
  ]);

  controls.querySelector('[data-role="table-search"]').addEventListener("input", (event) => {
    tableStates[target].query = event.target.value;
    renderTable(target, tableStates[target].columns, tableStates[target].rows, tableStates[target].options);
  });
  controls.querySelector('[data-role="table-limit"]').addEventListener("change", (event) => {
    tableStates[target].limit = event.target.value;
    renderTable(target, tableStates[target].columns, tableStates[target].rows, tableStates[target].options);
  });
  controls.querySelector(".reset-button").addEventListener("click", () => {
    tableStates[target] = {
      query: "",
      limit: tableStates[target].options.limit || "25",
      sortKey: tableStates[target].options.sortKey || tableStates[target].columns.find((column) => column.num)?.key || tableStates[target].columns[0]?.key,
      sortDir: tableStates[target].options.sortDir || "desc",
      options: tableStates[target].options,
      columns: tableStates[target].columns,
      rows: tableStates[target].rows,
    };
    renderTable(target, tableStates[target].columns, tableStates[target].rows, tableStates[target].options);
  });
  controls.querySelector(".export-button").addEventListener("click", () => {
    const state = tableStates[target];
    downloadCsv(`${target.replace("#", "")}.csv`, state.columns, state.visibleRows || []);
  });

  wrap.before(controls);
}

function renderKpis() {
  const kpis = [
    ["T salidas", number(view.kpis.tons, 1), "Salidas transportadas en báscula"],
    ["Servicios salida", number(view.kpis.trips), "Registros de báscula"],
    ["Kg/serv. salida", number(view.kpis.kgPerTrip), "Media operativa"],
    ["Vehículos activos", number(view.kpis.activeVehicles), `${view.kpis.drivers} conductores`],
    ["Rutas salida", number(view.kpis.routes), `${view.kpis.bases} bases · ${view.kpis.incidents} incidencias`],
  ];

  const root = document.querySelector("#summary-kpis");
  root.innerHTML = "";
  kpis.forEach(([label, value, sub]) => {
    root.append(
      el("article", { class: "kpi" }, [
        el("div", { class: "label", text: label }),
        el("div", { class: "value", text: value }),
        el("div", { class: "sub", text: sub }),
      ]),
    );
  });
}

function svg(width, height, content, className = "") {
  return `<svg class="svg-chart${className ? ` ${className}` : ""}" viewBox="0 0 ${width} ${height}" role="img">${content}</svg>`;
}

function emptyChart(width, height, message, className = "") {
  return svg(width, height, `<text class="axis-label empty-chart" x="0" y="34">${esc(message)}</text>`, className);
}

function barChart(target, rows, opts) {
  const width = opts.width || CHART_THEME.bar.width;
  const rowHeight = opts.rowHeight || CHART_THEME.bar.rowHeight;
  const barHeight = opts.barHeight || CHART_THEME.bar.barHeight;
  const labelMax = opts.labelMax || 26;
  const valueReserve = opts.valueReserve || CHART_THEME.bar.right;
  const left = Math.min(opts.left || CHART_THEME.bar.left, Math.round(width * 0.38));
  const margin = { top: CHART_THEME.bar.top, right: valueReserve, bottom: CHART_THEME.bar.bottom, left };
  const height = margin.top + margin.bottom + Math.max(rows.length, 1) * rowHeight;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const scale = (width - margin.left - margin.right) / max;

  if (!rows.length) {
    document.querySelector(target).innerHTML = emptyChart(width, Math.max(height, 92), "Sin resultados para el filtro seleccionado", "chart--bar");
    return;
  }

  const content = rows
    .map((row, index) => {
      const y = margin.top + index * rowHeight;
      const barWidth = Math.max(row.value * scale, row.value ? 4 : 0);
      const color = COLORS[index % COLORS.length];
      const safeLabel = esc(row.label);
      const safeDisplay = esc(row.display || number(row.value));
      const valueX = Math.min(margin.left + barWidth + 10, width - margin.right + 10);
      return `
        <text class="bar-label" x="0" y="${y + 23}">${shortLabel(row.label, labelMax)}</text>
        <rect class="chart-bar" data-label="${safeLabel}" data-value="${row.value}" data-display="${safeDisplay}" x="${margin.left}" y="${y + 8}" width="${barWidth}" height="${barHeight}" rx="5" fill="${color}"></rect>
        <text class="bar-value" x="${valueX}" y="${y + 24}">${safeDisplay}</text>
      `;
    })
    .join("");

  document.querySelector(target).innerHTML = svg(width, height, content, "chart--bar");
  bindChartInteractions(target, opts);
}

function applyChartFilter(filterKey, label) {
  if (!filterKey || !label) return;
  if (filterKey === "waste") globalFilters.wastes = new Set([label]);
  else if (filterKey in globalFilters) globalFilters[filterKey] = label;
  applyGlobalFilters();
}

function bindChartInteractions(target, opts) {
  const tooltip = document.querySelector("#chart-tooltip");
  document.querySelectorAll(`${target} .chart-bar, ${target} .chart-point`).forEach((item) => {
    item.addEventListener("mousemove", (event) => {
      tooltip.hidden = false;
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY + 12}px`;
      tooltip.innerHTML = `<strong>${item.dataset.label}</strong><span>${item.dataset.display}</span>${opts.filterKey ? "<br><span>Clic para filtrar</span>" : ""}`;
    });
    item.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
    item.addEventListener("click", () => applyChartFilter(opts.filterKey, item.dataset.label));
  });
}

function percentileValue(values, percentile) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const index = Math.min(nums.length - 1, Math.max(0, Math.round((nums.length - 1) * percentile)));
  return nums[index];
}

function scatterPlot(target, rows, config) {
  const root = document.querySelector(target);
  if (!root) return;
  const points = rows
    .map((row) => ({
      row,
      label: row[config.labelKey],
      x: Number(row[config.xKey]) || 0,
      y: Number(row[config.yKey]) || 0,
      size: Number(row[config.sizeKey]) || 0,
      colorValue: Number(row[config.colorKey]) || 0,
      color: config.colorAccessor ? config.colorAccessor(row) : "",
    }))
    .filter((point) => point.label && Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!points.length) {
    root.innerHTML = emptyChart(CHART_THEME.scatter.width, 120, "Sin conductores para el filtro seleccionado", "chart--scatter");
    return;
  }
  const { width, height, margin } = CHART_THEME.scatter;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  const maxSize = Math.max(...points.map((point) => point.size), 1);
  const medianX = percentileValue(points.map((point) => point.x), 0.5);
  const medianY = percentileValue(points.map((point) => point.y), 0.5);
  const xScale = (value) => margin.left + (value / maxX) * innerW;
  const yScale = (value) => margin.top + innerH - (value / maxY) * innerH;
  const grid = CHART_THEME.ticks
    .map((tick) => {
      const x = margin.left + tick * innerW;
      const y = margin.top + innerH - tick * innerH;
      return `<line class="chart-grid" x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerH}"></line>
        <line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${margin.left + innerW}" y2="${y}"></line>
        <text class="axis-label scatter-axis-label" x="${x}" y="${height - 50}" text-anchor="middle">${number(maxX * tick, config.xDecimals || 0)}</text>
        <text class="axis-label scatter-axis-label" x="${margin.left - 12}" y="${y + 5}" text-anchor="end">${number(maxY * tick, config.yDecimals || 0)}</text>`;
    })
    .join("");
  const medianLines = `<line class="chart-reference-line" x1="${xScale(medianX)}" y1="${margin.top}" x2="${xScale(medianX)}" y2="${margin.top + innerH}"></line>
    <line class="chart-reference-line" x1="${margin.left}" y1="${yScale(medianY)}" x2="${margin.left + innerW}" y2="${yScale(medianY)}"></line>`;
  const circles = points
    .map((point) => {
      const row = point.row;
      const x = xScale(point.x);
      const y = yScale(point.y);
      const radius = 5 + Math.sqrt(point.size / maxSize) * 11;
      const color = point.color || (point.colorValue >= 75 ? "#147d64" : point.colorValue >= 45 ? "#c67b24" : "#b8463f");
      const display = esc(config.display(row));
      const label = esc(point.label);
      return `<circle class="chart-point" data-label="${label}" data-display="${display}" cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity="0.78" stroke="white" stroke-width="2"></circle>`;
    })
    .join("");
  const legendX = margin.left;
  const legendY = 48;
  const legendSource = config.legend || [
    { label: "Alto", color: "#147d64" },
    { label: "Medio", color: "#c67b24" },
    { label: "Bajo", color: "#b8463f" },
  ];
  const legendColumns = legendSource.length > 4 ? 4 : legendSource.length;
  const legendStep = legendSource.length > 4 ? 148 : 108;
  const legendItems = legendSource
    .map((item, index) => {
      const x = legendX + (index % legendColumns) * legendStep;
      const y = legendY + Math.floor(index / legendColumns) * 20;
      return `<circle cx="${x}" cy="${legendY}" r="6" fill="${item.color}" fill-opacity="0.82" stroke="white" stroke-width="2"></circle>
        <text class="axis-label scatter-legend-label" x="${x + 12}" y="${y + 5}">${esc(item.label)}</text>`.replace(`cy="${legendY}"`, `cy="${y}"`);
    })
    .join("");
  const sizeLegendX = width - 220;
  const sizeLegendY = legendSource.length > 4 ? 88 : legendY;
  const sizeLegend = `<circle cx="${sizeLegendX}" cy="${sizeLegendY}" r="5" fill="#5b7480" fill-opacity="0.46" stroke="white" stroke-width="2"></circle>
    <circle cx="${sizeLegendX + 34}" cy="${sizeLegendY}" r="11" fill="#5b7480" fill-opacity="0.46" stroke="white" stroke-width="2"></circle>
    <text class="axis-label scatter-legend-label" x="${sizeLegendX + 54}" y="${sizeLegendY + 5}">Tamaño: t salidas</text>`;
  root.innerHTML = svg(
    width,
    height,
    `${grid}${medianLines}${circles}
    <text class="axis-title scatter-axis-title" x="${margin.left + innerW / 2}" y="${height - 16}" text-anchor="middle">${config.xLabel}</text>
    <text class="axis-title scatter-axis-title" x="24" y="${margin.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 24 ${margin.top + innerH / 2})">${config.yLabel}</text>
    <text class="line-label scatter-note" x="${margin.left}" y="18">${esc(config.note)}</text>
    ${legendItems}${sizeLegend}`,
    "chart--scatter",
  );
  bindChartInteractions(target, { filterKey: config.filterKey });
}

function bindMonthlyLegend() {
  document.querySelectorAll("#monthly-chart .legend-toggle").forEach((item) => {
    item.addEventListener("click", () => {
      const waste = item.dataset.waste;
      if (!waste || waste === "OTROS") return;
      if (globalFilters.wastes.has(waste)) globalFilters.wastes.delete(waste);
      else globalFilters.wastes.add(waste);
      applyGlobalFilters();
    });
  });
}

function wasteKeysByVolume() {
  const contextRows = filteredPesadas({ ignore: "waste" });
  const totals = new Map();
  contextRows.forEach((row) => {
    totals.set(row.waste, (totals.get(row.waste) || 0) + (Number(row.kg) || 0));
  });
  return [...(globalFilters.allWastes || [])].sort((a, b) => {
    const delta = (totals.get(b) || 0) - (totals.get(a) || 0);
    return delta || a.localeCompare(b, "es");
  });
}

function comboMonthlyChart() {
  const allRows = view.summary.byMonth;
  if (!allRows.length) {
    document.querySelector("#monthly-chart").innerHTML = emptyChart(CHART_THEME.monthly.width, 90, "Sin resultados para el filtro global seleccionado", "chart--timeline chart--stacked");
    return;
  }
  const rows = allRows;
  const wasteByMonth = new Map((view.summary.byMonthWaste || []).map((row) => [row.month, row]));
  const wasteKeys = wasteKeysByVolume();
  const width = CHART_THEME.monthly.width;
  const legendRows = Math.ceil(wasteKeys.length / 3);
  const height = 410 + legendRows * 20;
  const margin = { top: CHART_THEME.monthly.top, right: CHART_THEME.monthly.right, bottom: CHART_THEME.monthly.bottom + legendRows * 20, left: CHART_THEME.monthly.left };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxTons = Math.max(...rows.map((row) => row.tons), 1);
  const maxTrips = Math.max(...rows.map((row) => row.trips), 1);
  const barW = innerW / rows.length;

  const bars = rows
    .map((row, index) => {
      const x = margin.left + index * barW + 2;
      let yCursor = margin.top + innerH;
      const monthWaste = wasteByMonth.get(row.month) || {};
      const segments = wasteKeys.map((waste) => ({ waste, tons: Number(monthWaste[waste]) || 0 })).filter((segment) => segment.tons > 0);
      const rects = segments.map((segment, segmentIndex) => {
        const h = (segment.tons / maxTons) * innerH;
        yCursor -= h;
        const color = COLORS[wasteKeys.indexOf(segment.waste) % COLORS.length];
        const safeLabel = `${row.month} · ${segment.waste}`.replace(/"/g, "&quot;");
        const display = `${number(segment.tons, 1)} t · ${number((segment.tons / row.tons) * 100, 1)}%`;
        return `<rect class="chart-bar" data-label="${safeLabel}" data-display="${display}" x="${x}" y="${yCursor}" width="${Math.max(barW - 5, 3)}" height="${Math.max(h, 0.8)}" rx="2" fill="${color}"></rect>`;
      }).join("");
      const labelY = margin.top + innerH + 18;
      const label = `<text class="axis-label month-label" x="${x + Math.max(barW - 5, 3) / 2}" y="${labelY}" text-anchor="end" transform="rotate(-90 ${x + Math.max(barW - 5, 3) / 2} ${labelY})">${row.month}</text>`;
      return `${rects}${label}`;
    })
    .join("");

  const pointRows = rows.map((row, index) => {
    const x = margin.left + index * barW + barW / 2;
    const y = margin.top + innerH - (row.trips / maxTrips) * innerH;
    return { ...row, x, y };
  });
  const points = pointRows
    .map((row, index) => {
      return `${row.x},${row.y}`;
    })
    .join(" ");
  const pointMarkers = pointRows
    .map((row) => `<circle class="chart-point" data-label="${row.month}" data-display="${number(row.trips)} servicios salida · ${number(row.tons, 1)} t salida · ${number(row.kg_per_trip)} kg/serv." cx="${row.x}" cy="${row.y}" r="4.5" fill="#246fb2" stroke="white" stroke-width="2"></circle>`)
    .join("");

  const grid = CHART_THEME.ticks
    .map((tick) => {
      const y = margin.top + innerH - tick * innerH;
      return `<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
        <text class="axis-label" x="6" y="${y + 4}">${number(maxTons * tick, 0)} t</text>`;
    })
    .join("");
  const tripAxisX = width - margin.right + 16;
  const tripsAxis = CHART_THEME.ticks
    .map((tick) => {
      const y = margin.top + innerH - tick * innerH;
      return `<line x1="${tripAxisX - 5}" y1="${y}" x2="${tripAxisX}" y2="${y}" stroke="#246fb2"></line>
        <text class="axis-label trips-axis-label" x="${tripAxisX + 6}" y="${y + 4}">${number(maxTrips * tick)}</text>`;
    })
    .join("");
  const axes = `<line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerH}"></line>
    <line x1="${tripAxisX}" y1="${margin.top}" x2="${tripAxisX}" y2="${margin.top + innerH}" stroke="#246fb2"></line>
    <text class="axis-title" x="18" y="${margin.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 18 ${margin.top + innerH / 2})">T salidas</text>
    <text class="axis-title trips-axis-label" x="${width - 14}" y="${margin.top + innerH / 2}" text-anchor="middle" transform="rotate(90 ${width - 14} ${margin.top + innerH / 2})">Serv. salida</text>`;

  document.querySelector("#monthly-chart").innerHTML = svg(
    width,
    height,
    `${grid}${axes}${tripsAxis}${bars}<polyline points="${points}" fill="none" stroke="#246fb2" stroke-width="3"></polyline>${pointMarkers}
    <text class="line-label" x="${margin.left}" y="18">Barras: t salidas por residuo · Línea: servicios de salida</text>
    ${wasteKeys.map((waste, index) => {
      const x = margin.left + (index % 3) * 250;
      const y = height - 42 - (legendRows - 1 - Math.floor(index / 3)) * 20;
      const selected = globalFilters.wastes.has(waste);
      const color = COLORS[index % COLORS.length];
      return `<g class="legend-toggle${selected ? "" : " muted"}" data-waste="${waste}" role="button" tabindex="0">
        <rect x="${x}" y="${y - 11}" width="11" height="11" rx="2" fill="${selected ? color : "transparent"}" stroke="${color}" stroke-width="2"></rect>
        <text class="axis-label legend-label" x="${x + 16}" y="${y}">${esc(shortLabel(waste, 28))}</text>
      </g>`;
    }).join("")}`,
    "chart--timeline chart--stacked",
  );
  bindChartInteractions("#monthly-chart", {});
  bindMonthlyLegend();
}

function incidentTrendChart() {
  const target = document.querySelector("#incident-trend-chart");
  if (!target) return;
  const rows = view.fleet.incidentTrend || [];
  if (!rows.length) {
    target.innerHTML = emptyChart(CHART_THEME.timeline.width, 110, "Sin incidencias o servicios de salida para el filtro seleccionado", "chart--timeline");
    return;
  }

  const { width, height, margin } = CHART_THEME.timeline;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxIncidents = Math.max(...rows.map((row) => row.incidents), 1);
  const maxServices = Math.max(...rows.map((row) => row.services), 1);
  const barW = innerW / rows.length;

  const grid = CHART_THEME.ticks
    .map((tick) => {
      const y = margin.top + innerH - tick * innerH;
      return `<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
        <text class="axis-label" x="8" y="${y + 5}">${number(maxIncidents * tick)}</text>`;
    })
    .join("");

  const bars = rows
    .map((row, index) => {
      const h = (row.incidents / maxIncidents) * innerH;
      const x = margin.left + index * barW + 3;
      const y = margin.top + innerH - h;
      const label = rows.length <= 18 || index % Math.ceil(rows.length / 12) === 0
        ? `<text class="axis-label" x="${x}" y="${height - 26}" transform="rotate(35 ${x} ${height - 26})">${row.month}</text>`
        : "";
      return `<rect class="chart-bar" data-label="${row.month}" data-display="${number(row.incidents)} incid. · ${number(row.services)} serv. · ${number(row.incidents_per_1000_services, 1)} inc./1000 serv." x="${x}" y="${y}" width="${Math.max(barW - 6, 3)}" height="${h}" rx="4" fill="#b8463f"></rect>${label}`;
    })
    .join("");

  const points = rows
    .map((row, index) => {
      const x = margin.left + index * barW + barW / 2;
      const y = margin.top + innerH - (row.services / maxServices) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  const last = rows[rows.length - 1];
  target.innerHTML = svg(
    width,
    height,
    `${grid}${bars}<polyline points="${points}" fill="none" stroke="#246fb2" stroke-width="3"></polyline>
    <text class="line-label" x="${margin.left}" y="18">Barras: incidencias · Línea: servicios de salida · Último ratio: ${number(last.incidents_per_1000_services, 1)} inc./1000 serv.</text>`,
    "chart--timeline",
  );
  bindChartInteractions("#incident-trend-chart", {});
}

function filteredIncidentRowsForChart() {
  const from = globalFilters.from <= globalFilters.to ? globalFilters.from : globalFilters.to;
  const to = globalFilters.from <= globalFilters.to ? globalFilters.to : globalFilters.from;
  const activeVehicleSet = new Set((view.fleet?.vehicles || []).map((row) => row.vehicle).filter(Boolean));
  return rawIncidencias.filter((row) => row.date >= from && row.date <= to && activeVehicleSet.has(row.plate));
}

function stackedIncidentTypesChart() {
  const target = document.querySelector("#incident-types-chart");
  if (!target) return;
  document.querySelectorAll("#incident-breakdown button").forEach((button) => button.classList.toggle("active", button.dataset.breakdown === incidentBreakdown));
  const breakdownKey = incidentBreakdown === "workshop" ? "workshop" : "subgroup";
  const breakdownLabel = incidentBreakdown === "workshop" ? "taller" : "subgrupo";
  const incidents = filteredIncidentRowsForChart();
  if (!incidents.length) {
    target.innerHTML = emptyChart(CHART_THEME.stackedCompact.width, 120, "Sin incidencias para el filtro seleccionado", "chart--stacked chart--stacked-compact");
    return;
  }
  const typeTotals = [...groupRows(incidents, "type")]
    .map(([type, rows]) => ({ type: type || "SIN TIPO", total: rows.length, rows }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const breakdownTotals = new Map();
  incidents.forEach((row) => {
    const label = row[breakdownKey] || "SIN DATO";
    breakdownTotals.set(label, (breakdownTotals.get(label) || 0) + 1);
  });
  const segmentKeys = [...breakdownTotals].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label]) => label);
  const rows = typeTotals.map((typeRow) => {
    const item = { type: typeRow.type, total: typeRow.total };
    segmentKeys.forEach((key) => {
      item[key] = typeRow.rows.filter((row) => (row[breakdownKey] || "SIN DATO") === key).length;
    });
    const visible = segmentKeys.reduce((total, key) => total + item[key], 0);
    item.OTROS = Math.max(typeRow.total - visible, 0);
    return item;
  });
  const keys = [...segmentKeys, "OTROS"].filter((key) => rows.some((row) => row[key] > 0));
  const { width, height, margin } = CHART_THEME.stackedCompact;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  const barW = innerW / rows.length;
  const grid = CHART_THEME.ticks
    .map((tick) => {
      const y = margin.top + innerH - tick * innerH;
      return `<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
        <text class="axis-label" x="8" y="${y + 5}">${number(maxTotal * tick)}</text>`;
    })
    .join("");
  const bars = rows
    .map((row, index) => {
      const x = margin.left + index * barW + 5;
      let yCursor = margin.top + innerH;
      const rects = keys.map((key, keyIndex) => {
        const value = row[key] || 0;
        if (!value) return "";
        const h = (value / maxTotal) * innerH;
        yCursor -= h;
        const share = row.total ? (value / row.total) * 100 : 0;
        return `<rect class="chart-bar" data-label="${esc(row.type)} · ${esc(key)}" data-display="${number(value)} incidencias · ${number(share, 1)}% del tipo · ${breakdownLabel}" x="${x}" y="${yCursor}" width="${Math.max(barW - 10, 8)}" height="${Math.max(h, 1)}" rx="2" fill="${COLORS[keyIndex % COLORS.length]}"></rect>`;
      }).join("");
      const labelX = x + Math.max(barW - 10, 8) / 2;
      const label = `<text class="axis-label incident-x-label" x="${labelX}" y="${height - 18}" text-anchor="middle">${shortLabel(row.type, 10)}</text>`;
      return `${rects}${label}`;
    })
    .join("");
  const legend = keys
    .map((key, index) => {
      const x = margin.left + (index % 3) * 270;
      const y = 34 + Math.floor(index / 3) * 18;
      return `<rect x="${x}" y="${y - 10}" width="10" height="10" rx="2" fill="${COLORS[index % COLORS.length]}"></rect>
        <text class="axis-label incident-legend-label" x="${x + 15}" y="${y}">${esc(shortLabel(key, 25))}</text>`;
    })
    .join("");
  target.innerHTML = svg(
    width,
    height,
    `${legend}${grid}${bars}<text class="line-label incident-chart-note" x="${margin.left}" y="14">Apilado por ${breakdownLabel}</text>`,
    "chart--stacked chart--stacked-compact",
  );
  bindChartInteractions("#incident-types-chart", {});
}

function renderTable(target, columns, rows, options = {}) {
  tableStates[target] = tableStates[target] || {
    query: "",
    limit: options.limit || "25",
    sortKey: options.sortKey || columns.find((column) => column.num)?.key || columns[0]?.key,
    sortDir: options.sortDir || "desc",
    options,
  };
  tableStates[target].options = options;
  tableStates[target].columns = columns;
  tableStates[target].rows = rows;
  ensureTableControls(target, columns, rows);

  const table = document.querySelector(target);
  table.innerHTML = "";
  const thead = el("thead");
  const header = el("tr");
  columns.forEach((column) => {
    const sortable = column.sortable !== false;
    const active = tableStates[target].sortKey === column.key;
    const th = el("th", { class: `${column.num ? "num" : ""} ${sortable ? "sortable" : ""}`.trim() });
    const button = el("button", { type: "button", text: `${column.label}${active ? (tableStates[target].sortDir === "asc" ? " ↑" : " ↓") : ""}` });
    if (sortable) {
      button.addEventListener("click", () => {
        const state = tableStates[target];
        state.sortDir = state.sortKey === column.key && state.sortDir === "desc" ? "asc" : "desc";
        state.sortKey = column.key;
        renderTable(target, columns, rows, options);
      });
    } else {
      button.disabled = true;
    }
    th.append(button);
    header.append(th);
  });
  thead.append(header);

  const tbody = el("tbody");
  const state = tableStates[target];
  const sortColumn = columns.find((column) => column.key === state.sortKey) || columns[0];
  let visibleRows = rows.filter((row) => rowMatches(row, columns, state.query));
  visibleRows = visibleRows.sort((a, b) => {
    const left = getComparable(a, sortColumn);
    const right = getComparable(b, sortColumn);
    if (left === right) return 0;
    const result = left > right ? 1 : -1;
    return state.sortDir === "asc" ? result : -result;
  });
  const total = visibleRows.length;
  if (state.limit !== "all") visibleRows = visibleRows.slice(0, Number(state.limit));
  state.visibleRows = visibleRows;

  const controls = document.querySelector(`[data-controls-for="${target}"]`);
  if (controls) {
    controls.querySelector('[data-role="table-search"]').value = state.query;
    controls.querySelector('[data-role="table-limit"]').value = state.limit;
    controls.querySelector(".control-summary").textContent = `${visibleRows.length} de ${total} visibles`;
  }

  visibleRows.forEach((row) => {
    const tr = el("tr");
    columns.forEach((column) => {
      const raw = column.get ? column.get(row) : row[column.key];
      const value = column.format ? column.format(raw, row) : raw;
      tr.append(el("td", { class: column.num ? "num" : "", text: value ?? "" }));
    });
    tbody.append(tr);
  });
  if (!visibleRows.length) {
    const tr = el("tr");
    tr.append(el("td", { class: "empty-state", colspan: String(columns.length), text: "Sin resultados para el filtro seleccionado" }));
    tbody.append(tr);
  }

  table.append(thead, tbody);
}

function ensureChartControls(config) {
  const chart = document.querySelector(config.target);
  if (!chart || chart.previousElementSibling?.dataset?.chartFor === config.target) return;
  const state = chartStates[config.target];
  const isChronological = config.sortMode === "chronological";
  const metricButtons = el("div", { class: "segmented chart-metric-buttons", "data-role": "chart-metric" },
    config.metrics.map((metric) => el("button", { type: "button", "data-metric": metric.key, class: state.metric === metric.key ? "active" : "", text: metric.label })),
  );
  const controls = el("div", { class: "controls chart-controls", "data-chart-for": config.target }, [
    metricButtons,
    el("button", { class: "iconic-button", type: "button", "data-role": "chart-sort-toggle", title: "Invertir orden", text: isChronological ? (state.sort === "asc" ? "Antiguo → reciente" : "Reciente → antiguo") : state.sort === "asc" ? "Menor ↑" : "Mayor ↓" }),
    el("button", { class: "iconic-button", type: "button", "data-role": "chart-more", text: state.limit === "all" ? (isChronological ? "Ver menos" : "Ver top") : "Ver más" }),
  ]);

  controls.querySelectorAll("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric;
      drawInteractiveChart(chartConfigs[config.target]);
    });
  });
  controls.querySelector('[data-role="chart-sort-toggle"]').addEventListener("click", () => {
    state.sort = state.sort === "asc" ? "desc" : "asc";
    drawInteractiveChart(chartConfigs[config.target]);
  });
  controls.querySelector('[data-role="chart-more"]').addEventListener("click", () => {
    const currentConfig = chartConfigs[config.target];
    state.limit = state.limit === "all" ? String(currentConfig.defaultLimit || 8) : "all";
    drawInteractiveChart(currentConfig);
  });

  chart.before(controls);
}

function drawInteractiveChart(config) {
  const state = chartStates[config.target];
  const metric = config.metrics.find((item) => item.key === state.metric) || config.metrics[0];
  const query = state.query.toLocaleLowerCase("es-ES");
  let rows = config.rows
    .filter((row) => String(row[config.labelKey] ?? "").toLocaleLowerCase("es-ES").includes(query))
    .map((row) => ({
      label: row[config.labelKey],
      value: Number(row[metric.key]) || 0,
      display: metric.format ? metric.format(row[metric.key], row) : number(row[metric.key]),
    }));

  rows = rows.sort((a, b) => {
    if (config.sortMode === "chronological") {
      const result = String(a.label).localeCompare(String(b.label), "es");
      return state.sort === "asc" ? result : -result;
    }
    if (state.sort === "label") return String(a.label).localeCompare(String(b.label), "es");
    const result = a.value - b.value;
    return state.sort === "asc" ? result : -result;
  });
  if (state.limit !== "all") rows = rows.slice(0, Number(state.limit));
  barChart(config.target, rows, config);

  const controls = document.querySelector(`[data-chart-for="${config.target}"]`);
  if (controls) {
    controls.querySelectorAll("[data-metric]").forEach((button) => button.classList.toggle("active", button.dataset.metric === state.metric));
    controls.querySelector('[data-role="chart-sort-toggle"]').textContent = config.sortMode === "chronological" ? (state.sort === "asc" ? "Antiguo → reciente" : "Reciente → antiguo") : state.sort === "asc" ? "Menor ↑" : "Mayor ↓";
    controls.querySelector('[data-role="chart-more"]').textContent = state.limit === "all" ? (config.sortMode === "chronological" ? "Ver menos" : "Ver top") : "Ver más";
  }
}

function interactiveBarChart(config) {
  chartConfigs[config.target] = config;
  const signature = config.metrics.map((metric) => metric.key).join("|");
  const existingControls = document.querySelector(`[data-chart-for="${config.target}"]`);
  chartStates[config.target] = chartStates[config.target] || {
    query: "",
    metric: config.defaultMetric || config.metrics[0].key,
    sort: config.defaultSort || (config.sortMode === "chronological" ? "asc" : "desc"),
    limit: String(config.defaultLimit || 8),
  };
  if (chartStates[config.target].metricSignature && chartStates[config.target].metricSignature !== signature) {
    existingControls?.remove();
  }
  chartStates[config.target].metricSignature = signature;
  if (config.sortMode === "chronological" && !["asc", "desc"].includes(chartStates[config.target].sort)) {
    chartStates[config.target].sort = config.defaultSort || "asc";
  }
  if (!config.metrics.some((metric) => metric.key === chartStates[config.target].metric)) {
    chartStates[config.target].metric = config.defaultMetric || config.metrics[0].key;
  }
  ensureChartControls(config);
  drawInteractiveChart(config);
}

function renderMatrixTarget(target) {
  if (target === "#matrix-table") renderMatrix();
  else if (target === "#driver-waste-table") renderDriverWasteMatrix();
}

function buildConfigurableMatrix(rows, rowKey, colKey, rowLimit = 25, colLimit = 14) {
  const rowTotals = [...groupRows(rows, rowKey)]
    .map(([label, group]) => ({ label, kg: sum(group, "kg") }))
    .sort((a, b) => b.kg - a.kg);
  const colTotals = [...groupRows(rows, colKey)]
    .map(([label, group]) => ({ label, kg: sum(group, "kg") }))
    .sort((a, b) => b.kg - a.kg);
  const rowLabels = rowTotals.slice(0, rowLimit).map((row) => row.label);
  const colLabels = colTotals.slice(0, colLimit).map((row) => row.label);
  return rowLabels.map((label) => {
    const item = { [rowKey]: label };
    colLabels.forEach((column) => {
      item[column] = Number((sum(rows.filter((row) => row[rowKey] === label && row[colKey] === column), "kg") / 1000).toFixed(1));
    });
    return item;
  });
}

function renderMatrix() {
  if (configurableMatrix.row === configurableMatrix.col) configurableMatrix.col = configurableMatrix.row === "site" ? "waste" : "site";
  fillDimensionSelect("#matrix-row-dimension", configurableMatrix.row);
  fillDimensionSelect("#matrix-col-dimension", configurableMatrix.col);
  const rows = buildConfigurableMatrix(filteredPesadas(), configurableMatrix.row, configurableMatrix.col);
  renderDynamicMatrix(
    "#matrix-table",
    rows,
    configurableMatrix.row,
    matrixDimensions[configurableMatrix.row],
    "rgba(20, 125, 100,",
    { sortDir: "desc", limit: "all", controls: false, totalsPercent: true },
  );
}

function renderDynamicMatrix(target, sourceRows, labelKey, labelName, colorPrefix, defaults = {}) {
  if (defaults.controls === false) {
    document.querySelector(`[data-controls-for="${target}"]`)?.remove();
    matrixStates[target] = {
      query: "",
      sortDir: defaults.sortDir || "desc",
      limit: defaults.limit || "all",
    };
  } else {
    matrixStates[target] = matrixStates[target] || {
      query: "",
      sortDir: defaults.sortDir || "desc",
      limit: defaults.limit || "12",
    };
    ensureMatrixControls(target, sourceRows);
  }
  const state = matrixStates[target];
  let rows = sourceRows
    .map((row) => ({
      ...row,
      __total: Object.entries(row)
        .filter(([key]) => key !== labelKey)
        .reduce((sum, [, value]) => sum + (Number(value) || 0), 0),
    }))
    .filter((row) => String(row[labelKey] ?? "").toLocaleLowerCase("es-ES").includes(state.query.toLocaleLowerCase("es-ES")));
  rows = rows.sort((a, b) => {
    if (state.sortDir === "label") return String(a[labelKey]).localeCompare(String(b[labelKey]), "es");
    const result = a.__total - b.__total;
    return state.sortDir === "asc" ? result : -result;
  });
  const totalRows = rows.length;
  if (state.limit !== "all") rows = rows.slice(0, Number(state.limit));
  const controls = document.querySelector(`[data-controls-for="${target}"]`);
  if (controls) {
    controls.querySelector('[data-role="matrix-search"]').value = state.query;
    controls.querySelector('[data-role="matrix-sort"]').value = state.sortDir;
    controls.querySelector('[data-role="matrix-limit"]').value = state.limit;
    controls.querySelector(".control-summary").textContent = `${rows.length} de ${totalRows} visibles`;
  }

  const columns = Object.keys(rows[0] || {});
  const visibleColumns = columns.filter((column) => column !== "__total");
  const valueColumns = visibleColumns.filter((column) => column !== labelKey);
  const showTotalsPercent = defaults.totalsPercent === true;
  const rowTotals = new Map(rows.map((row) => [row[labelKey], valueColumns.reduce((total, column) => total + (Number(row[column]) || 0), 0)]));
  const colTotals = new Map(valueColumns.map((column) => [column, rows.reduce((total, row) => total + (Number(row[column]) || 0), 0)]));
  const grandTotal = [...rowTotals.values()].reduce((total, value) => total + value, 0);
  const renderMatrixValue = (value) => {
    const numeric = Number(value) || 0;
    if (!showTotalsPercent) return number(numeric, 1);
    return `${number(numeric, 1)} t · ${grandTotal ? number((numeric / grandTotal) * 100, 1) : "0"}%`;
  };
  const max = Math.max(...rows.flatMap((row) => valueColumns.map((column) => Number(row[column]) || 0)), 1);
  const table = document.querySelector(target);
  table.classList.add("matrix-standard");
  table.innerHTML = "";
  const head = el("tr");
  visibleColumns.forEach((column) => {
    if (column === labelKey && defaults.controls === false) {
      const axisSelect = el("select", { id: "matrix-row-dimension", "aria-label": "Filas de la matriz" });
      Object.entries(matrixDimensions).forEach(([value, label]) => axisSelect.append(el("option", { value, text: label })));
      axisSelect.value = configurableMatrix.row;
      axisSelect.addEventListener("change", (event) => {
        configurableMatrix.row = event.target.value;
        if (configurableMatrix.row === configurableMatrix.col) configurableMatrix.col = configurableMatrix.row === "site" ? "waste" : "site";
        renderMatrix();
      });
      head.append(el("th", { class: "matrix-row-selector-cell" }, [el("span", { class: "axis-caption", text: "Filas" }), axisSelect]));
      return;
    }
    head.append(el("th", { class: column !== labelKey ? "num" : "", text: column === labelKey ? labelName : shortLabel(column, 18) }));
  });
  if (showTotalsPercent) head.append(el("th", { class: "num matrix-total-head", text: "Total" }));
  table.append(el("thead", {}, [head]));
  const body = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    visibleColumns.forEach((column) => {
      const value = column === labelKey ? row[column] : Number(row[column]) || 0;
      const isZeroValue = column !== labelKey && showTotalsPercent && !value;
      const td = el("td", { class: column === labelKey ? "" : `num heat${isZeroValue ? " matrix-zero-cell" : ""}`, text: column === labelKey || !isZeroValue ? (column === labelKey ? value : renderMatrixValue(value)) : "" });
      if (column !== labelKey) {
        if (isZeroValue) {
          td.title = "0 t";
        } else {
          const alpha = 0.08 + (Number(value) / max) * 0.52;
          td.style.background = `${colorPrefix} ${alpha})`;
        }
      }
      tr.append(td);
    });
    if (showTotalsPercent) {
      tr.append(el("td", { class: "num matrix-total-cell", text: renderMatrixValue(rowTotals.get(row[labelKey]) || 0) }));
    }
    body.append(tr);
  });
  if (showTotalsPercent && rows.length) {
    const tr = el("tr", { class: "matrix-total-row" });
    tr.append(el("td", { text: "Total" }));
    valueColumns.forEach((column) => tr.append(el("td", { class: "num matrix-total-cell", text: renderMatrixValue(colTotals.get(column) || 0) })));
    tr.append(el("td", { class: "num matrix-total-cell", text: renderMatrixValue(grandTotal) }));
    body.append(tr);
  }
  table.append(body);
}

function renderDriverWasteMatrix() {
  renderDynamicMatrix("#driver-waste-table", view.drivers.wasteComposition, "driver", "Conductor", "rgba(36, 111, 178,", { sortDir: "desc", limit: "12" });
}

function ensureMatrixControls(target, rows) {
  const table = document.querySelector(target);
  const wrap = table.closest(".table-wrap");
  if (!wrap || wrap.previousElementSibling?.dataset?.controlsFor === target) return;
  const controls = el("div", { class: "controls", "data-controls-for": target }, [
    el("label", { class: "control" }, [
      el("span", { text: "Filtrar" }),
      el("input", { type: "search", placeholder: "Buscar fila", "data-role": "matrix-search" }),
    ]),
    el("label", { class: "control small" }, [
      el("span", { text: "Orden" }),
      el("select", { "data-role": "matrix-sort" }, [
        el("option", { value: "desc", text: "Mayor total" }),
        el("option", { value: "asc", text: "Menor total" }),
        el("option", { value: "label", text: "A-Z" }),
      ]),
    ]),
    el("label", { class: "control tiny" }, [
      el("span", { text: "Filas" }),
      el("select", { "data-role": "matrix-limit" }, [
        el("option", { value: "10", text: "10" }),
        el("option", { value: "12", text: "12" }),
        el("option", { value: "25", text: "25" }),
        el("option", { value: "all", text: "Todas" }),
      ]),
    ]),
    el("button", { class: "reset-button", type: "button", text: "Restablecer" }),
    el("div", { class: "control-summary", text: `${rows.length} registros` }),
  ]);
  controls.querySelector('[data-role="matrix-search"]').addEventListener("input", (event) => {
    matrixStates[target].query = event.target.value;
    renderMatrixTarget(target);
  });
  controls.querySelector('[data-role="matrix-sort"]').addEventListener("change", (event) => {
    matrixStates[target].sortDir = event.target.value;
    renderMatrixTarget(target);
  });
  controls.querySelector('[data-role="matrix-limit"]').addEventListener("change", (event) => {
    matrixStates[target].limit = event.target.value;
    renderMatrixTarget(target);
  });
  controls.querySelector(".reset-button").addEventListener("click", () => {
    matrixStates[target] = {
      query: "",
      sortDir: "desc",
      limit: target === "#driver-waste-table" ? "12" : "10",
    };
    renderMatrixTarget(target);
  });
  wrap.before(controls);
}

function renderSites() {
  renderTable(
    "#sites-table",
    [
      { label: "Garbigune", key: "site" },
      { label: "Base", key: "base" },
      { label: "Ruta", key: "route" },
      { label: "T salidas", key: "tons", num: true, format: (value) => number(value, 1) },
      { label: "Serv. salida", key: "trips", num: true, format: (value) => number(value) },
      { label: "Kg/serv. salida", key: "kg_per_trip", num: true, format: (value) => number(value) },
      { label: "Pctl kg/serv.", key: "kg_trip_percentile", num: true, format: (value) => `${number(value)}%` },
    ],
    view.sitesWaste.sites,
    { sortKey: "tons", sortDir: "desc", limit: "25" },
  );
  renderTable(
    "#bases-table",
    [
      { label: "Base", key: "base" },
      { label: "T salidas", key: "tons", num: true, format: (value) => number(value, 1) },
      { label: "Serv. salida", key: "trips", num: true, format: (value) => number(value) },
      { label: "Kg/serv. salida", key: "kg_per_trip", num: true, format: (value) => number(value) },
      { label: "Garbigunes", key: "sites", num: true, format: (value) => number(value) },
      { label: "Rutas", key: "routes", num: true, format: (value) => number(value) },
    ],
    view.sitesWaste.bases || [],
    { sortKey: "tons", sortDir: "desc", limit: "10" },
  );
  renderMatrix();

  const detail = view.sitesWaste.detailSample;
  const root = document.querySelector("#detail-aw");
  root.innerHTML = "";
  [
    ["Líneas detalle", number(detail.rows)],
    ["Entradas registradas", number(detail.entries)],
    ["Usuario ciudadanía", `${number(detail.citizensShare, 1)}%`],
    ["Residuo entrada principal", shortLabel(detail.topWaste[0]?.waste || "-", 30)],
  ].forEach(([label, value]) => {
    root.append(el("div", { class: "detail-item" }, [el("div", { class: "label", text: label }), el("div", { class: "value", text: value })]));
  });
}

function renderCapture() {
  const siteSelect = document.querySelector("#capture-site");
  if (!siteSelect) return;
  fillCaptureSelects();
  renderCaptureGlobalFilterChips();
  siteSelect.value = captureFilters.site;
  document.querySelector("#capture-family").value = captureFilters.wasteFamily;
  document.querySelector("#capture-subfamily").value = captureFilters.wasteSubfamily;
  document.querySelector("#capture-waste").value = captureFilters.waste;
  document.querySelector("#capture-user").value = captureFilters.userType;
  document.querySelectorAll("#capture-metric button").forEach((button) => button.classList.toggle("active", button.dataset.metric === captureFilters.metric));
  document.querySelectorAll("#capture-composition-level button").forEach((button) => button.classList.toggle("active", button.dataset.level === captureFilters.compositionLevel));
  document.querySelectorAll("#capture-flow-review button").forEach((button) => button.classList.toggle("active", button.dataset.flowReview === captureFilters.flowReview));
  const compositionTitle = document.querySelector("#capture-composition-title");
  const compositionSubtitle = document.querySelector("#capture-composition-subtitle");
  if (compositionTitle && compositionSubtitle) {
    const labels = {
      family: ["Composición por familia AW", "Familias de residuos, con detalle granular en subfamilias y residuos"],
      subfamily: ["Composición por subfamilia AW", "Segundo nivel de la taxonomía editable de entradas AW"],
      waste: ["Composición por residuo AW", "Residuo granular original registrado en AW"],
    };
    const [title, subtitle] = labels[captureFilters.compositionLevel] || labels.family;
    compositionTitle.textContent = title;
    compositionSubtitle.innerHTML = `<span class="taxonomy-tag taxonomy-in">Entradas AW</span> ${subtitle}`;
  }
  const overriddenByGlobalSite = Boolean(globalFilters.site);
  siteSelect.disabled = overriddenByGlobalSite;
  const localBits = [
    overriddenByGlobalSite ? `Garbigune global: ${globalFilters.site}` : captureFilters.site ? `Garbigune AW: ${captureFilters.site}` : "",
    selectedGlobalAwFamilies().active ? awFamilyBridgeLabel(3) : "",
    captureFilters.cp ? `CP: ${captureFilters.cp}` : "",
    captureFilters.wasteFamily ? `Familia: ${captureFilters.wasteFamily}` : "",
    captureFilters.wasteSubfamily ? `Subfamilia: ${captureFilters.wasteSubfamily}` : "",
    captureFilters.waste ? `Residuo: ${shortLabel(captureFilters.waste, 24)}` : "",
    captureFilters.userType ? `Usuario: ${captureFilters.userType}` : "",
  ].filter(Boolean);
  const captureTonsDecimals = captureFilters.cp ? 2 : 1;
  document.querySelector("#capture-filter-summary").textContent =
    `${number(view.capture?.meta?.filteredRows || 0)} líneas AW · ${number(view.capture?.meta?.filteredTons || 0, captureTonsDecimals)} t entrada${captureAggregatesLoading ? " · cargando agregado histórico" : ""}${captureAggregatesError ? ` · ${captureAggregatesError}` : ""}${localBits.length ? ` · ${localBits.join(" · ")}` : ""}`;
  if (document.querySelector("#capture")?.classList.contains("active") && !rawAw.length && !captureAggregatesLoading && !captureAggregatesError) {
    loadCaptureAggregates();
  }
  if (document.querySelector("#capture")?.classList.contains("active") && !captureGeojson && !captureGeojsonLoading && !captureGeojsonError) {
    loadCaptureGeojson();
  }
  renderCaptureMap();
  renderCaptureFamilyLegend();
  renderCaptureQualityNotes();
  renderCaptureFlowReviewKpis();
  renderCapturePriorityCases();
  renderTable(
    "#capture-flows-table",
    [
      { label: "CP origen", key: "cp" },
      { label: "Garbigune observado", key: "site" },
      { label: "Garbigune más cercano", key: "nearest_site", format: (value) => value || "s/d" },
      { label: "Estado", key: "is_nearest", format: (value, row) => (row.nearest_site ? (value ? "Más cercano" : "No más cercano") : "s/d") },
      { label: "Motivo probable", key: "probable_reason" },
      { label: "Revisión", key: "needs_review", format: (value) => (value ? "Revisar" : "Explicable") },
      { label: "Severidad", key: "severity" },
      { label: "Municipio origen", key: "origin_municipality" },
      { label: "T entrada", key: "tons", num: true, format: (value) => number(value, 2) },
      { label: "Entradas", key: "entries", num: true, format: (value) => number(value) },
      { label: "Líneas", key: "rows", num: true, format: (value) => number(value) },
      { label: "Dist. obs.", key: "distance_km", num: true, format: (value) => (value ? `${number(value, 1)} km` : "s/d") },
      { label: "Dist. cercana", key: "nearest_distance_km", num: true, format: (value) => (value ? `${number(value, 1)} km` : "s/d") },
      { label: "Dif. km", key: "distance_delta_km", num: true, format: (value, row) => (row.nearest_site ? `${number(value, 1)} km` : "s/d") },
      { label: "Km extra", key: "extra_km", num: true, format: (value) => (value ? `${number(value, 1)} km` : "-") },
      { label: "Impacto", key: "extra_ton_km", num: true, format: (value) => (value ? `${number(value, 1)} t·km` : "-") },
      { label: "Kg/km", key: "kg_per_km", num: true, format: (value) => (value ? number(value, 1) : "s/d") },
      { label: "Entr./km", key: "entries_per_km", num: true, format: (value) => (value ? number(value, 2) : "s/d") },
      { label: "Familia principal", key: "top_family" },
      { label: "Subfamilia principal", key: "top_subfamily" },
      { label: "Residuo principal", key: "top_waste" },
      { label: "Usuario principal", key: "top_user" },
    ],
    captureReviewFlows(),
    { sortKey: "extra_ton_km", sortDir: "desc", limit: "25" },
  );
  renderTable(
    "#capture-cp-table",
    [
      { label: "CP origen", key: "cp" },
      { label: "T entrada", key: "tons", num: true, format: (value) => number(value, 2) },
      { label: "Entradas", key: "entries", num: true, format: (value) => number(value) },
      { label: "Líneas", key: "rows", num: true, format: (value) => number(value) },
      { label: "Garbigunes", key: "sites", num: true, format: (value) => number(value) },
      { label: "Familias", key: "waste_families", num: true, format: (value) => number(value) },
      { label: "Subfamilias", key: "waste_subfamilies", num: true, format: (value) => number(value) },
      { label: "Residuos", key: "wastes", num: true, format: (value) => number(value) },
      { label: "Dist. media", key: "avg_distance_km", num: true, format: (value) => (value ? `${number(value, 1)} km` : "s/d") },
      { label: "Kg/km", key: "kg_per_km", num: true, format: (value) => (value ? number(value, 1) : "s/d") },
      { label: "Entr./km", key: "entries_per_km", num: true, format: (value) => (value ? number(value, 2) : "s/d") },
      { label: "Destino principal", key: "top_site" },
      { label: "Familia principal", key: "top_family" },
      { label: "Subfamilia principal", key: "top_subfamily" },
      { label: "Residuo principal", key: "top_waste" },
      { label: "Usuario principal", key: "top_user" },
      { label: "Geometría", key: "has_geometry", format: (value) => (value ? "Sí" : "No") },
    ],
    view.capture?.byCp || [],
    { sortKey: "tons", sortDir: "desc", limit: "25" },
  );
}

function renderCaptureGlobalFilterChips() {
  const root = document.querySelector("#capture-global-filter-chips");
  if (!root) return;
  const awBridge = selectedGlobalAwFamilies();
  const chips = [];
  const from = globalFilters.from <= globalFilters.to ? globalFilters.from : globalFilters.to;
  const to = globalFilters.from <= globalFilters.to ? globalFilters.to : globalFilters.from;
  chips.push(["applies", `Fecha global aplicada a AW por meses completos: ${from.slice(0, 7)} · ${to.slice(0, 7)}`]);
  chips.push(["applies", globalFilters.site ? `Garbigune global aplicado a AW: ${globalFilters.site}` : "Garbigune: todos los destinos AW"]);
  if (awBridge.active) {
    const families = [...awBridge.families].sort((a, b) => a.localeCompare(b, "es"));
    if (families.length) {
      chips.push(["applies", `Residuos salida → familias AW: ${families.join(", ")}`]);
    } else {
      chips.push(["warning", `Residuos salida seleccionados sin equivalencia AW: ${awBridge.unmappedWastes.join(", ") || "s/d"}`]);
    }
  } else {
    chips.push(["neutral", "Residuos: todos; AW no se restringe por familia"]);
  }
  const nonApplicable = [
    globalFilters.base && "base",
    globalFilters.route && "ruta",
    globalFilters.vehicle && "vehículo",
    globalFilters.driver && "conductor",
  ].filter(Boolean);
  if (nonApplicable.length) {
    chips.push(["not-applicable", `No aplican a Entradas AW: ${nonApplicable.join(", ")}`]);
  }
  const local = [
    captureFilters.wasteFamily && `familia local ${captureFilters.wasteFamily}`,
    captureFilters.wasteSubfamily && `subfamilia local ${captureFilters.wasteSubfamily}`,
    captureFilters.waste && `residuo AW ${shortLabel(captureFilters.waste, 22)}`,
    captureFilters.userType && `usuario ${captureFilters.userType}`,
    captureFilters.cp && `CP ${captureFilters.cp}`,
  ].filter(Boolean);
  if (local.length) chips.push(["local", `Filtros locales AW adicionales: ${local.join(" · ")}`]);

  root.innerHTML = "";
  chips.forEach(([kind, label]) => {
    root.append(el("span", { class: `filter-chip capture-filter-chip ${kind}`, text: label }));
  });
}

async function loadCaptureAggregates() {
  captureAggregatesLoading = true;
  captureAggregatesError = "";
  renderCaptureMap();
  try {
    const response = await fetch(data.capture?.aggregateFile || "aw_capture_aggregates.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await readMaybeCompressedJson(response, data.capture?.aggregateFile || "");
    rawAw = (payload.records || []).map((row) => ({
      ...row,
      waste_family: row.waste_family || "SIN FAMILIA",
      waste_subfamily: row.waste_subfamily || "SIN SUBFAMILIA",
      kg: Number(row.kg) || 0,
      rows: Number(row.rows) || 0,
      entries: Number(row.entries) || 0,
    }));
    reconcileCaptureFilters();
    const rows = filteredPesadas();
    const benchmarkRows = globalFilters.driver ? filteredPesadas({ ignore: "driver" }) : rows;
    view = aggregatePesadas(rows, benchmarkRows);
    captureAggregatesLoading = false;
    renderDashboard();
  } catch (error) {
    captureAggregatesError = "No se pudo cargar el agregado AW.";
    captureAggregatesLoading = false;
    renderCaptureMap();
  } finally {
    captureAggregatesLoading = false;
  }
}

async function readMaybeCompressedJson(response, fileName) {
  if (String(fileName).endsWith(".gz")) {
    if (!("DecompressionStream" in window)) throw new Error("gzip_not_supported");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  }
  return response.json();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (src === data.recordsScriptFile && window.DASHBOARD_RECORDS?.records) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.dynamicSrc = src;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
}

async function loadCoreRecords() {
  if (rawPesadas.length || !data.recordsFile) return;
  coreRecordsLoading = true;
  try {
    let payload;
    try {
      const response = await fetch(data.recordsFile);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await readMaybeCompressedJson(response, data.recordsFile);
    } catch (fetchError) {
      if (!data.recordsScriptFile) throw fetchError;
      await loadScript(data.recordsScriptFile);
      payload = window.DASHBOARD_RECORDS;
      if (!payload?.records) throw fetchError;
    }
    rawPesadas = payload.records?.pesadas || [];
    rawIncidencias = payload.records?.incidencias || [];
    data.records = { ...(data.records || {}), pesadas: rawPesadas, incidencias: rawIncidencias };
  } catch (error) {
    coreRecordsError = "No se pudieron cargar los registros operativos.";
    throw error;
  } finally {
    coreRecordsLoading = false;
  }
}

async function loadCaptureGeojson() {
  captureGeojsonLoading = true;
  captureGeojsonError = "";
  renderCaptureMap();
  try {
    const response = await fetch(data.capture?.cpGeojsonFile || "bizkaia_codigos_postales.geojson");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    captureGeojson = await response.json();
    const rows = filteredPesadas();
    const benchmarkRows = globalFilters.driver ? filteredPesadas({ ignore: "driver" }) : rows;
    view = aggregatePesadas(rows, benchmarkRows);
    renderDashboard();
  } catch (error) {
    captureGeojsonError = "No se pudo cargar el GeoJSON de códigos postales.";
    renderCaptureMap();
  } finally {
    captureGeojsonLoading = false;
  }
}

function captureMetricValue(row) {
  if (captureFilters.metric === "kg_per_km") return Number(row.kg_per_km) || 0;
  if (captureFilters.metric === "entries_per_km") return Number(row.entries_per_km) || 0;
  if (captureFilters.metric === "entries") return Number(row.entries) || 0;
  if (captureFilters.metric === "rows") return Number(row.rows) || 0;
  return Number(row.kg) || 0;
}

function captureMetricLabel(value) {
  if (captureFilters.metric === "kg_per_km") return `${number(value, 1)} kg/km`;
  if (captureFilters.metric === "entries_per_km") return `${number(value, 2)} entradas/km`;
  if (captureFilters.metric === "entries") return `${number(value)} entradas`;
  if (captureFilters.metric === "rows") return `${number(value)} líneas`;
  return `${number(value / 1000, 2)} t entrada`;
}

function captureMetricName() {
  if (captureFilters.metric === "kg_per_km") return "kg por km";
  if (captureFilters.metric === "entries_per_km") return "entradas por km";
  if (captureFilters.metric === "entries") return "entradas";
  if (captureFilters.metric === "rows") return "líneas";
  return "kg/t entrada";
}

function captureReviewFlows() {
  const flows = view.capture?.flows || [];
  if (captureFilters.flowReview === "off") return flows.filter((flow) => flow.nearest_site && !flow.is_nearest);
  if (captureFilters.flowReview === "nearest") return flows.filter((flow) => flow.nearest_site && flow.is_nearest);
  if (captureFilters.flowReview === "review") return flows.filter((flow) => flow.nearest_site && flow.needs_review);
  return flows;
}

function flowStroke(flow) {
  if (flow.needs_review) return "#b8463f";
  if (!flow.nearest_site) return "#7a5aa6";
  if (flow.is_nearest) return "#147d64";
  if (flow.severity_rank >= 3) return "#b8463f";
  if (flow.severity_rank >= 2) return "#c67b24";
  return "#d4a02f";
}

function renderCaptureFlowReviewKpis() {
  const root = document.querySelector("#capture-flow-review-kpis");
  if (!root) return;
  const flows = captureReviewFlows();
  const offFlows = flows.filter((flow) => flow.nearest_site && !flow.is_nearest);
  const kg = sum(flows, "kg");
  const offKg = sum(offFlows, "kg");
  const extraTonKm = sum(offFlows, "extra_ton_km");
  const weightedExtraKm = offKg ? offFlows.reduce((total, flow) => total + flow.extra_km * flow.kg, 0) / offKg : 0;
  const reviewFlows = offFlows.filter((flow) => flow.needs_review);
  const highImpact = offFlows.filter((flow) => flow.severity_rank >= 3).length;
  const cards = [
    ["Flujos visibles", number(flows.length), captureFilters.flowReview === "off" ? "No más cercano" : captureFilters.flowReview === "nearest" ? "Más cercano" : captureFilters.flowReview === "review" ? "Revisar" : "Todos"],
    ["T no más cercano", `${number(offKg / 1000, 2)} t`, `${number(percentage(offKg, kg), 1)}% del peso visible`],
    ["Km extra ponderados", `${number(weightedExtraKm, 1)} km`, `${number(extraTonKm, 1)} t·km extra`],
    ["A revisar", `${number(sum(reviewFlows, "kg") / 1000, 2)} t`, `${number(reviewFlows.length)} flujos · ${number(highImpact)} severidad alta`],
  ];
  root.innerHTML = "";
  cards.forEach(([label, value, sub]) => {
    root.append(el("div", { class: "detail-item" }, [el("div", { class: "label", text: label }), el("div", { class: "value", text: value }), el("div", { class: "sub", text: sub })]));
  });
}

function renderCapturePriorityCases() {
  const root = document.querySelector("#capture-priority-cases");
  if (!root) return;
  const cases = capturePriorityCases().slice(0, 8);
  root.innerHTML = "";
  if (!cases.length) {
    root.append(
      el("div", { class: "priority-case" }, [
        el("strong", {}, [el("span", { text: "Sin casos prioritarios" }), el("span", { text: "0 t·km" })]),
        el("p", { text: "Con los filtros activos no hay flujos marcados como Revisar." }),
        el("span", { text: "La tabla inferior mantiene el detalle completo de flujos comparables." }),
      ]),
    );
    return;
  }
  cases.forEach((flow, index) => {
    const route = `CP ${flow.cp} → ${shortLabel(flow.site, 22)}`;
    const compare = `Más cercano: ${shortLabel(flow.nearest_site, 22)} · +${number(flow.extra_km, 1)} km`;
    const context = `${shortLabel(flow.origin_municipality || "-", 22)} · ${shortLabel(flow.top_family, 18)} / ${shortLabel(flow.top_subfamily, 20)}`;
    root.append(
      el("div", { class: "priority-case" }, [
        el("strong", {}, [el("span", { text: `${index + 1}. ${route}` }), el("span", { text: `${number(flow.extra_ton_km, 1)} t·km` })]),
        el("p", { text: `${number(flow.tons, 2)} t · ${number(flow.entries)} entradas · ${flow.severity}` }),
        el("span", { text: compare }),
        el("span", { text: `Motivo: ${flow.probable_reason} · ${context}` }),
      ]),
    );
  });
}

function capturePriorityCases() {
  return (view.capture?.flows || [])
    .filter((flow) => flow.nearest_site && flow.needs_review)
    .sort((a, b) => (b.extra_ton_km || 0) - (a.extra_ton_km || 0));
}

function exportCapturePriorityCases() {
  const rows = capturePriorityCases().map((flow, index) => ({ ...flow, priority_rank: index + 1 }));
  const columns = [
    { label: "prioridad", key: "priority_rank" },
    { label: "cp_origen", key: "cp" },
    { label: "municipio_origen", key: "origin_municipality" },
    { label: "municipio_cuenta", key: "account_municipality" },
    { label: "garbigune_observado", key: "site" },
    { label: "garbigune_mas_cercano", key: "nearest_site" },
    { label: "toneladas_entrada", key: "tons", format: (value) => number(value, 2) },
    { label: "entradas", key: "entries" },
    { label: "lineas_aw", key: "rows" },
    { label: "distancia_observada_km", key: "distance_km", format: (value) => number(value, 1) },
    { label: "distancia_mas_cercano_km", key: "nearest_distance_km", format: (value) => number(value, 1) },
    { label: "km_extra", key: "extra_km", format: (value) => number(value, 1) },
    { label: "impacto_tkm", key: "extra_ton_km", format: (value) => number(value, 2) },
    { label: "severidad", key: "severity" },
    { label: "motivo_probable", key: "probable_reason" },
    { label: "familia_principal", key: "top_family" },
    { label: "subfamilia_principal", key: "top_subfamily" },
    { label: "residuo_principal", key: "top_waste" },
    { label: "usuario_principal", key: "top_user" },
    { label: "filtro_fecha_inicio", get: () => globalFilters.from },
    { label: "filtro_fecha_fin", get: () => globalFilters.to },
  ];
  downloadCsv(`casos_prioritarios_aw_${globalFilters.from}_${globalFilters.to}.csv`, columns, rows);
}

function flattenGeoCoordinates(geometry) {
  if (!geometry) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates.flat() : [];
  return polygons.flat(2).filter((coord) => Array.isArray(coord) && coord.length >= 2);
}

function geoBounds(features, points) {
  const coords = features.flatMap((feature) => flattenGeoCoordinates(feature.geometry));
  points.forEach((point) => {
    if (Number.isFinite(point.lon) && Number.isFinite(point.lat)) coords.push([point.lon, point.lat]);
  });
  const lons = coords.map((coord) => Number(coord[0])).filter(Number.isFinite);
  const lats = coords.map((coord) => Number(coord[1])).filter(Number.isFinite);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function geoProject(coord, bounds, width, height, padding) {
  const lon = Number(coord[0]);
  const lat = Number(coord[1]);
  const x = padding + ((lon - bounds.minLon) / Math.max(bounds.maxLon - bounds.minLon, 0.0001)) * (width - padding * 2);
  const y = height - padding - ((lat - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat, 0.0001)) * (height - padding * 2);
  return [x, y];
}

function geoPath(geometry, bounds, width, height, padding) {
  if (!geometry) return "";
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring
            .map((coord, index) => {
              const [x, y] = geoProject(coord, bounds, width, height, padding);
              return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ") + " Z",
        )
        .join(" "),
    )
    .join(" ");
}

function geoCentroid(geometry) {
  const coords = flattenGeoCoordinates(geometry);
  if (!coords.length) return null;
  const totals = coords.reduce((acc, coord) => ({ lon: acc.lon + Number(coord[0]), lat: acc.lat + Number(coord[1]) }), { lon: 0, lat: 0 });
  return [totals.lon / coords.length, totals.lat / coords.length];
}

function renderCaptureMap() {
  const target = document.querySelector("#capture-map");
  if (!target) return;
  const features = view.capture?.cpGeojson?.features || [];
  const cpRows = view.capture?.byCp || [];
  const siteRows = view.capture?.bySite || [];
  if (!features.length) {
    const message = captureGeojsonError || (captureGeojsonLoading ? "Cargando polígonos de códigos postales…" : "Abre Captación AW para cargar los polígonos de códigos postales");
    target.innerHTML = emptyChart(900, 120, message, "chart--map");
    return;
  }
  const width = CHART_THEME.mapWidth;
  const height = CHART_THEME.mapHeight;
  const padding = 28;
  const metricByCp = new Map(cpRows.map((row) => [row.cp, { ...row, value: captureMetricValue(row) }]));
  const maxValue = Math.max(...[...metricByCp.values()].map((row) => row.value), 1);
  const bounds = geoBounds(features, siteRows);
  const centroidByCp = new Map(features.map((feature) => [feature.properties?.cp || "", geoCentroid(feature.geometry)]).filter(([, centroid]) => centroid));
  const sitePointByName = new Map(siteRows.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon)).map((row) => [row.site, row]));
  const regions = features
    .map((feature) => {
      const cp = feature.properties?.cp || "";
      const row = metricByCp.get(cp);
      const value = row?.value || 0;
      const alpha = value ? 0.14 + (value / maxValue) * 0.62 : 0.04;
      const selected = captureFilters.cp === cp;
      const display = row
        ? `${captureMetricLabel(value)} · ${number(row.entries)} entradas · ${shortLabel(row.top_site, 24)}`
        : "Sin entradas AW en el filtro activo";
      return `<path class="map-region${value ? " active" : ""}${selected ? " selected" : ""}" d="${geoPath(feature.geometry, bounds, width, height, padding)}" fill="rgba(20, 125, 100, ${alpha})" stroke="#cbd7d1" stroke-width="0.7" data-cp="${cp}" data-label="CP ${cp}" data-display="${display.replace(/"/g, "&quot;")}"></path>`;
    })
    .join("");
  const flowRows = captureReviewFlows()
    .filter((flow) => centroidByCp.has(flow.cp) && sitePointByName.has(flow.site))
    .slice(0, captureFilters.cp || captureFilters.site || globalFilters.site ? 80 : 20);
  const maxFlowValue = Math.max(...flowRows.map(captureMetricValue), 1);
  const flowParts = flowRows
    .map((flow) => {
      const site = sitePointByName.get(flow.site);
      const start = geoProject(centroidByCp.get(flow.cp), bounds, width, height, padding);
      const end = geoProject([site.lon, site.lat], bounds, width, height, padding);
      const value = captureMetricValue(flow);
      const strokeWidth = 1.2 + Math.sqrt(value / maxFlowValue) * 7;
      const opacity = 0.28 + Math.sqrt(value / maxFlowValue) * 0.5;
      const midX = (start[0] + end[0]) / 2;
      const midY = (start[1] + end[1]) / 2 - Math.min(42, Math.hypot(end[0] - start[0], end[1] - start[1]) * 0.12);
      const selected = captureFilters.cp === flow.cp || captureFilters.site === flow.site || globalFilters.site === flow.site;
      const nearestText = flow.nearest_site
        ? flow.is_nearest
          ? "destino más cercano"
          : `+${number(flow.extra_km, 1)} km vs ${shortLabel(flow.nearest_site, 22)} · ${flow.severity} · ${flow.probable_reason}`
        : "sin comparación cercana";
      const display = `${captureMetricLabel(value)} · ${number(flow.distance_km, 1)} km obs. · ${nearestText} · ${number(flow.entries)} entradas · ${shortLabel(flow.top_family, 22)} / ${shortLabel(flow.top_subfamily, 22)} · ${shortLabel(flow.top_waste, 26)} · ${flow.top_user || "SIN DATO"}`;
      const d = `M${start[0].toFixed(2)},${start[1].toFixed(2)} Q${midX.toFixed(2)},${midY.toFixed(2)} ${end[0].toFixed(2)},${end[1].toFixed(2)}`;
      const attrs = `data-cp="${flow.cp}" data-site="${flow.site}" data-label="CP ${flow.cp} → ${flow.site}" data-display="${display.replace(/"/g, "&quot;")}"`;
      return {
        visible: `<path class="map-flow-visible${selected ? " selected" : ""}${flow.nearest_site && !flow.is_nearest ? " off-nearest" : ""}" d="${d}" fill="none" stroke="${flowStroke(flow)}" stroke-width="${strokeWidth.toFixed(1)}" stroke-opacity="${opacity.toFixed(2)}"></path>`,
        hit: `<path class="map-flow${selected ? " selected" : ""}" d="${d}" fill="none" stroke="rgba(255,255,255,0.001)" stroke-width="${Math.max(strokeWidth + 10, 14).toFixed(1)}" ${attrs}></path>`,
      };
    });
  const flowLines = flowParts.map((part) => part.visible).join("");
  const flowHits = flowParts.map((part) => part.hit).join("");
  const markers = siteRows
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon))
    .map((row) => {
      const [x, y] = geoProject([row.lon, row.lat], bounds, width, height, padding);
      const radius = 5 + Math.sqrt(Math.max(captureMetricValue(row), 0) / Math.max(maxValue, 1)) * 13;
      const distanceText = row.avg_distance_km ? ` · ${number(row.avg_distance_km, 1)} km med.` : "";
      const display = `${captureMetricLabel(captureMetricValue(row))}${distanceText} · ${number(row.entries)} entradas · ${number(row.cps)} CP origen`;
      return `<g class="garbigune-marker" data-site="${row.site}" data-label="${row.site}" data-display="${display.replace(/"/g, "&quot;")}">
        <circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="#246fb2" fill-opacity="0.82" stroke="white" stroke-width="2"></circle>
        <text x="${x + radius + 4}" y="${y + 4}" class="map-marker-label">${shortLabel(row.site, 18)}</text>
      </g>`;
    })
    .join("");
  const noCp = cpRows.find((row) => row.cp === "SIN CP");
  target.innerHTML = svg(
    width,
    height,
    `<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#f8faf8"></rect>
    ${regions}${flowLines}${markers}${flowHits}
    <g class="map-legend">
      <text x="22" y="30" class="axis-title">Captación de entradas AW por CP origen</text>
      <text x="22" y="52" class="axis-label">Grosor: ${captureMetricName()} · Color: verde explicable/más cercano, rojo revisar · ${number(flowRows.length)} flujos</text>
      ${noCp ? `<text x="22" y="74" class="axis-label">Sin CP: ${captureMetricLabel(captureMetricValue(noCp))} no representados en polígonos</text>` : ""}
    </g>`,
    "chart--map",
  );
  bindMapInteractions("#capture-map");
}

function bindMapInteractions(target) {
  const tooltip = document.querySelector("#chart-tooltip");
  document.querySelectorAll(`${target} .map-region, ${target} .garbigune-marker, ${target} .map-flow`).forEach((item) => {
    item.addEventListener("mousemove", (event) => {
      tooltip.hidden = false;
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY + 12}px`;
      const action = item.classList.contains("map-flow")
        ? "Clic para seleccionar CP + Garbigune"
        : item.dataset.site ? "Clic para filtrar Garbigune AW" : item.dataset.cp ? "Clic para seleccionar CP origen" : "";
      tooltip.innerHTML = `<strong>${item.dataset.label}</strong><span>${item.dataset.display}</span>${action ? `<br><span>${action}</span>` : ""}`;
    });
    item.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
    item.addEventListener("click", () => {
      if (item.classList.contains("map-flow")) {
        captureFilters.cp = item.dataset.cp || "";
        captureFilters.site = item.dataset.site || "";
      } else if (item.dataset.site) {
        captureFilters.site = item.dataset.site;
      } else if (item.dataset.cp) {
        captureFilters.cp = captureFilters.cp === item.dataset.cp ? "" : item.dataset.cp;
      } else {
        return;
      }
      applyGlobalFilters();
    });
  });
}

function renderCaptureFamilyLegend() {
  const root = document.querySelector("#capture-family-legend");
  if (!root) return;
  const legend = view.capture?.familyLegend || data.capture?.familyLegend || [];
  const summary = document.querySelector("#capture-taxonomy-summary");
  const meta = data.capture?.meta || {};
  if (summary) {
    const mapped = Number(meta.mappedWasteTypes || 0);
    const unmapped = Number(meta.unmappedWasteTypes || 0);
    const unmappedSubfamilies = Number(meta.unmappedSubfamilyTypes || 0);
    const total = mapped + unmapped;
    const coverage = total ? (mapped / total) * 100 : 0;
    const status = unmapped || unmappedSubfamilies ? "warning" : "ok";
    summary.innerHTML = "";
    summary.append(
      el("div", { class: `taxonomy-score ${status}` }, [
        el("strong", { text: `${number(coverage, 1)}% clasificado` }),
        el("span", { text: `${number(mapped)} de ${number(total)} residuos AW con familia y subfamilia` }),
      ]),
      el("div", { class: "taxonomy-kpis" }, [
        el("span", { text: `${number(legend.length)} familias` }),
        el("span", { text: `${number(unmapped)} sin familia` }),
        el("span", { text: `${number(unmappedSubfamilies)} sin subfamilia` }),
      ]),
    );
  }
  root.innerHTML = "";
  if (!legend.length) {
    root.append(el("div", { class: "note" }, [el("strong", { text: "Sin taxonomía AW" }), el("span", { text: "No se ha encontrado una tabla de familias para los residuos AW." })]));
    return;
  }
  legend.forEach((item) => {
    root.append(
      el("div", { class: "family-item" }, [
        el("strong", {}, [
          el("span", { text: item.family }),
          el("span", { text: `${number(item.tons || 0, 2)} t · ${number(item.share || 0, 1)}%` }),
        ]),
        el("p", { text: item.description || "Familia AW editable desde la tabla de clasificación." }),
        el("span", { text: `Subfamilias: ${(item.subfamilies || []).join(", ") || "sin subfamilias definidas"}` }),
        el("span", { text: `Ejemplos: ${item.examples || "sin ejemplos definidos"} · ${number(item.activeWastes || item.mappedWastes || 0)} residuos activos` }),
      ]),
    );
  });
}

function renderCaptureQualityNotes() {
  const root = document.querySelector("#capture-quality-notes");
  if (!root) return;
  const meta = view.capture?.meta || {};
  const notes = [
    ["Cobertura temporal", `Entradas AW disponibles de ${data.coverage.awFrom || meta.from || "-"} a ${data.coverage.awTo || meta.to || "-"}. ${meta.timeFilterNote || "El histórico AW se carga como agregado compacto para mantener velocidad."}`],
    ["CP informado", `${number(meta.cpRowsShare || 0, 1)}% de líneas · ${number(meta.cpKgShare || 0, 1)}% del peso del filtro activo tiene CP origen.`],
    ["Cruce con GeoJSON", `${number(meta.geoKgShare || 0, 1)}% del peso del filtro activo cruza con polígonos de Bizkaia. CP sin geometría en fuente: ${(data.capture?.meta?.unmatchedCps || []).join(", ") || "sin incidencias"}.`],
    ["Familias AW", `Taxonomía editable en ${meta.familySource || data.capture?.meta?.familySource || "residuos_aw_familias.csv"}. Residuos sin familia: ${(data.capture?.meta?.unmappedWastes || []).join(", ") || "ninguno"}. Sin subfamilia: ${(data.capture?.meta?.unmappedSubfamilies || []).join(", ") || "ninguno"}.`],
    ["Garbigune más cercano", `${number(meta.offNearestFlowCount || 0)} de ${number(meta.nearestFlowCount || 0)} flujos CP → Garbigune comparables no van al punto geográficamente más cercano (${number((meta.offNearestKg || 0) / 1000, 1)} t · ${number(meta.offNearestKgShare || 0, 1)}% del peso filtrado). Esta señal sirve para revisión; puede explicarse por convenios, accesibilidad, horarios o tipologías aceptadas.`],
    ["Motivo probable", `${number(meta.reviewFlowCount || 0)} flujos quedan como “Revisar” (${number((meta.reviewKg || 0) / 1000, 2)} t · ${number(meta.reviewKgShare || 0, 1)}%). El motivo se infiere con municipio AW, convenio municipal, familia/subfamilia y distancia extra; no confirma la causa operativa.`],
    ["Severidad de flujos", `Impacto = toneladas × km extra frente al Garbigune más cercano. Severidad alta si impacto ≥ 10 t·km o si supera 20 km extra con al menos 0,5 t; media si impacto ≥ 2 t·km o supera 10 km.`],
    ["Normalización por distancia", "Kg/km y entradas/km usan distancia Haversine desde el centroide aproximado del polígono CP al punto Garbigune. Es una proxy territorial, no una distancia real por carretera."],
    ["Lectura metodológica", "Las entradas AW representan depósito/registro de usuario. No equivalen a servicios de salida ni deben sumarse a toneladas transportadas."],
  ];
  root.innerHTML = "";
  notes.forEach(([title, body]) => root.append(el("div", { class: "note" }, [el("strong", { text: title }), el("span", { text: body })])));
}

function renderFleet() {
  const note = document.querySelector("#fleet-time-window-note");
  if (note) {
    const incidentsByYear = (data.fleet.incidentsByYear || []).map((row) => `${row.year}: ${number(row.count)}`).join(" · ");
    note.textContent = `Fuente activa de incidencias: ${data.coverage.incidenciasSource || data.activeSources?.incidencias}. Las incidencias Garbigunes cubren ${data.coverage.incidenciasFrom} a ${data.coverage.incidenciasTo} (${incidentsByYear}). Las salidas transportadas cubren ${data.coverage.pesadasFrom} a ${data.coverage.pesadasTo}; los ratios se calculan contra servicios de salida y toneladas de salida del periodo filtrado.`;
  }
  incidentTrendChart();
  renderTable(
    "#fleet-table",
    [
      { label: "Matrícula", key: "vehicle" },
      { label: "Combustible", key: "fuel" },
      { label: "Base asign.", key: "assigned_bases" },
      { label: "Ruta asign.", key: "assigned_routes" },
      { label: "Base obs.", key: "observed_bases" },
      { label: "T salidas", key: "tons", num: true, format: (value) => number(value, 1) },
      { label: "Serv. salida", key: "trips", num: true, format: (value) => number(value) },
      { label: "Kg/serv. salida", key: "kg_per_trip", num: true, format: (value) => number(value) },
      { label: "Pctl kg/serv.", key: "kg_trip_percentile", num: true, format: (value) => `${number(value)}%` },
      { label: "Conf.", key: "confidence", format: (value, row) => `${value} (${number(row.confidence_score)}%)` },
      { label: "Incid.", key: "incidents", num: true, format: (value) => number(value) },
      { label: "Inc./1000 serv.", key: "incidents_per_1000_trips", num: true, format: (value) => number(value, 1) },
      { label: "Inc./1000 t", key: "incidents_per_1000_tons", num: true, format: (value) => number(value, 1) },
      { label: "Edad", key: "age_years", num: true, format: (value) => (value ? `${number(value, 1)} años` : "") },
    ],
    view.fleet.vehicles,
    { sortKey: "tons", sortDir: "desc", limit: "25" },
  );
}

function renderDrivers() {
  document.querySelector("#driver-min-days").value = String(driverMinDays);
  renderDriverProfileSummary();
  renderTable(
    "#driver-clusters-table",
    [
      { label: "Perfil", key: "profile", format: (value, row) => `${value} · ${number(row.drivers)} cond.` },
      { label: "Conductores", key: "drivers", num: true, format: (value) => number(value) },
      { label: "Comparables", key: "comparable", num: true, format: (value) => number(value) },
      { label: "Serv. salida", key: "services", num: true, format: (value) => number(value) },
      { label: "T salidas", key: "tons", num: true, format: (value) => number(value, 1) },
      { label: "Score medio", key: "avg_score", num: true, format: (value) => number(value, 1) },
      { label: "Serv./día med.", key: "avg_services_day", num: true, format: (value) => number(value, 1) },
      { label: "Kg/serv. med.", key: "avg_kg_service", num: true, format: (value) => number(value) },
      { label: "Lectura", key: "description" },
      { label: "Acción", key: "action" },
    ],
    view.drivers.clusters || [],
    { sortKey: "drivers", sortDir: "desc", limit: "all" },
  );
  renderTable(
    "#drivers-table",
    [
      { label: "Conductor", key: "driver" },
      { label: "Perfil", key: "cluster_label" },
      { label: "Días", key: "work_days", num: true, format: (value) => number(value) },
      { label: "Serv. salida", key: "total_services", num: true, format: (value) => number(value) },
      { label: "Serv. salida/día", key: "services_per_day", num: true, format: (value) => number(value, 1) },
      { label: "Estab. serv.", key: "services_day_cv", num: true, format: (value) => `${number(value, 1)}%` },
      { label: "Conf.", key: "confidence", format: (value, row) => `${value} (${number(row.confidence_score)}%)` },
      { label: "Score norm.", key: "normalized_score", num: true, format: (value) => number(value, 1) },
      { label: "Pctl score", key: "score_percentile", num: true, format: (value) => `${number(value)}%` },
      { label: "Índice ajust.", key: "adjusted_load_index", num: true, format: (value) => number(value, 1) },
      { label: "T salidas", key: "tons", num: true, format: (value) => number(value, 1) },
      { label: "Kg/serv. salida", key: "kg_per_service", num: true, format: (value) => number(value) },
      { label: "Kg esp./serv.", key: "expected_kg_per_service", num: true, format: (value) => number(value) },
      { label: "Dif. ajust.", key: "adjusted_kg_delta", num: true, format: (value) => number(value) },
      { label: "T/día", key: "tons_per_day", num: true, format: (value) => number(value, 1) },
      { label: "Estab. kg/día", key: "daily_kg_cv", num: true, format: (value) => `${number(value, 1)}%` },
      { label: "Pctl serv./día", key: "services_day_percentile", num: true, format: (value) => `${number(value)}%` },
      { label: "Máx serv./día", key: "max_services_day", num: true, format: (value) => number(value) },
      { label: "Ruta principal", key: "main_route" },
      { label: "Residuo principal", key: "main_waste" },
      { label: "Vehículo principal", key: "main_vehicle" },
      { label: "Garbigunes", key: "sites", num: true, format: (value) => number(value) },
      { label: "Rutas", key: "routes", num: true, format: (value) => number(value) },
      { label: "Bases", key: "bases", num: true, format: (value) => number(value) },
      { label: "Residuos", key: "waste_types", num: true, format: (value) => number(value) },
      { label: "Vehículos", key: "vehicles", num: true, format: (value) => number(value) },
    ],
    view.drivers.drivers,
    { sortKey: "normalized_score", sortDir: "desc", limit: "25" },
  );
  renderDriverWasteMatrix();
}

function renderDriverProfileSummary() {
  const root = document.querySelector("#driver-profile-summary");
  if (!root) return;
  const comparable = view.drivers.comparableDrivers || [];
  const excluded = view.drivers.excludedDrivers || [];
  const best = view.drivers.topByNormalizedEfficiency?.[0];
  const stable = [...comparable].filter((row) => row.work_days >= driverMinDays).sort((a, b) => a.services_day_cv - b.services_day_cv)[0];
  const broadProfile = [...comparable].sort((a, b) => b.routes + b.waste_types + b.vehicles - (a.routes + a.waste_types + a.vehicles))[0];
  const avgCv = comparable.length ? sum(comparable, "services_day_cv") / comparable.length : 0;
  const highConfidence = comparable.filter((row) => row.confidence_score >= 75).length;
  const cards = [
    ["Muestra comparable", `${number(comparable.length)} conductores`, `Mínimo ${number(driverMinDays)} días · excluidos ${number(excluded.length)}`],
    ["Confianza alta", `${number(highConfidence)} conductores`, ">=75% según días, servicios y cobertura operativa"],
    ["Mejor score", best ? `${best.driver} · ${number(best.normalized_score, 1)}` : "-", best ? `${best.main_route || "Sin ruta principal"}` : "Sin muestra"],
    ["Más estable", stable ? `${stable.driver} · ${number(stable.services_day_cv, 1)}%` : "-", "CV de servicios de salida/día más bajo"],
    ["Perfil amplio", broadProfile ? `${broadProfile.driver}` : "-", broadProfile ? `${number(broadProfile.routes)} rutas · ${number(broadProfile.waste_types)} residuos · ${number(broadProfile.vehicles)} vehículos` : "Sin muestra"],
    ["Estabilidad media", `${number(avgCv, 1)}%`, "Coeficiente de variación de servicios de salida/día"],
  ];
  root.innerHTML = "";
  cards.forEach(([label, value, sub]) => {
    root.append(el("div", { class: "detail-item" }, [el("div", { class: "label", text: label }), el("div", { class: "value", text: value }), el("div", { class: "sub", text: sub })]));
  });
}

function renderResources() {
  renderMobileIntegration();
  renderTable(
    "#personal-table",
    [
      { label: "Año", key: "year" },
      { label: "Operativa", key: "operativa", num: true },
      { label: "Averías", key: "averías", num: true },
      { label: "Formación", key: "formación", num: true },
      { label: "Otros", key: "otros", num: true },
      { label: "Total", key: "total", num: true },
    ],
    view.resources.personalHours.rows,
    { sortKey: "year", sortDir: "asc", limit: "all" },
  );
  renderTable(
    "#convenios-table",
    [
      { label: "Ayuntamiento", key: "municipality" },
      { label: "Estado", key: "status", format: (value) => ({ firmado: "Convenio firmado", sin_convenio: "Sin convenio", sin_renovar: "Sin renovar" })[value] || value },
      { label: "Población", key: "population", num: true, format: (value) => number(value) },
      { label: "Firma", key: "signed" },
      { label: "Fin", key: "ends" },
    ],
    view.resources.convenios?.rows || [],
    { sortKey: "population", sortDir: "desc", limit: "25" },
  );
  renderTable(
    "#mobile-origins-table",
    [
      { label: "Municipio origen", key: "origin" },
      { label: "Movimientos", key: "count", num: true, format: (value) => number(value) },
    ],
    view.resources.mobileOrigins || [],
    { sortKey: "count", sortDir: "desc", limit: "12" },
  );
  renderTable(
    "#quality-report-table",
    [
      { label: "Check", key: "check" },
      { label: "Estado", key: "status", format: (value) => (value === "ok" ? "OK" : "Revisar") },
      { label: "Registros", key: "value", num: true, format: (value) => number(value) },
      { label: "%", key: "share", num: true, format: (value) => `${number(value, 1)}%` },
      { label: "Detalle", key: "detail" },
    ],
    data.quality?.checks || [],
    { sortKey: "share", sortDir: "desc", limit: "all" },
  );
  renderDataArchitectureNotes();
}

function renderMobileIntegration() {
  const meta = view.resources.mobile?.meta || {};
  const note = document.querySelector("#mobile-integration-note");
  if (note) {
    note.textContent = meta.decision || "Este bloque se mantiene separado como movimientos del servicio móvil.";
  }
  const root = document.querySelector("#mobile-integration-summary");
  if (!root) return;
  const cards = [
    ["Tratamiento", meta.integrationMode === "movements_only" ? "Movimientos separados" : "Candidato a integrar", meta.hasWeight && meta.hasWaste ? "Detectados peso y residuo" : "Sin peso/residuo comparable"],
    ["Registros", number(meta.rows || 0), `${meta.from || "-"} · ${meta.to || "-"}`],
    ["Campo peso", meta.hasWeight ? (meta.weightColumns || []).join(" · ") : "No disponible", "No se suma a t salidas si falta peso"],
    ["Campo residuo", meta.hasWaste ? (meta.wasteColumns || []).join(" · ") : "No disponible", "No se mezcla con composición de residuos si falta residuo"],
  ];
  root.innerHTML = "";
  cards.forEach(([label, value, sub]) => {
    root.append(el("div", { class: "detail-item" }, [el("div", { class: "label", text: label }), el("div", { class: "value", text: value }), el("div", { class: "sub", text: sub })]));
  });
}

function renderDataArchitectureNotes() {
  const root = document.querySelector("#data-architecture-notes");
  if (!root) return;
  const monthly = view.comparatives?.monthly || data.analytics?.monthly || {};
  const dominance = data.analytics?.dominance || {};
  const notes = [
    ["Cálculo en Python", "El build genera calidad de datos, normalización de rutas/base, cobertura de fuentes, diagnóstico del móvil y métricas ejecutivas base antes de cargar el dashboard."],
    ["Comparativa base", `Último mes ${monthly.lastMonth || "-"} · ${monthly.comparisonBasis || "Mes completo"} · MoM t salidas ${trend(monthly.momTons)} · YoY t salidas ${trend(monthly.yoyTons)}.`],
    ["Concentración", `Garbigune líder ${number(dominance.topSiteShare || 0, 1)}% · residuo líder ${number(dominance.topWasteShare || 0, 1)}% · ruta líder ${number(dominance.topRouteShare || 0, 1)}%.`],
    ["Precomputado", data.analytics?.precomputed?.scope || "Base sin filtros calculada en Python; el navegador recalcula solo al interactuar con filtros."],
  ];
  root.innerHTML = "";
  notes.forEach(([title, body]) => root.append(el("div", { class: "note" }, [el("strong", { text: title }), el("span", { text: body })])));
}

function trend(value) {
  if (value === null || value === undefined) return "s/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${number(value, 1)}%`;
}

function renderComparatives() {
  const monthly = view.comparatives?.monthly || {};
  const previousRows = comparisonRows();
  const previousKg = sum(previousRows, "kg");
  const currentKg = view.kpis.tons * 1000;
  const periodDelta = previousRows.length ? pctChange(currentKg, previousKg) : null;
  const monthlyWindow = monthly.currentFrom && monthly.currentTo ? `${monthly.currentFrom} · ${monthly.currentTo}` : monthly.lastMonth || "-";
  const momWindow = monthly.momWindow ? `${monthly.momWindow.from} · ${monthly.momWindow.to}` : "s/d";
  const yoyWindow = monthly.yoyWindow ? `${monthly.yoyWindow.from} · ${monthly.yoyWindow.to}` : "s/d";
  const cards =
    compareMode === "previous"
      ? [
          ["Periodo actual", `${number(view.kpis.trips)} serv. salida · ${number(view.kpis.tons, 1)} t salida`],
          ["Periodo anterior", `${number(previousRows.length)} serv. salida · ${number(previousKg / 1000, 1)} t salida`],
          ["Variación t salidas", trend(periodDelta)],
          ["Outliers", number(view.comparatives?.counts?.outliers || 0)],
        ]
      : [
          [monthly.isPartialMonth ? "Mes parcial" : "Mes evaluado", monthlyWindow],
          ["Base comparación", monthly.comparisonBasis || "Mes completo"],
          [compareMode === "mom" ? "MoM t salidas" : "YoY t salidas", trend(compareMode === "mom" ? monthly.momTons : monthly.yoyTons)],
          [compareMode === "mom" ? "MoM serv. salida" : "YoY serv. salida", trend(compareMode === "mom" ? monthly.momTrips : monthly.yoyTrips)],
          [compareMode === "mom" ? "Ventana anterior" : "Ventana año ant.", compareMode === "mom" ? momWindow : yoyWindow],
        ];
  const root = document.querySelector("#comparative-cards");
  if (root) {
    root.innerHTML = "";
    cards.forEach(([label, value]) => {
      root.append(el("div", { class: "detail-item" }, [el("div", { class: "label", text: label }), el("div", { class: "value", text: value })]));
    });
  }

  renderTable(
    "#outliers-table",
    [
      { label: "Tipo", key: "kind" },
      { label: "Elemento", key: "label" },
      { label: "Dirección", key: "direction" },
      { label: "Valor", key: "value", num: true, format: (value) => number(value, 1) },
      { label: "Umbral", key: "threshold", num: true, format: (value) => number(value, 1) },
    ],
    view.comparatives?.outliers || [],
    { sortKey: "value", sortDir: "desc", limit: "10" },
  );
}

function renderDiagnostics() {
  const root = document.querySelector("#diagnostic-notes");
  if (!root) return;
  root.innerHTML = "";
  executiveAlerts().forEach((alert) => {
    root.append(
      el("div", { class: `note alert ${alert.severity}` }, [
        el("div", { class: "alert-top" }, [
          el("strong", { text: alert.title }),
          el("span", { class: "alert-severity", text: alert.metric }),
        ]),
        el("span", { text: alert.body }),
        el("div", { class: "alert-action" }, [el("b", { text: "Acción" }), document.createTextNode(` ${alert.action}`)]),
      ]),
    );
  });
}

function renderQualityNotes() {
  const root = document.querySelector("#quality-notes");
  if (!root) return;
  const activeRows = filteredPesadas();
  const missingVehicle = activeRows.filter((row) => !row.vehicle).length;
  const missingDriver = activeRows.filter((row) => !row.driver).length;
  const missingWaste = activeRows.filter((row) => !row.waste).length;
  const noRouteRows = activeRows.filter((row) => row.route === "SIN RUTA");
  const noBaseRows = activeRows.filter((row) => !row.base || row.base === "SIN RUTA");
  const noRouteSites = countRecords(noRouteRows, "site", "site", "count", 4)
    .map((row) => `${row.site || "SIN DATO"} (${number(row.count)})`)
    .join(" · ");
  const baseOverrides = (data.quality?.routeMapping?.baseOverrides || [])
    .map((row) => `${row.route} → ${row.base}`)
    .join(" · ");
  const monthly = view.comparatives?.monthly || {};
  const notes = [
    ["Cobertura", `Pesadas ${data.coverage.pesadasFrom} a ${data.coverage.pesadasTo}; incidencias Garbigunes ${data.coverage.incidenciasFrom} a ${data.coverage.incidenciasTo}; rutas ${data.coverage.routesAsOf}.`],
    ["Calidad de datos", `Sin vehículo: ${number(missingVehicle)} · sin conductor: ${number(missingDriver)} · sin residuo: ${number(missingWaste)} · sin ruta: ${number(noRouteRows.length)} · sin base: ${number(noBaseRows.length)}.`],
    ["Rutas revisadas", `${baseOverrides || "Sin reglas manuales"}${noRouteRows.length ? `. Pendiente SIN RUTA: ${noRouteSites}.` : ". Sin pesadas pendientes de ruta en el filtro activo."}`],
    ["Metodología", "Percentiles se calculan sobre el filtro activo; outliers usan IQR; score conductor ajusta por ruta + garbigune + residuo."],
    ["Confianza rankings", "Alta/Media/Baja indica robustez de muestra, no desempeño: conductores ponderan días, servicios y cobertura; vehículos ponderan servicios y días; rutas ponderan servicios y garbigunes."],
  ];
  if (monthly.isPartialMonth) {
    notes.unshift([
      "Mes parcial",
      `El último mes evaluado cubre ${monthly.currentFrom} a ${monthly.currentTo}. MoM/YoY se calculan con días equivalentes: MoM ${monthly.momWindow?.from || "s/d"} a ${monthly.momWindow?.to || "s/d"}; YoY ${monthly.yoyWindow?.from || "s/d"} a ${monthly.yoyWindow?.to || "s/d"}.`,
    ]);
  }
  root.innerHTML = "";
  notes.forEach(([title, body]) => root.append(el("div", { class: "note" }, [el("strong", { text: title }), el("span", { text: body })])));
}

function captureCompositionRows() {
  if (captureFilters.compositionLevel === "subfamily") return view.capture?.bySubfamily || [];
  if (captureFilters.compositionLevel === "waste") return view.capture?.byWaste || [];
  return view.capture?.byFamily || [];
}

function captureCompositionLabelKey() {
  if (captureFilters.compositionLevel === "subfamily") return "subfamily";
  if (captureFilters.compositionLevel === "waste") return "waste";
  return "family";
}

function captureCompositionMetrics() {
  const metrics = [
    { key: "tons", label: "T entrada", format: (value) => `${number(value, 2)} t entrada` },
    { key: "entries", label: "Entradas", format: (value) => `${number(value)} entradas` },
    { key: "share", label: "Cuota", format: (value) => `${number(value, 1)}%` },
  ];
  if (captureFilters.compositionLevel !== "waste") {
    metrics.splice(2, 0, { key: "wastes", label: "Residuos", format: (value) => `${number(value)} residuos` });
  }
  return metrics;
}

function renderCharts() {
  comboMonthlyChart();
  interactiveBarChart({
    target: "#top-sites-chart",
    rows: view.sitesWaste.sites,
    labelKey: "site",
    filterKey: "site",
    left: 150,
    defaultLimit: 8,
    metrics: [
      { key: "tons", label: "T salidas", format: (value) => `${number(value, 1)} t salida` },
      { key: "trips", label: "Serv. salida", format: (value) => `${number(value)} serv. salida` },
      { key: "kg_per_trip", label: "Kg/serv.", format: (value) => `${number(value)} kg/serv.` },
    ],
  });
  interactiveBarChart({
    target: "#top-waste-chart",
    rows: view.sitesWaste.waste,
    labelKey: "waste",
    filterKey: "waste",
    left: 190,
    labelMax: 30,
    defaultLimit: 8,
    metrics: [
      { key: "tons", label: "T salidas", format: (value) => `${number(value, 1)} t salida` },
      { key: "trips", label: "Serv. salida", format: (value) => `${number(value)} serv. salida` },
      { key: "share", label: "Cuota", format: (value) => `${number(value, 1)}%` },
    ],
  });
  interactiveBarChart({
    target: "#waste-share-chart",
    rows: view.sitesWaste.waste,
    labelKey: "waste",
    filterKey: "waste",
    left: 190,
    labelMax: 29,
    defaultLimit: 8,
    metrics: [
      { key: "tons", label: "T salidas", format: (value) => `${number(value, 1)} t salida` },
      { key: "share", label: "Cuota", format: (value) => `${number(value, 1)}%` },
      { key: "trips", label: "Serv. salida", format: (value) => `${number(value)} serv. salida` },
    ],
  });
  interactiveBarChart({
    target: "#routes-chart",
    rows: view.sitesWaste.routes || [],
    labelKey: "route",
    filterKey: "route",
    left: 245,
    labelMax: 35,
    defaultLimit: 8,
    metrics: [
      { key: "tons", label: "T salidas", format: (value) => `${number(value, 1)} t salida` },
      { key: "trips", label: "Serv. salida", format: (value) => `${number(value)} serv. salida` },
      { key: "kg_per_trip", label: "Kg/serv.", format: (value) => `${number(value)} kg/serv.` },
      { key: "sites", label: "Garbigunes", format: (value) => `${number(value)} centros` },
      { key: "confidence_score", label: "Confianza", format: (value, row) => `${row.confidence} · ${number(value)}%` },
    ],
  });
  interactiveBarChart({
    target: "#capture-sites-chart",
    rows: view.capture?.bySite || [],
    labelKey: "site",
    left: 150,
    defaultLimit: 8,
    metrics: [
      { key: "tons", label: "T entrada", format: (value) => `${number(value, 2)} t entrada` },
      { key: "entries", label: "Entradas", format: (value) => `${number(value)} entradas` },
      { key: "cps", label: "CP origen", format: (value) => `${number(value)} CP` },
      { key: "waste_families", label: "Familias", format: (value) => `${number(value)} familias` },
      { key: "wastes", label: "Residuos", format: (value) => `${number(value)} residuos` },
      { key: "avg_distance_km", label: "Distancia", format: (value) => (value ? `${number(value, 1)} km med.` : "s/d") },
      { key: "kg_per_km", label: "Kg/km", format: (value) => (value ? `${number(value, 1)} kg/km` : "s/d") },
      { key: "entries_per_km", label: "Entr./km", format: (value) => (value ? `${number(value, 2)} entr./km` : "s/d") },
    ],
  });
  interactiveBarChart({
    target: "#capture-waste-chart",
    rows: captureCompositionRows(),
    labelKey: captureCompositionLabelKey(),
    left: 220,
    labelMax: 34,
    defaultLimit: captureFilters.compositionLevel === "waste" ? 12 : 10,
    metrics: captureCompositionMetrics(),
  });
  interactiveBarChart({ target: "#fuel-chart", rows: view.fleet.fuelMix, labelKey: "fuel", left: 115, metrics: [{ key: "count", label: "Vehículos" }], defaultLimit: 8 });
  document.querySelector(`[data-chart-for="#incident-types-chart"]`)?.remove();
  stackedIncidentTypesChart();
  interactiveBarChart({ target: "#incident-subgroups-chart", rows: view.fleet.incidentSubgroups, labelKey: "subgroup", left: 160, metrics: [{ key: "count", label: "Incidencias" }], defaultLimit: 8 });
  interactiveBarChart({ target: "#workshops-chart", rows: view.fleet.workshops, labelKey: "workshop", left: 190, labelMax: 27, metrics: [{ key: "count", label: "Incidencias" }], defaultLimit: 8 });
  document.querySelector(`[data-chart-for="#driver-services-chart"]`)?.remove();
  const driverClusterLegend = Object.entries(DRIVER_CLUSTER_DEFS).map(([key, item]) => ({ key, label: item.label, color: item.color }));
  scatterPlot("#driver-services-chart", view.drivers.drivers, {
    labelKey: "driver",
    xKey: "total_services",
    yKey: "work_days",
    sizeKey: "tons",
    colorKey: "confidence_score",
    colorAccessor: (row) => row.cluster_color,
    filterKey: "driver",
    xLabel: "Servicios salida",
    yLabel: "Días trabajados",
    note: "Cada punto es un conductor · color: perfil automático · tamaño: t salidas",
    legend: driverClusterLegend,
    display: (row) => `${row.cluster_label} · ${number(row.total_services)} servicios salida · ${number(row.work_days)} días · ${number(row.services_per_day, 1)} serv./día · ${number(row.tons, 1)} t salida · conf. ${row.confidence} (${number(row.confidence_score)}%) · ${row.main_route || "sin ruta"}`,
  });
  document.querySelector(`[data-chart-for="#driver-load-chart"]`)?.remove();
  scatterPlot("#driver-load-chart", view.drivers.drivers, {
    labelKey: "driver",
    xKey: "kg_per_service",
    yKey: "services_per_day",
    sizeKey: "tons",
    colorKey: "adjusted_load_index",
    colorAccessor: (row) => row.cluster_color,
    filterKey: "driver",
    xLabel: "Kg/servicio",
    yLabel: "Servicios salida/día",
    yDecimals: 1,
    note: "Cruce de carga media y productividad diaria · color: perfil automático · tamaño: t salidas",
    legend: driverClusterLegend,
    display: (row) => `${row.cluster_label} · ${number(row.kg_per_service)} kg/serv. · ${number(row.services_per_day, 1)} serv./día · ${number(row.adjusted_load_index, 1)} carga ajust. · ${number(row.tons, 1)} t salida · conf. ${row.confidence} (${number(row.confidence_score)}%) · ${row.main_waste || "sin residuo"}`,
  });
  interactiveBarChart({
    target: "#driver-productivity-chart",
    rows: view.drivers.comparableDrivers || [],
    labelKey: "driver",
    filterKey: "driver",
    left: 115,
    defaultLimit: 8,
    defaultMetric: "normalized_score",
    metrics: [
      { key: "normalized_score", label: "Score norm.", format: (value) => `${number(value, 1)} pts` },
      { key: "adjusted_load_index", label: "Carga ajust.", format: (value) => `${number(value, 1)} / 100` },
      { key: "service_day_index", label: "Serv./día índice", format: (value) => `${number(value, 1)} / 100` },
      { key: "services_per_day", label: "Serv./día", format: (value) => `${number(value, 1)} serv./día` },
      { key: "services_day_cv", label: "Estabilidad", format: (value) => `${number(value, 1)}% CV` },
      { key: "confidence_score", label: "Confianza", format: (value, row) => `${row.confidence} · ${number(value)}%` },
    ],
  });
  interactiveBarChart({ target: "#ref-year-chart", rows: view.resources.refuerzosByYear, labelKey: "year", left: 80, metrics: [{ key: "count", label: "Refuerzos" }], defaultLimit: "all", sortMode: "chronological", defaultSort: "asc" });
  interactiveBarChart({ target: "#ref-place-chart", rows: view.resources.refuerzosByPlace, labelKey: "place", left: 250, labelMax: 36, metrics: [{ key: "count", label: "Refuerzos" }], defaultLimit: 8 });
  interactiveBarChart({ target: "#mobile-chart", rows: view.resources.mobileDestinations, labelKey: "destination", left: 175, metrics: [{ key: "count", label: "Movimientos" }], defaultLimit: 8 });
  interactiveBarChart({ target: "#mobile-month-chart", rows: view.resources.mobileByMonth || [], labelKey: "month", left: 90, metrics: [{ key: "count", label: "Movimientos" }], defaultLimit: "all", sortMode: "chronological", defaultSort: "asc" });
  interactiveBarChart({ target: "#mobile-driver-chart", rows: view.resources.mobileByDriver || [], labelKey: "driver", left: 125, metrics: [{ key: "count", label: "Movimientos" }], defaultLimit: 8 });
  interactiveBarChart({ target: "#people-chart", rows: view.resources.refuerzosByPerson, labelKey: "person", left: 120, metrics: [{ key: "count", label: "Refuerzos" }], defaultLimit: 8 });
  interactiveBarChart({
    target: "#convenios-chart",
    rows: view.resources.convenios?.byStatus || [],
    labelKey: "status",
    left: 155,
    defaultLimit: 5,
    metrics: [
      { key: "municipalities", label: "Ayuntamientos", format: (value) => `${number(value)} ayunt.` },
      { key: "population", label: "Población", format: (value) => `${number(value)} hab.` },
    ],
  });
}

function renderNotes() {
  const topSite = view.summary.topSites[0] || { site: "-", tons: 0, trips: 0 };
  const topWaste = view.summary.topWaste[0] || { waste: "-", share: 0 };
  const topVehicle = view.fleet.vehicles[0] || { vehicle: "-", tons: 0, trips: 0 };
  const notes = [
    [`Mayor salida`, `${topSite.site} concentra ${number(topSite.tons, 1)} t de salida y ${number(topSite.trips)} servicios de salida.`],
    [`Fracción dominante`, `${topWaste.waste} supone ${number(topWaste.share, 1)}% del peso recogido.`],
    [`Vehículo con más salida`, `${topVehicle.vehicle} acumula ${number(topVehicle.tons, 1)} t de salida con ${number(topVehicle.trips)} servicios de salida.`],
    [`Comparativa`, `MoM toneladas: ${trend(view.comparatives?.monthly?.momTons)} · YoY toneladas: ${trend(view.comparatives?.monthly?.yoyTons)}.`],
  ];

  const root = document.querySelector("#efficiency-notes");
  root.innerHTML = "";
  notes.forEach(([title, body]) => root.append(el("div", { class: "note" }, [el("strong", { text: title }), el("span", { text: body })])));
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.tab}`).classList.add("active");
      history.replaceState(null, "", `#${button.dataset.tab}`);
      if (button.dataset.tab === "capture") renderCapture();
    });
  });

  const requested = window.location.hash.replace("#", "");
  const initial = requested ? document.querySelector(`.tab[data-tab="${requested}"]`) : null;
  if (initial) initial.dispatchEvent(new Event("click", { bubbles: true }));
}

function setViewMode(mode) {
  viewMode = mode === "analyst" ? "analyst" : "executive";
  safeStorageSet("garbikerViewMode", viewMode);
  document.body.classList.toggle("mode-analyst", viewMode === "analyst");
  document.body.classList.toggle("mode-executive", viewMode === "executive");
  document.querySelectorAll("#view-mode-toggle button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === viewMode);
  });
  renderModeHint();
}

function renderModeHint() {
  const root = document.querySelector("#mode-hint");
  if (!root) return;
  root.innerHTML = "";
  if (viewMode === "executive") {
    root.append(
      el("span", {}, [
        el("strong", { text: "Modo Ejecutivo: " }),
        document.createTextNode("metodología, glosario, notas largas y tablas técnicas quedan plegadas para priorizar lectura y acción."),
      ]),
      el("button", { type: "button", text: "Ver modo Analista" }),
    );
    root.querySelector("button").addEventListener("click", () => setViewMode("analyst"));
  } else {
    root.append(
      el("span", {}, [
        el("strong", { text: "Modo Analista: " }),
        document.createTextNode("se muestran metodología, calidad de datos y detalle técnico completo."),
      ]),
    );
  }
}

function bindViewMode() {
  document.querySelectorAll("#view-mode-toggle button").forEach((button) => {
    button.addEventListener("click", () => setViewMode(button.dataset.mode));
  });
  setViewMode(viewMode);
}

async function init() {
  document.querySelector("#coverage").textContent = `Salidas transportadas: ${data.coverage.pesadasFrom} a ${data.coverage.pesadasTo}`;
  document.querySelector("#generated").textContent = `Actualizado: ${data.generatedAt.replace("T", " ")}`;
  bindViewMode();
  await loadCoreRecords();
  initGlobalFilters();
  bindTabs();
}

init().catch((error) => {
  console.error(error);
  const main = document.querySelector("main");
  if (main) {
    main.prepend(el("div", { class: "mode-hint load-error" }, [el("strong", { text: coreRecordsError || "No se pudo cargar el dashboard." })]));
  }
});
